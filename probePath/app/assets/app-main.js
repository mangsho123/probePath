import { CIRCUIT_TEMPLATES, DEMO_CASES, findSymptom, findTemplate } from './data.js';
import { evaluateDiagnosis, formatMeasurement } from './diagnosis-engine.js';

const root = document.querySelector('#app');
const historyKey = 'probepath-history';
const savedReportsKey = 'probepath-saved-reports';
const featuredDemo = DEMO_CASES.find((demo) => demo.id === 'demo-brownout') ?? DEMO_CASES[0];

const PRODUCT_COPY = {
  oneSentence: "ProbePath tells you where to measure next when your circuit doesn't work.",
  heroBadge: 'Debugging copilot for breadboards, robots, and prototype circuits',
  heroTitle: 'Stop guessing. Take the next useful measurement.',
  heroBody: 'ProbePath starts from the symptom you actually see, highlights the next node to probe, then ranks likely faults from your real meter or scope readings.',
  heroTrust: 'Built for common low-voltage educational and prototype circuits. Not a universal circuit simulator.',
  featureCards: [
    {
      title: 'Know the next probe',
      copy: 'ProbePath tells you exactly where to measure next and why that reading matters.'
    },
    {
      title: 'Debug from real readings',
      copy: 'The fault ranking updates from your measurements, so the guidance gets sharper as evidence comes in.'
    },
    {
      title: 'Leave with a fix',
      copy: 'Every run ends with likely causes, specific fixes to try, and a concise bench-ready summary.'
    }
  ],
  emptyStates: {
    viewer: 'Choose a circuit to reveal the exact nodes ProbePath wants you to probe first.',
    symptom: 'Pick a circuit first. ProbePath only shows symptoms that fit that circuit.',
    probe: 'Choose a circuit and symptom to unlock the next best measurement, expected values, and probe notes.',
    faults: 'Enter the first reading and ProbePath will turn the symptom into ranked likely causes.',
    fixes: 'Suggested fixes appear once ProbePath has enough evidence to narrow the fault path.',
    summary: 'Run a diagnosis or load the featured motor brownout demo to see the full flow in seconds.',
    history: 'Recent diagnosis runs and saved bench reports will show up here for quick replay.'
  },
  exportTitle: 'Bench-ready summary',
  exportBody: 'Use this summary in a demo, lab notebook, handoff, or issue thread.'
};

const state = {
  sessionKey: null,
  selectedTemplateId: null,
  selectedSymptomId: null,
  measurements: {},
  focusStepId: null,
  wizardStage: 1,
  sliderDrafts: {},
  localHistory: loadLocalHistory(),
  savedReports: [],
  shareState: { status: 'idle', url: null, message: '' }
};

function loadLocalHistory() {
  try {
    return JSON.parse(window.localStorage.getItem(historyKey) ?? '[]');
  } catch {
    return [];
  }
}

function saveLocalHistory(entries) {
  state.localHistory = entries.slice(0, 8);
  window.localStorage.setItem(historyKey, JSON.stringify(state.localHistory));
}

function loadLocalSavedReports() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(savedReportsKey) ?? '[]');
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function saveLocalSavedReports(reports) {
  window.localStorage.setItem(savedReportsKey, JSON.stringify(reports.slice(0, 12)));
}

function beginSession() {
  state.sessionKey = window.crypto?.randomUUID?.() ?? `session-${Date.now()}`;
}

function relativeTimeLabel(dateText) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(dateText));
}

function currentTemplate() {
  return findTemplate(state.selectedTemplateId);
}

function currentAnalysis() {
  if (!state.selectedTemplateId || !state.selectedSymptomId) {
    return null;
  }

  return evaluateDiagnosis(state.selectedTemplateId, state.selectedSymptomId, state.measurements);
}

function currentStep(analysis) {
  if (!analysis) {
    return null;
  }

  return analysis.steps.find((step) => step.id === state.focusStepId) ?? analysis.nextStep ?? analysis.steps.at(-1) ?? null;
}

function upsertHistory(fromLabel = 'Manual diagnosis') {
  const analysis = currentAnalysis();

  if (!analysis || !state.sessionKey) {
    return;
  }

  const item = {
    id: state.sessionKey,
    label: fromLabel,
    templateId: state.selectedTemplateId,
    symptomId: state.selectedSymptomId,
    measurements: state.measurements,
    updatedAt: new Date().toISOString(),
    topFault: analysis.faults[0]?.label ?? 'No result yet',
    progress: Math.round(analysis.progress * 100),
    title: analysis.scenario.title
  };

  const next = [item, ...state.localHistory.filter((entry) => entry.id !== item.id)];
  saveLocalHistory(next);
}

function exportSummaryText(analysis) {
  const summary = analysis.report.exportSummary;

  return [
    'ProbePath bench summary',
    '',
    `Scenario: ${analysis.scenario.title}`,
    `Circuit: ${analysis.template.name}`,
    `Symptom: ${analysis.symptom.label}`,
    '',
    summary.oneLine,
    '',
    `Most likely issue: ${summary.likelyIssue}`,
    `Confidence: ${summary.confidence}%`,
    `Next measurement: ${summary.nextProbe}`,
    `First fix to try: ${summary.firstFix}`,
    '',
    'Captured readings:',
    ...analysis.report.measurements.map((measurement) => `- ${measurement.title}: ${measurement.formattedValue} (${measurement.status})`),
    '',
    summary.scopeNote
  ].join('\n');
}

