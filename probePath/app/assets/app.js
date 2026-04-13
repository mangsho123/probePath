import { CIRCUIT_TEMPLATES, DEMO_CASES, findSymptom, findTemplate } from './data.js';
import { evaluateDiagnosis, formatMeasurement } from './diagnosis-engine.js';

const root = document.querySelector('#app');
const historyKey = 'probepath-history';
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
        ${step ? `<foreignObject x="${point.x + 14}" y="${point.y + 4}" width="110" height="30"><div class="svg-reading">${formatMeasurement(step.value, step.unit)}</div></foreignObject>` : ''}
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

function renderProbePanel(analysis) {
  if (!analysis) {
    return `
      <section class="panel empty-panel">
        <div class="panel-header"><span class="eyebrow">ProbeStepCard</span><h3>Step-by-step probe guide</h3></div>
        <p>${PRODUCT_COPY.emptyStates.probe}</p>
      </section>
    `;
  }

  const step = currentStep(analysis);
  const testPoint = analysis.template.testPoints.find((point) => point.id === step.testPointId);
  return `
    <section class="panel">
      <div class="panel-header"><span class="eyebrow">ProbeStepCard</span><h3>${step.title}</h3></div>
      <div class="step-kicker">Next best measurement</div>
      <p class="panel-copy">${step.question}</p>
      <div class="facts">
        <div><label>Probe node</label><span>${testPoint?.label ?? step.title}</span></div>
        <div><label>Expected</label><span>${testPoint?.expected ?? 'See notes below'}</span></div>
        <div><label>Tool</label><span>${step.instrument}</span></div>
      </div>
      <div class="bench-note"><strong>Why this reading matters</strong><span>${step.tooltip}</span></div>
      <ul class="micro-list">${step.guide.map((item) => `<li>${item}</li>`).join('')}</ul>
      <form class="measurement-form" data-action="save-measurement" data-step-id="${step.id}">
        <label>
          <span>Measured value</span>
          <div class="input-wrap">
            <input name="value" type="number" step="any" value="${step.answered ? step.value : ''}" placeholder="${step.placeholder}">
            <span>${step.unit}</span>
          </div>
        </label>
        <div class="action-row">
          <button class="primary-button" type="submit">Update diagnosis</button>
          ${step.answered ? `<button class="ghost-button" type="button" data-action="clear-measurement" data-step-id="${step.id}">Clear reading</button>` : ''}
        </div>
      </form>
      <div class="step-status status-${step.status.tone}">${step.status.label}: ${step.status.detail}</div>
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
  `;
}

function renderWorkspace() {
  const template = currentTemplate();
  const analysis = currentAnalysis();
  const step = currentStep(analysis);
  const symptomCount = template?.supportedSymptoms.length ?? 0;

  return `
    <section id="diagnosis" class="workspace">
      <div class="section-heading">
        <div>
          <span class="eyebrow">NewDiagnosisPage</span>
          <h2>Guided diagnosis</h2>
          <p>${analysis ? analysis.summary.detail : 'Pick a circuit, choose the symptom, then follow the next best measurement.'}</p>
        </div>
        <button class="ghost-button" data-action="reset-diagnosis">Start fresh</button>
      </div>
      <div class="progress-strip">
        <div class="progress-pill ${template ? 'done' : ''}">1. Circuit</div>
        <div class="progress-pill ${symptomCount > 0 && state.selectedSymptomId ? 'done' : ''}">2. Symptom</div>
        <div class="progress-pill ${analysis?.answeredCount ? 'done' : ''}">3. Probe</div>
        <div class="progress-pill ${state.shareState.status === 'saved' ? 'done' : ''}">4. Report</div>
      </div>
      ${!template ? renderQuickStartPanel() : ''}
      <div class="workspace-grid">
        <div class="left-column">${renderTemplatePicker()}${renderSymptomPicker(template)}${renderDemoPanel()}</div>
        <div class="center-column">${renderViewerPanel(template, analysis, step)}${renderProbePanel(analysis)}${renderSummaryPanel(analysis)}</div>
        <div class="right-column">${renderFaultPanel(analysis)}${renderFixPanel(analysis)}${renderHistoryPanel()}</div>
      </div>
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

function renderHero() {
  return `
    <section class="hero">
      <div class="hero-copy">
        <span class="hero-badge">${PRODUCT_COPY.heroBadge}</span>
        <h1>ProbePath tells you where to measure next when your circuit doesn’t work.</h1>
        <p>Pick a simple circuit, choose the failure symptom, and ProbePath walks you through the next best probe with a multimeter or oscilloscope. It ranks likely faults as you enter real readings and ends with a report you can share.</p>
        <div class="action-row">
          <button class="primary-button" data-action="scroll-diagnosis">Start Diagnosis</button>
          <button class="ghost-button" data-action="load-demo" data-demo-id="demo-brownout">Load Featured Demo</button>
        </div>
        <div class="hero-stats"><span><strong>${CIRCUIT_TEMPLATES.length}</strong> guided templates</span><span><strong>${DEMO_CASES.length}</strong> seeded examples</span><span><strong>No login</strong> for demo mode</span></div>
      </div>
      <div class="hero-preview">
        <div class="preview-card">
          <small>Featured scenario</small>
          <h3>Why does my microcontroller reset when the motor starts?</h3>
          <div class="preview-meter"><label>3.3 V rail dip</label><strong>2.68 V</strong></div>
          <div class="preview-meter"><label>Top fault</label><strong>Missing bulk capacitance</strong></div>
          <div class="preview-meter"><label>Next fix</label><strong>Add bulk cap near driver + clean return path</strong></div>
        </div>
      </div>
    </section>
  `;
}

function render() {
  root.innerHTML = `<div class="page-shell"><header class="topbar"><a class="brand" href="/">ProbePath</a><div class="topbar-actions"><span class="top-badge">Supports common low-voltage educational and prototype circuits</span><button class="ghost-button" data-action="scroll-diagnosis">Start Diagnosis</button></div></header><main>${renderHero()}${renderWorkspace()}</main></div>`;
}

async function loadServerHistory() {
  try {
    const response = await fetch('/api/history');
    if (!response.ok) {
      return;
    }

    const data = await response.json();
    const reports = Array.isArray(data.reports) ? data.reports : [];
    state.savedReports = reports.map((report) => ({
      ...report,
      createdAtLabel: new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(report.createdAt))
    }));
    render();
  } catch {
    // Keep the app usable even if report history is unavailable.
  }
}

function loadDemo(demoId) {
  const demo = DEMO_CASES.find((item) => item.id === demoId);
  if (!demo) return;
  beginSession();
  state.selectedTemplateId = demo.templateId;
  state.selectedSymptomId = demo.symptomId;
  state.measurements = { ...demo.presetMeasurements };
  state.focusStepId = null;
  state.shareState = { status: 'idle', url: null, message: '' };
  upsertHistory(demo.title);
  render();
  document.querySelector('#diagnosis')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function downloadReport() {
  const analysis = currentAnalysis();
  if (!analysis) return;
  const payload = { createdAt: new Date().toISOString(), ...analysis.report };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `probepath-${analysis.template.id}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

async function saveReport() {
  const analysis = currentAnalysis();
  if (!analysis || state.shareState.status === 'saving') return;
  state.shareState = { status: 'saving', url: null, message: '' };
  render();
  try {
    const response = await fetch('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: analysis.scenario.title,
        templateId: analysis.template.id,
        templateName: analysis.template.name,
        symptomId: analysis.symptom.id,
        symptomLabel: analysis.symptom.label,
        createdAt: new Date().toISOString(),
        summary: analysis.summary,
        report: analysis.report
      })
    });
    if (!response.ok) throw new Error('Could not save the report.');
    const data = await response.json();
    state.shareState = { status: 'saved', url: data.url, message: data.url };
    await loadServerHistory();
    render();
  } catch (error) {
    state.shareState = { status: 'error', url: null, message: error.message };
    render();
  }
}

