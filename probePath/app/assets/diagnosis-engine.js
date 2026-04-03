import { findScenario, findSymptom, findTemplate } from './data.js';

function hasNumber(value) {
  return Number.isFinite(value);
}

function toNumber(rawValue) {
  if (rawValue === null || rawValue === undefined || rawValue === '') {
    return null;
  }

  const parsed = Number(rawValue);

  return Number.isFinite(parsed) ? parsed : null;
}

function matchesRule(value, rule) {
  switch (rule.when) {
    case 'lt':
      return value < rule.value;
    case 'lte':
      return value <= rule.value;
    case 'gt':
      return value > rule.value;
    case 'gte':
      return value >= rule.value;
    case 'between':
      return value >= rule.min && value <= rule.max;
    case 'outside':
      return value < rule.min || value > rule.max;
    default:
      return false;
  }
}

function classifyMeasurement(step, value) {
  const expected = step.expected ?? {};
  const hasMin = hasNumber(expected.min);
  const hasMax = hasNumber(expected.max);

  if (hasMin && value < expected.min) {
    return {
      tone: 'low',
      label: 'Below expected',
      detail: expected.low ?? 'This reading is lower than expected.'
    };
  }

  if (hasMax && value > expected.max) {
    return {
      tone: 'high',
      label: 'Above expected',
      detail: expected.high ?? 'This reading is higher than expected.'
    };
  }

  return {
    tone: 'good',
    label: 'Within expected range',
    detail: expected.healthy ?? 'This reading is within the expected range.'
  };
}

function confidenceLabel(confidence) {
  if (confidence >= 80) {
    return 'High confidence';
  }

  if (confidence >= 60) {
    return 'Likely';
  }

  if (confidence >= 40) {
    return 'Possible';
  }

  return 'Watch list';
}

export function formatMeasurement(value, unit) {
  if (!hasNumber(value)) {
    return 'Not entered';
  }

  const fixed = Math.abs(value) >= 100 ? value.toFixed(0) : value.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
  return `${fixed} ${unit}`.trim();
}

export function evaluateDiagnosis(templateId, symptomId, rawMeasurements = {}) {
  const template = findTemplate(templateId);
  const symptom = findSymptom(symptomId);
  const scenario = findScenario(templateId, symptomId);

  if (!template || !symptom || !scenario) {
    return null;
  }

  const measurements = {};
  const faultMap = new Map();
  const healthyObservations = [];

  scenario.faults.forEach((fault) => {
    faultMap.set(fault.id, {
      ...fault,
      score: fault.baseScore ?? 0,
      evidence: []
    });
  });

  const steps = scenario.steps.map((step) => {
    const value = toNumber(rawMeasurements[step.id]);
    const answered = hasNumber(value);
    const status = answered ? classifyMeasurement(step, value) : { tone: 'pending', label: 'Pending', detail: 'No measurement entered yet.' };

    if (answered) {
      measurements[step.id] = value;

      step.scoring.forEach((rule) => {
        if (!matchesRule(value, rule)) {
          return;
        }

        const fault = faultMap.get(rule.faultId);

        if (!fault) {
          return;
        }

        fault.score += rule.score;

        if (rule.note) {
          fault.evidence.push(rule.note);
        }
      });

      if (status.tone === 'good') {
        healthyObservations.push(`${step.title}: ${status.detail}`);
      }
    }

    return {
      ...step,
      answered,
      value,
      status
    };
  });

  const answeredCount = steps.filter((step) => step.answered).length;
  const progress = scenario.steps.length === 0 ? 0 : answeredCount / scenario.steps.length;
  const scores = Array.from(faultMap.values()).map((fault) => fault.score);
  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);
  const spread = Math.max(maxScore - minScore, 1);

  const faults = Array.from(faultMap.values())
    .map((fault) => {
      const normalized = (fault.score - minScore) / spread;
      const confidence = Math.round(Math.min(95, Math.max(24, 26 + normalized * 64 + progress * 8)));

      return {
        ...fault,
        confidence,
        confidenceLabel: confidenceLabel(confidence),
        evidence: fault.evidence.slice(0, 3)
      };
    })
    .sort((left, right) => right.score - left.score);

  const nextStep = steps.find((step) => !step.answered) ?? null;
  const topFault = faults[0] ?? null;
  const suggestedFixes = faults.slice(0, 3);
  const topFix = topFault?.fixes?.[0] ?? 'Take the next recommended measurement to narrow the fault.';
  const exportSummary = {
    title: 'Bench-ready summary',
    oneLine: topFault
      ? `${template.name} with symptom "${symptom.label}" most likely points to ${topFault.label.toLowerCase()} at ${topFault.confidence}% confidence.`
      : `ProbePath has not seen enough measurements yet to rank the fault path for ${template.name}.`,
    likelyIssue: topFault?.label ?? 'Need more measurements',
    confidence: topFault?.confidence ?? 0,
    nextProbe: nextStep?.title ?? 'All recommended measurements are captured.',
    firstFix: topFix,
    scopeNote: 'Scoped to common low-voltage educational and prototype circuits.'
  };

  return {
    template,
    symptom,
    scenario,
    steps,
    measurements,
    faults,
    healthyObservations,
    nextStep,
    progress,
    answeredCount,
    complete: answeredCount === steps.length,
    summary: {
      headline: topFault
        ? `Most likely issue: ${topFault.label}.`
        : 'Start with the first measurement to build evidence.',
      detail: nextStep
        ? `Next measurement: ${nextStep.title}.`
        : 'All planned measurements are filled in. Review the likely fixes and export the summary.',
      topFault
    },
    report: {
      templateName: template.name,
      symptomLabel: symptom.label,
      narrative: scenario.narrative,
      exportSummary,
      measurements: steps.map((step) => ({
        id: step.id,
        title: step.title,
        value: step.value,
        unit: step.unit,
        formattedValue: formatMeasurement(step.value, step.unit),
        status: step.status.label,
        detail: step.status.detail
      })),
      rankedFaults: faults.map((fault) => ({
        id: fault.id,
        label: fault.label,
        description: fault.description,
        confidence: fault.confidence,
        confidenceLabel: fault.confidenceLabel,
        evidence: fault.evidence,
        fixes: fault.fixes
      })),
      healthyObservations,
      suggestedFixes: suggestedFixes.map((fault) => ({
        label: fault.label,
        fixes: fault.fixes
      }))
    }
  };
}