function reportLinkForId(reportId) {
  return `./report.html?id=${reportId}`;
}

function absoluteUrlFor(relativeUrl) {
  return new URL(relativeUrl, window.location.href).toString();
}

function normalizeSavedReports(reports) {
  return reports.map((report) => ({
    ...report,
    url: report.url ?? reportLinkForId(report.id),
    createdAtLabel: relativeTimeLabel(report.createdAt)
  }));
}

function currentSymptom() {
  return state.selectedSymptomId ? findSymptom(state.selectedSymptomId) : null;
}

function toFiniteNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function roundToStep(value, step) {
  const decimals = String(step).includes('.') ? String(step).split('.')[1].length : 0;
  return Number((Math.round(value / step) * step).toFixed(decimals));
}

function measurementSliderConfig(step) {
  const expected = step.expected ?? {};
  const placeholder = toFiniteNumber(step.placeholder);
  const hasMin = Number.isFinite(expected.min);
  const hasMax = Number.isFinite(expected.max);
  let min = 0;
  let max = hasMax ? expected.max : (placeholder ?? expected.min ?? 10);

  if (hasMin && hasMax) {
    const spread = Math.max(expected.max - expected.min, 0.2);
    min = Math.max(0, expected.min - spread * 0.8);
    max = expected.max + spread * 0.8;
  } else if (hasMin) {
    min = 0;
    max = Math.max(expected.min * 1.8, (placeholder ?? expected.min) * 1.4, expected.min + 1);
  } else if (hasMax) {
    min = 0;
    max = Math.max(expected.max * 1.9, (placeholder ?? expected.max) * 1.4, expected.max + 1);
  } else if (placeholder !== null) {
    min = 0;
    max = Math.max(placeholder * 1.8, placeholder + 1);
  }

  const unit = step.unit ?? '';
  let sliderStep = 0.1;

  if (unit.includes('V')) {
    sliderStep = max <= 1 ? 0.01 : max <= 10 ? 0.05 : 0.1;
  } else if (unit.toLowerCase().includes('k')) {
    sliderStep = max <= 20 ? 0.1 : 0.5;
  } else if (unit.includes('Ω') || unit.includes('Î©')) {
    sliderStep = max <= 500 ? 5 : max <= 5000 ? 25 : 100;
  } else {
    sliderStep = max <= 10 ? 0.1 : 1;
  }

  min = roundToStep(min, sliderStep);
  max = roundToStep(Math.max(max, min + sliderStep), sliderStep);

  const rawValue = state.sliderDrafts[step.id] ?? (step.answered ? step.value : roundToStep((min + max) / 2, sliderStep));
  const value = roundToStep(Math.min(max, Math.max(min, rawValue)), sliderStep);

  return {
    min,
    max,
    step: sliderStep,
    value,
    minLabel: formatMeasurement(min, unit),
    maxLabel: formatMeasurement(max, unit),
    displayValue: formatMeasurement(value, unit)
  };
}

function highestUnlockedStage(analysis = currentAnalysis()) {
  if (!state.selectedTemplateId) {
    return 1;
  }

  if (!state.selectedSymptomId) {
    return 2;
  }

  if (!analysis?.answeredCount) {
    return 3;
  }

  return 4;
}

function activeWizardStage(analysis = currentAnalysis()) {
  return Math.min(state.wizardStage, highestUnlockedStage(analysis));
}

function setWizardStage(nextStage, analysis = currentAnalysis()) {
  state.wizardStage = Math.max(1, Math.min(nextStage, highestUnlockedStage(analysis)));
}

function resetShareState() {
  state.shareState = { status: 'idle', url: null, message: '' };
}

function renderDiagram(template, analysis, activeStepId) {
  const answered = new Map((analysis?.steps ?? []).filter((step) => step.answered).map((step) => [step.id, step]));

  const points = template.testPoints.map((point) => {
    const isActive = point.id === activeStepId;
    const step = answered.get(point.id);

    return `
      <g class="test-point ${isActive ? 'is-active' : ''} ${step ? 'is-complete' : ''}">
        <circle cx="${point.x}" cy="${point.y}" r="10"></circle>
        <circle class="ring" cx="${point.x}" cy="${point.y}" r="16"></circle>
        <text x="${point.x + 18}" y="${point.y - 6}">${point.short}</text>
        ${step ? `<foreignObject x="${point.x + 14}" y="${point.y + 4}" width="112" height="30"><div class="svg-reading">${formatMeasurement(step.value, step.unit)}</div></foreignObject>` : ''}
      </g>
    `;
  }).join('');

  return `
    <svg viewBox="0 0 ${template.diagram.width} ${template.diagram.height}" class="circuit-diagram" role="img" aria-label="${template.name} simplified circuit">
      ${template.diagram.wires.map((wire) => `<line x1="${wire.x1}" y1="${wire.y1}" x2="${wire.x2}" y2="${wire.y2}"></line>`).join('')}
      ${template.diagram.blocks.map((block) => `
        <g class="diagram-block">
          <rect x="${block.x}" y="${block.y}" width="${block.w}" height="${block.h}" rx="18"></rect>
          <text class="label" x="${block.x + block.w / 2}" y="${block.y + block.h / 2 - 4}">${block.label}</text>
          <text class="sub" x="${block.x + block.w / 2}" y="${block.y + block.h / 2 + 14}">${block.subLabel}</text>
        </g>
      `).join('')}
      ${points}
    </svg>
  `;
}