root.addEventListener('click', async (event) => {
  const trigger = event.target.closest('[data-action]');
  if (!trigger) return;
  const { action } = trigger.dataset;
  if (action === 'scroll-diagnosis') document.querySelector('#diagnosis')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  if (action === 'select-template') { beginSession(); state.selectedTemplateId = trigger.dataset.templateId; state.selectedSymptomId = null; state.measurements = {}; state.focusStepId = null; state.shareState = { status: 'idle', url: null, message: '' }; render(); }
  if (action === 'select-symptom') { if (!state.sessionKey) beginSession(); state.selectedSymptomId = trigger.dataset.symptomId; state.measurements = {}; state.focusStepId = null; state.shareState = { status: 'idle', url: null, message: '' }; upsertHistory('Manual diagnosis'); render(); }
  if (action === 'focus-step') { state.focusStepId = trigger.dataset.stepId; render(); }
  if (action === 'clear-measurement') { delete state.measurements[trigger.dataset.stepId]; state.focusStepId = trigger.dataset.stepId; upsertHistory('Manual diagnosis'); render(); }
  if (action === 'reset-diagnosis') { beginSession(); state.selectedTemplateId = null; state.selectedSymptomId = null; state.measurements = {}; state.focusStepId = null; state.shareState = { status: 'idle', url: null, message: '' }; render(); }
  if (action === 'load-demo') loadDemo(trigger.dataset.demoId);
  if (action === 'load-history') {
    const entry = state.localHistory.find((item) => item.id === trigger.dataset.historyId);
    if (!entry) return;
    beginSession();
    state.selectedTemplateId = entry.templateId;
    state.selectedSymptomId = entry.symptomId;
    state.measurements = { ...entry.measurements };
    state.focusStepId = null;
    state.shareState = { status: 'idle', url: null, message: '' };
    render();
  }
  if (action === 'download-report') downloadReport();
  if (action === 'save-report') await saveReport();
  if (action === 'copy-link' && state.shareState.url) await navigator.clipboard.writeText(new URL(state.shareState.url, window.location.origin).toString());
});

root.addEventListener('submit', (event) => {
  const form = event.target.closest('form[data-action="save-measurement"]');
  if (!form) return;
  event.preventDefault();
  const formData = new FormData(form);
  const stepId = form.dataset.stepId;
  const value = formData.get('value');
  if (value === null || value === '') return;
  state.measurements[stepId] = Number(value);
  state.focusStepId = null;
  state.shareState = { status: 'idle', url: null, message: '' };
  upsertHistory('Manual diagnosis');
  render();
});

beginSession();
render();
loadServerHistory();