function renderFeatureCards() {
  return `
    <div class="feature-grid">
      ${PRODUCT_COPY.featureCards.map((card) => `
        <article class="feature-card">
          <strong>${card.title}</strong>
          <span>${card.copy}</span>
        </article>
      `).join('')}
    </div>
  `;
}

function renderQuickStartPanel() {
  return `
    <section class="panel quickstart-panel">
      <div class="panel-header">
        <span class="eyebrow">Why this matters</span>
        <h3>Real debugging pain point, solved quickly</h3>
      </div>
      <div class="quickstart-grid">
        <article class="quick-card emphasis">
          <small>Fastest demo path</small>
          <strong>${featuredDemo.title}</strong>
          <span>Load the featured case and watch ProbePath move from symptom to probe plan to likely fix in one click.</span>
          <button class="primary-button" data-action="load-demo" data-demo-id="${featuredDemo.id}">Open featured demo</button>
        </article>
        <article class="quick-card">
          <small>What makes it different</small>
          <strong>Not a simulator</strong>
          <span>ProbePath starts from a failure symptom and your real readings. It is a debugging guide, not a perfect-circuit editor.</span>
        </article>
        <article class="quick-card">
          <small>What you get</small>
          <strong>Next probe, likely fault, fix</strong>
          <span>The output is always concrete: where to measure, what the reading means, and what to try next.</span>
        </article>
      </div>
    </section>
  `;
}

function renderTemplatePicker() {
  return `
    <section class="panel">
      <div class="panel-header"><span class="eyebrow">TemplatePicker</span><h3>Choose a circuit</h3></div>
      <p class="panel-copy">Start from a simple circuit family instead of drawing the whole schematic from scratch.</p>
      <div class="template-grid">
        ${CIRCUIT_TEMPLATES.map((template) => `
          <button class="template-card ${template.id === state.selectedTemplateId ? 'is-active' : ''}" data-action="select-template" data-template-id="${template.id}">
            <span class="card-tag">${template.category}</span>
            <strong>${template.name}</strong>
            <span>${template.description}</span>
            <small>${template.badge}</small>
          </button>
        `).join('')}
      </div>
    </section>
  `;
}

function renderSymptomPicker(template) {
  if (!template) {
    return `
      <section class="panel empty-panel">
        <div class="panel-header"><span class="eyebrow">SymptomPicker</span><h3>Pick the symptom</h3></div>
        <p>${PRODUCT_COPY.emptyStates.symptom}</p>
      </section>
    `;
  }

  return `
    <section class="panel">
      <div class="panel-header"><span class="eyebrow">SymptomPicker</span><h3>Pick the failure symptom</h3></div>
      <p class="panel-copy">Use the symptom you actually see on the bench so ProbePath can choose the right first measurement.</p>
      <div class="symptom-list">
        ${template.supportedSymptoms.map((symptomId) => {
          const symptom = findSymptom(symptomId);
          return `
            <button class="symptom-chip ${symptomId === state.selectedSymptomId ? 'is-active' : ''}" data-action="select-symptom" data-symptom-id="${symptomId}">
              <strong>${symptom.label}</strong>
              <span>${symptom.description}</span>
            </button>
          `;
        }).join('')}
      </div>
      <div class="template-footnote">${template.caution}</div>
    </section>
  `;
}

function renderFeaturedDemoCard() {
  return `
    <section class="panel">
      <div class="panel-header"><span class="eyebrow">Featured demo</span><h3>${featuredDemo.title}</h3></div>
      <p class="panel-copy">${featuredDemo.story}</p>
      <div class="bench-note">
        <strong>Memorable walkthrough</strong>
        <span>Open the MCU brownout case to see ProbePath jump from symptom to measurement plan to likely fix in one click.</span>
      </div>
      <div class="action-row">
        <button class="primary-button" data-action="load-demo" data-demo-id="${featuredDemo.id}">Open featured demo</button>
      </div>
    </section>
  `;
}

function renderViewerPanel(template, analysis, step) {
  if (!template) {
    return `
      <section class="panel empty-panel">
        <div class="panel-header"><span class="eyebrow">CircuitViewer</span><h3>Circuit map</h3></div>
        <p>${PRODUCT_COPY.emptyStates.viewer}</p>
      </section>
    `;
  }

  return `
    <section class="panel">
      <div class="panel-header"><span class="eyebrow">CircuitViewer</span><h3>${template.name}</h3></div>
      <div class="viewer-head">
        <p>${template.description}</p>
        <div class="pill-row">${template.expectedNodes.map((node) => `<span class="info-pill"><strong>${node.label}:</strong> ${node.value}</span>`).join('')}</div>
      </div>
      ${renderDiagram(template, analysis, step?.id)}
      <div class="viewer-note">Highlighted nodes show where ProbePath wants you to probe next.</div>
    </section>
  `;
}

function renderFaultPanel(analysis) {
  if (!analysis) {
    return `<section class="panel empty-panel"><div class="panel-header"><span class="eyebrow">FaultRankingPanel</span><h3>Likely faults</h3></div><p>${PRODUCT_COPY.emptyStates.faults}</p></section>`;
  }

  return `<section class="panel"><div class="panel-header"><span class="eyebrow">FaultRankingPanel</span><h3>Likely faults</h3></div>${analysis.faults.map((fault, index) => `<article class="fault-card ${index === 0 ? 'top' : ''}"><div class="fault-head"><strong>${fault.label}</strong><span>${fault.confidence}%</span></div><div class="confidence-bar"><span style="width:${fault.confidence}%"></span></div><p>${fault.description}</p><small>${fault.confidenceLabel}</small>${fault.evidence.length ? `<ul class="micro-list">${fault.evidence.map((evidence) => `<li>${evidence}</li>`).join('')}</ul>` : ''}</article>`).join('')}</section>`;
}

function renderFixPanel(analysis) {
  if (!analysis) {
    return `<section class="panel empty-panel"><div class="panel-header"><span class="eyebrow">SuggestedFixesPanel</span><h3>Suggested fixes</h3></div><p>${PRODUCT_COPY.emptyStates.fixes}</p></section>`;
  }

  return `<section class="panel"><div class="panel-header"><span class="eyebrow">SuggestedFixesPanel</span><h3>Suggested fixes</h3></div>${analysis.faults.slice(0, 3).map((fault) => `<article class="fix-card"><strong>${fault.label}</strong><div class="pill-row">${fault.fixes.map((fix) => `<span class="fix-pill">${fix}</span>`).join('')}</div></article>`).join('')}</section>`;
}

function renderSummaryPanel(analysis) {
  if (!analysis) {
    return `<section class="panel empty-panel"><div class="panel-header"><span class="eyebrow">DiagnosisSummaryPage</span><h3>Summary</h3></div><p>${PRODUCT_COPY.emptyStates.summary}</p></section>`;
  }

  const exportSummary = analysis.report.exportSummary;

  return `
    <section class="panel summary-panel">
      <div class="panel-header"><span class="eyebrow">DiagnosisSummaryPage</span><h3>${analysis.summary.headline}</h3></div>
      <p>${analysis.summary.detail}</p>
      <div class="facts compact">
        <div><label>Progress</label><span>${analysis.answeredCount}/${analysis.steps.length} readings</span></div>
        <div><label>Top suspect</label><span>${analysis.faults[0]?.label ?? 'Waiting for evidence'}</span></div>
        <div><label>Current confidence</label><span>${analysis.faults[0]?.confidence ?? 0}%</span></div>
      </div>
      <div class="export-card">
        <span class="eyebrow">${PRODUCT_COPY.exportTitle}</span>
        <h4>${exportSummary.oneLine}</h4>
        <p>${PRODUCT_COPY.exportBody}</p>
        <div class="facts compact">
          <div><label>Most likely issue</label><span>${exportSummary.likelyIssue}</span></div>
          <div><label>Next measurement</label><span>${exportSummary.nextProbe}</span></div>
          <div><label>First fix to try</label><span>${exportSummary.firstFix}</span></div>
        </div>
      </div>
      ${analysis.healthyObservations.length ? `<div class="healthy-box"><strong>Healthy signals</strong><ul class="micro-list">${analysis.healthyObservations.map((item) => `<li>${item}</li>`).join('')}</ul></div>` : ''}
      <div class="action-row">
        <button class="primary-button" data-action="save-report">${state.shareState.status === 'saving' ? 'Saving...' : 'Save shareable report'}</button>
        <button class="ghost-button" data-action="download-report">Export bench summary</button>
      </div>
      ${state.shareState.status === 'saved' ? `<div class="share-banner"><strong>Shareable report ready.</strong><span>${state.shareState.message}</span><div class="action-row"><button class="ghost-button" data-action="copy-link">Copy link</button><a class="ghost-button link-button" href="${state.shareState.url}" target="_blank" rel="noreferrer">Open report</a></div></div>` : ''}
      ${state.shareState.status === 'error' ? `<div class="error-banner">${state.shareState.message}</div>` : ''}
    </section>
  `;
}

function renderDemoPanel() {
  return `<section class="panel"><div class="panel-header"><span class="eyebrow">Seeded demos</span><h3>Try a memorable example</h3></div><p class="panel-copy">These polished cases are ready for a quick walkthrough without typing measurements manually.</p><div class="demo-list">${DEMO_CASES.map((demo) => `<button class="demo-card ${demo.id === featuredDemo.id ? 'featured' : ''}" data-action="load-demo" data-demo-id="${demo.id}"><small>${demo.subtitle}</small><strong>${demo.title}</strong><span>${demo.story}</span></button>`).join('')}</div></section>`;
}

function renderHistoryPanel() {
  return `<section class="panel"><div class="panel-header"><span class="eyebrow">Diagnosis history</span><h3>Recent sessions</h3></div>${state.localHistory.length ? `<div class="history-list">${state.localHistory.map((entry) => `<button class="history-card" data-action="load-history" data-history-id="${entry.id}"><strong>${entry.title}</strong><span>${entry.topFault}</span><small>${relativeTimeLabel(entry.updatedAt)}</small></button>`).join('')}</div>` : `<p class="empty-copy">${PRODUCT_COPY.emptyStates.history}</p>`}${state.savedReports.length ? `<div class="saved-list"><label>Saved reports</label>${state.savedReports.map((report) => `<a class="history-card saved" href="${report.url}" target="_blank" rel="noreferrer"><strong>${report.title}</strong><span>${report.topFault}</span><small>${report.createdAtLabel}</small></a>`).join('')}</div>` : ''}</section>`;
}

function renderPathSummary(template, analysis) {
  const symptom = analysis?.symptom ?? currentSymptom();
  const items = [];

  if (template) {
    items.push(`<span class="info-pill"><strong>Circuit:</strong> ${template.name}</span>`);
  }

  if (symptom) {
    items.push(`<span class="info-pill"><strong>Symptom:</strong> ${symptom.label}</span>`);
  }

  if (analysis) {
    items.push(`<span class="info-pill"><strong>Progress:</strong> ${analysis.answeredCount}/${analysis.steps.length} readings</span>`);
  }

  return items.length ? `<div class="wizard-context">${items.join('')}</div>` : '';
}

function renderCircuitGuideCard(template) {
  if (!template) {
    return '';
  }

  return `
    <section class="panel">
      <div class="panel-header"><span class="eyebrow">Selected circuit</span><h3>${template.name}</h3></div>
      <p class="panel-copy">${template.description}</p>
      <div class="pill-row">${template.expectedNodes.map((node) => `<span class="info-pill"><strong>${node.label}:</strong> ${node.value}</span>`).join('')}</div>
      <div class="template-footnote">${template.caution}</div>
    </section>
  `;
}

function renderBenchPrepPanel(analysis) {
  if (!analysis?.scenario.prep?.length) {
    return '';
  }

  return `
    <section class="panel">
      <div class="panel-header"><span class="eyebrow">Bench setup</span><h3>Set up the failing condition first</h3></div>
      <ul class="micro-list">${analysis.scenario.prep.map((item) => `<li>${item}</li>`).join('')}</ul>
    </section>
  `;
}

function renderProbeInsightPanel(analysis) {
  if (!analysis || !analysis.answeredCount) {
    return `
      <section class="panel empty-panel">
        <div class="panel-header"><span class="eyebrow">Fault preview</span><h3>Likely fault path appears here</h3></div>
        <p>${PRODUCT_COPY.emptyStates.faults}</p>
      </section>
    `;
  }

  const topFault = analysis.faults[0];
  const topFix = topFault?.fixes?.[0] ?? 'Take another reading to narrow the issue.';

  return `
    <section class="panel">
      <div class="panel-header"><span class="eyebrow">Fault preview</span><h3>${topFault?.label ?? 'Waiting for evidence'}</h3></div>
      <div class="confidence-bar"><span style="width:${topFault?.confidence ?? 0}%"></span></div>
      <div class="facts compact">
        <div><label>Confidence</label><span>${topFault?.confidence ?? 0}%</span></div>
        <div><label>Next measurement</label><span>${analysis.nextStep?.title ?? 'All planned readings captured'}</span></div>
        <div><label>First fix to try</label><span>${topFix}</span></div>
      </div>
      ${topFault?.evidence?.length ? `<ul class="micro-list">${topFault.evidence.map((item) => `<li>${item}</li>`).join('')}</ul>` : ''}
    </section>
  `;
}

function renderWizardFooter(stage, analysis) {
  const symptom = currentSymptom();
  const nextMap = {
    1: {
      label: 'Continue to symptom',
      stage: 2,
      enabled: Boolean(state.selectedTemplateId),
      hint: state.selectedTemplateId ? `Next: choose the symptom for ${currentTemplate()?.name}.` : 'Pick the closest circuit family to unlock matching symptoms.'
    },
    2: {
      label: 'Continue to probe',
      stage: 3,
      enabled: Boolean(symptom),
      hint: symptom ? `Next: ProbePath will ask one measurement question at a time for "${symptom.label}".` : 'Choose the failure symptom you actually see on the bench.'
    },
    3: {
      label: analysis?.complete ? 'Review final report' : 'Review current report',
      stage: 4,
      enabled: Boolean(analysis?.answeredCount),
      hint: analysis?.answeredCount ? 'You can keep refining the diagnosis or move to the report view.' : 'Enter the first reading to unlock the report stage.'
    },
    4: {
      label: '',
      stage: null,
      enabled: false,
      hint: 'Save the shareable report or go back to edit a measurement.'
    }
  };
  const next = nextMap[stage];
  const backStage = stage > 1 ? stage - 1 : null;

  return `
    <div class="wizard-footer">
      <div class="wizard-footer-copy">${next.hint}</div>
      <div class="action-row">
        ${backStage ? `<button class="ghost-button" data-action="set-stage" data-stage="${backStage}">Back</button>` : ''}
        ${next.stage ? `<button class="primary-button" data-action="set-stage" data-stage="${next.stage}" ${next.enabled ? '' : 'disabled'}>${next.label}</button>` : ''}
      </div>
    </div>
  `;
}

function renderCircuitStage(template) {
  return `
    <div class="wizard-stage">
      ${renderPathSummary(template)}
      <div class="wizard-layout wizard-layout-circuit">
        <div class="wizard-main">${renderTemplatePicker()}</div>
        <div class="wizard-side">${renderFeaturedDemoCard()}${renderHistoryPanel()}</div>
      </div>
      ${renderWizardFooter(1)}
    </div>
  `;
}

function renderSymptomStage(template) {
  return `
    <div class="wizard-stage">
      ${renderPathSummary(template)}
      <div class="wizard-layout wizard-layout-split">
        <div class="wizard-main">${renderSymptomPicker(template)}</div>
        <div class="wizard-side">${renderCircuitGuideCard(template)}${renderViewerPanel(template, null, null)}</div>
      </div>
      ${renderWizardFooter(2)}
    </div>
  `;
}

function renderProbeStage(template, analysis) {
  if (!analysis) {
    return `
      <div class="wizard-stage">
        <section class="panel empty-panel">
          <div class="panel-header"><span class="eyebrow">3. Probe</span><h3>One question at a time</h3></div>
          <p>${PRODUCT_COPY.emptyStates.probe}</p>
        </section>
      </div>
    `;
  }

  const step = currentStep(analysis);
  const testPoint = analysis.template.testPoints.find((point) => point.id === step.testPointId);
  const slider = measurementSliderConfig(step);
  const stepNumber = analysis.steps.findIndex((item) => item.id === step.id) + 1;

  return `
    <div class="wizard-stage">
      ${renderPathSummary(template, analysis)}
      <div class="wizard-layout wizard-layout-probe">
        <div class="wizard-main">${renderViewerPanel(template, analysis, step)}${renderBenchPrepPanel(analysis)}</div>
        <div class="wizard-side">
          <section class="panel">
            <div class="panel-header"><span class="eyebrow">ProbeStepCard</span><h3>${step.title}</h3></div>
            <div class="step-kicker">Reading ${stepNumber} of ${analysis.steps.length}</div>
            <p class="panel-copy">${step.question}</p>
            <div class="facts compact">
              <div><label>Probe node</label><span>${testPoint?.label ?? step.title}</span></div>
              <div><label>Expected</label><span>${testPoint?.expected ?? 'See notes below'}</span></div>
              <div><label>Tool</label><span>${step.instrument}</span></div>
            </div>
            <div class="bench-note"><strong>Why this reading matters</strong><span>${step.tooltip}</span></div>
            <ul class="micro-list">${step.guide.map((item) => `<li>${item}</li>`).join('')}</ul>
            <form class="measurement-form slider-form" data-action="save-measurement" data-step-id="${step.id}">
              <label class="slider-label">
                <span>Adjust the slider to match your reading</span>
              </label>
              <div class="slider-card">
                <div class="slider-head">
                  <div class="slider-reading">
                    <label>Measured value</label>
                    <strong class="slider-live-value" data-slider-output>${slider.displayValue}</strong>
                  </div>
                  <span>${step.unit} via ${step.instrument}</span>
                </div>
                <input class="measurement-slider" data-slider-value data-step-id="${step.id}" data-unit="${step.unit}" name="value" type="range" min="${slider.min}" max="${slider.max}" step="${slider.step}" value="${slider.value}">
                <div class="slider-scale"><span>${slider.minLabel}</span><span>${slider.maxLabel}</span></div>
              </div>
              <div class="action-row">
                <button class="primary-button" type="submit">Update diagnosis</button>
                ${step.answered ? `<button class="ghost-button" type="button" data-action="clear-measurement" data-step-id="${step.id}">Clear reading</button>` : ''}
              </div>
            </form>
            <div class="step-status status-${step.status.tone}">${step.answered ? `${step.status.label}: ${step.status.detail}` : 'Pending: move the slider until it matches your measurement, then update the diagnosis.'}</div>
          </section>
          <section class="panel">
            <div class="panel-header"><span class="eyebrow">Question queue</span><h3>One question at a time</h3></div>
            <div class="step-list">
              ${analysis.steps.map((item, index) => `
                <button class="step-chip ${item.id === step.id ? 'is-active' : ''} ${item.answered ? 'is-complete' : ''}" data-action="focus-step" data-step-id="${item.id}">
                  <span>0${index + 1}</span>
                  <strong>${item.title}</strong>
                  <small>${item.answered ? 'Measured' : 'Pending'}</small>
                </button>
              `).join('')}
            </div>
          </section>
          ${renderProbeInsightPanel(analysis)}
        </div>
      </div>
      ${renderWizardFooter(3, analysis)}
    </div>
  `;
}

function renderReportStage(template, analysis) {
  return `
    <div class="wizard-stage">
      ${renderPathSummary(template, analysis)}
      <div class="wizard-layout wizard-layout-report">
        <div class="wizard-main">${renderSummaryPanel(analysis)}${renderHistoryPanel()}</div>
        <div class="wizard-side">${renderFaultPanel(analysis)}${renderFixPanel(analysis)}</div>
      </div>
      ${renderWizardFooter(4, analysis)}
    </div>
  `;
}

function renderHero() {
  return `
    <section class="hero">
      <div class="hero-copy">
        <span class="hero-badge">${PRODUCT_COPY.heroBadge}</span>
        <h1>${PRODUCT_COPY.heroTitle}</h1>
        <p class="hero-one-line">${PRODUCT_COPY.oneSentence}</p>
        <p>${PRODUCT_COPY.heroBody}</p>
        <div class="action-row">
          <button class="primary-button" data-action="scroll-diagnosis">Start diagnosis</button>
          <button class="ghost-button" data-action="load-demo" data-demo-id="${featuredDemo.id}">Open featured demo</button>
        </div>
        <div class="hero-stats"><span><strong>${CIRCUIT_TEMPLATES.length}</strong> guided templates</span><span><strong>${DEMO_CASES.length}</strong> seeded walkthroughs</span><span><strong>No login</strong> for demo mode</span></div>
        <div class="hero-trust">${PRODUCT_COPY.heroTrust}</div>
        ${renderFeatureCards()}
      </div>
      <div class="hero-preview">
        <div class="preview-card">
          <small>Featured demo scenario</small>
          <h3>${featuredDemo.title}</h3>
          <p>${featuredDemo.story}</p>
          <div class="preview-meter"><label>Probe next</label><strong>Battery sag, regulator input, 3.3 V dip</strong></div>
          <div class="preview-meter"><label>Reading that stands out</label><strong>3.3 V rail dips to 2.68 V</strong></div>
          <div class="preview-meter"><label>Likely fault path</label><strong>Missing bulk cap plus noisy shared return</strong></div>
        </div>
      </div>
    </section>
  `;
}

function renderWorkspace() {
  const template = currentTemplate();
  const analysis = currentAnalysis();
  const stage = activeWizardStage(analysis);
  const stageDetails = {
    1: {
      eyebrow: '1. Circuit',
      title: 'Choose the circuit you are debugging',
      body: 'Start with the closest low-voltage circuit family. Keeping the scope tight makes the guidance clearer and more trustworthy.'
    },
    2: {
      eyebrow: '2. Symptom',
      title: 'Name the failure you actually see',
      body: 'Choose the symptom on the bench, not the fix you suspect. ProbePath uses that symptom to pick the first useful measurement.'
    },
    3: {
      eyebrow: '3. Probe',
      title: 'Answer one measurement question at a time',
      body: 'ProbePath now asks for the next reading only. Adjust the slider until it matches your meter or scope, then update the diagnosis.'
    },
    4: {
      eyebrow: '4. Report',
      title: 'Review the likely fault path and next fix',
      body: 'See the ranked causes, specific fixes to try, and a concise summary you can export or share.'
    }
  };
  const currentStage = stageDetails[stage];
  const unlockedStage = highestUnlockedStage(analysis);
  const stageContent = {
    1: renderCircuitStage(template),
    2: renderSymptomStage(template),
    3: renderProbeStage(template, analysis),
    4: renderReportStage(template, analysis)
  };
  const progressSteps = [
    { stage: 1, label: '1. Circuit' },
    { stage: 2, label: '2. Symptom' },
    { stage: 3, label: '3. Probe' },
    { stage: 4, label: '4. Report' }
  ];

  return `
    <section id="diagnosis" class="workspace">
      <div class="section-heading">
        <div>
          <span class="eyebrow">${currentStage.eyebrow}</span>
          <h2>${currentStage.title}</h2>
          <p>${currentStage.body}</p>
        </div>
        <button class="ghost-button" data-action="reset-diagnosis">Start fresh</button>
      </div>
      <div class="progress-strip">
        ${progressSteps.map((item) => `
          <button class="progress-pill ${item.stage < stage ? 'done' : ''} ${item.stage === stage ? 'is-active' : ''} ${item.stage > unlockedStage ? 'is-locked' : ''}" data-action="set-stage" data-stage="${item.stage}" ${item.stage > unlockedStage ? 'disabled' : ''}>${item.label}</button>
        `).join('')}
      </div>
      ${stageContent[stage]}
    </section>
  `;
}

function render() {
  root.innerHTML = `<div class="page-shell"><header class="topbar"><a class="brand" href="/">ProbePath</a><div class="topbar-actions"><span class="top-badge">${PRODUCT_COPY.oneSentence}</span><button class="ghost-button" data-action="scroll-diagnosis">Start diagnosis</button></div></header><main>${renderHero()}${renderWorkspace()}</main></div>`;
}

async function loadServerHistory() {
  try {
    const response = await fetch('/api/history');
    if (!response.ok) {
      throw new Error('API unavailable');
    }

    const data = await response.json();
    const reports = Array.isArray(data.reports) ? data.reports : [];
    state.savedReports = normalizeSavedReports(reports);
    render();
  } catch {
    state.savedReports = normalizeSavedReports(loadLocalSavedReports());
    render();
  }
}

function loadDemo(demoId) {
  const demo = DEMO_CASES.find((item) => item.id === demoId);
  if (!demo) {
    return;
  }

  beginSession();
  state.selectedTemplateId = demo.templateId;
  state.selectedSymptomId = demo.symptomId;
  state.measurements = { ...demo.presetMeasurements };
  state.focusStepId = null;
  state.sliderDrafts = {};
  state.wizardStage = 4;
  resetShareState();
  upsertHistory(demo.title);
  render();
  document.querySelector('#diagnosis')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function downloadReport() {
  const analysis = currentAnalysis();
  if (!analysis) {
    return;
  }

  const blob = new Blob([exportSummaryText(analysis)], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `probepath-${analysis.template.id}-summary.txt`;
  link.click();
  URL.revokeObjectURL(url);
}

async function saveReport() {
  const analysis = currentAnalysis();
  if (!analysis || state.shareState.status === 'saving') {
    return;
  }

  state.shareState = { status: 'saving', url: null, message: '' };
  render();

  try {
    const createdAt = new Date().toISOString();
    const localId = window.crypto?.randomUUID?.().slice(0, 10) ?? `report-${Date.now()}`;
    const payload = {
      title: analysis.scenario.title,
      templateId: analysis.template.id,
      templateName: analysis.template.name,
      symptomId: analysis.symptom.id,
      symptomLabel: analysis.symptom.label,
      createdAt,
      summary: analysis.summary,
      report: analysis.report
    };

    const response = await fetch('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error('Could not save the report.');
    }

    const data = await response.json();
    const absoluteUrl = absoluteUrlFor(data.url);
    state.shareState = { status: 'saved', url: data.url, message: absoluteUrl };
    await loadServerHistory();
    render();
  } catch (error) {
    const createdAt = new Date().toISOString();
    const localId = window.crypto?.randomUUID?.().slice(0, 10) ?? `report-${Date.now()}`;
    const localRecord = {
      id: localId,
      title: analysis.scenario.title,
      templateId: analysis.template.id,
      templateName: analysis.template.name,
      symptomId: analysis.symptom.id,
      symptomLabel: analysis.symptom.label,
      createdAt,
      url: reportLinkForId(localId),
      topFault: analysis.faults[0]?.label ?? 'Need more measurements',
      summary: analysis.summary,
      report: analysis.report
    };
    const existing = loadLocalSavedReports().filter((report) => report.id !== localRecord.id);
    saveLocalSavedReports([localRecord, ...existing]);
    state.savedReports = normalizeSavedReports([localRecord, ...existing]);
    const localUrl = reportLinkForId(localId);
    state.shareState = { status: 'saved', url: localUrl, message: absoluteUrlFor(localUrl) };
    render();
  }
}

root.addEventListener('click', async (event) => {
  const trigger = event.target.closest('[data-action]');
  if (!trigger) {
    return;
  }

  const { action } = trigger.dataset;

  if (action === 'scroll-diagnosis') {
    document.querySelector('#diagnosis')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  if (action === 'set-stage') {
    setWizardStage(Number(trigger.dataset.stage));
    render();
  }

  if (action === 'select-template') {
    beginSession();
    state.selectedTemplateId = trigger.dataset.templateId;
    state.selectedSymptomId = null;
    state.measurements = {};
    state.focusStepId = null;
    state.sliderDrafts = {};
    state.wizardStage = 2;
    resetShareState();
    render();
  }

  if (action === 'select-symptom') {
    if (!state.sessionKey) {
      beginSession();
    }
    state.selectedSymptomId = trigger.dataset.symptomId;
    state.measurements = {};
    state.focusStepId = null;
    state.sliderDrafts = {};
    state.wizardStage = 3;
    resetShareState();
    upsertHistory('Manual diagnosis');
    render();
  }

  if (action === 'focus-step') {
    state.focusStepId = trigger.dataset.stepId;
    state.wizardStage = 3;
    render();
  }

  if (action === 'clear-measurement') {
    delete state.measurements[trigger.dataset.stepId];
    delete state.sliderDrafts[trigger.dataset.stepId];
    state.focusStepId = trigger.dataset.stepId;
    state.wizardStage = 3;
    resetShareState();
    upsertHistory('Manual diagnosis');
    render();
  }

  if (action === 'reset-diagnosis') {
    beginSession();
    state.selectedTemplateId = null;
    state.selectedSymptomId = null;
    state.measurements = {};
    state.focusStepId = null;
    state.sliderDrafts = {};
    state.wizardStage = 1;
    resetShareState();
    render();
  }

  if (action === 'load-demo') {
    loadDemo(trigger.dataset.demoId);
  }

  if (action === 'load-history') {
    const entry = state.localHistory.find((item) => item.id === trigger.dataset.historyId);
    if (!entry) {
      return;
    }

    beginSession();
    state.selectedTemplateId = entry.templateId;
    state.selectedSymptomId = entry.symptomId;
    state.measurements = { ...entry.measurements };
    state.focusStepId = null;
    state.sliderDrafts = {};
    state.wizardStage = Object.keys(entry.measurements ?? {}).length ? 4 : 3;
    resetShareState();
    render();
  }

  if (action === 'download-report') {
    downloadReport();
  }

  if (action === 'save-report') {
    state.wizardStage = 4;
    await saveReport();
  }

  if (action === 'copy-link' && state.shareState.message) {
    await navigator.clipboard.writeText(state.shareState.message);
  }
});

root.addEventListener('input', (event) => {
  const slider = event.target.closest('input[data-slider-value]');
  if (!slider) {
    return;
  }

  const value = Number(slider.value);
  state.sliderDrafts[slider.dataset.stepId] = value;
  const liveValue = slider.closest('.slider-card')?.querySelector('[data-slider-output]');

  if (liveValue) {
    liveValue.textContent = formatMeasurement(value, slider.dataset.unit ?? '');
  }
});

root.addEventListener('submit', (event) => {
  const form = event.target.closest('form[data-action="save-measurement"]');
  if (!form) {
    return;
  }

  event.preventDefault();
  const formData = new FormData(form);
  const stepId = form.dataset.stepId;
  const value = formData.get('value');

  if (value === null || value === '') {
    return;
  }

  state.measurements[stepId] = Number(value);
  delete state.sliderDrafts[stepId];
  const analysis = currentAnalysis();
  state.focusStepId = analysis?.nextStep?.id ?? stepId;
  state.wizardStage = analysis?.complete ? 4 : 3;
  resetShareState();
  upsertHistory('Manual diagnosis');
  render();
});

beginSession();
render();
loadServerHistory();
