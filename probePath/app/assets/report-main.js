const root = document.querySelector('#reportApp');
const reportId = new URLSearchParams(window.location.search).get('id');
const savedReportsKey = 'probepath-saved-reports';

function loadLocalReport(id) {
  try {
    const reports = JSON.parse(window.localStorage.getItem(savedReportsKey) ?? '[]');
    if (!Array.isArray(reports)) {
      return null;
    }

    return reports.find((report) => report.id === id) ?? null;
  } catch {
    return null;
  }
}

function renderLoading() {
  root.innerHTML = '<div class="report-shell"><section class="panel"><h1>Opening saved bench summary...</h1><p>Loading the saved ProbePath report from the local server.</p></section></div>';
}

function renderError(message) {
  root.innerHTML = `<div class="report-shell"><section class="panel"><h1>Report unavailable</h1><p>${message}</p><a class="primary-button link-button" href="/">Back to ProbePath</a></section></div>`;
}

function renderReport(payload) {
  const topFault = payload.report?.rankedFaults?.[0];
  const exportSummary = payload.report?.exportSummary;

  root.innerHTML = `
    <div class="report-shell">
      <section class="panel report-hero">
        <div class="report-topbar">
          <a class="ghost-button link-button" href="/">Back to app</a>
          <button class="ghost-button" id="printReport">Print / Save PDF</button>
        </div>
        <span class="eyebrow">Saved ProbePath report</span>
        <h1>${payload.title}</h1>
        <p>${payload.summary?.detail ?? payload.report?.narrative ?? ''}</p>
        <div class="facts compact">
          <div><label>Circuit</label><span>${payload.templateName}</span></div>
          <div><label>Symptom</label><span>${payload.symptomLabel}</span></div>
          <div><label>Top fault</label><span>${topFault?.label ?? 'Not available'}</span></div>
        </div>
      </section>
      ${exportSummary ? `
        <section class="panel export-card">
          <span class="eyebrow">${exportSummary.title}</span>
          <h3>${exportSummary.oneLine}</h3>
          <div class="facts compact">
            <div><label>Most likely issue</label><span>${exportSummary.likelyIssue}</span></div>
            <div><label>Next measurement</label><span>${exportSummary.nextProbe}</span></div>
            <div><label>First fix to try</label><span>${exportSummary.firstFix}</span></div>
          </div>
        </section>
      ` : ''}
      <section class="panel">
        <div class="panel-header"><span class="eyebrow">Measurements</span><h3>Captured readings</h3></div>
        <div class="report-list">
          ${payload.report.measurements.map((measurement) => `<article class="report-row"><strong>${measurement.title}</strong><span>${measurement.formattedValue}</span><small>${measurement.status}. ${measurement.detail}</small></article>`).join('')}
        </div>
      </section>
      <section class="panel">
        <div class="panel-header"><span class="eyebrow">Ranked causes</span><h3>Likely fault path</h3></div>
        ${payload.report.rankedFaults.slice(0, 4).map((fault) => `<article class="fault-card top"><div class="fault-head"><strong>${fault.label}</strong><span>${fault.confidence}%</span></div><div class="confidence-bar"><span style="width:${fault.confidence}%"></span></div><p>${fault.description}</p>${fault.evidence?.length ? `<ul class="micro-list">${fault.evidence.map((item) => `<li>${item}</li>`).join('')}</ul>` : ''}<div class="pill-row">${fault.fixes.map((fix) => `<span class="fix-pill">${fix}</span>`).join('')}</div></article>`).join('')}
      </section>
      ${payload.report.healthyObservations?.length ? `<section class="panel"><div class="panel-header"><span class="eyebrow">Healthy checks</span><h3>What looked normal</h3></div><ul class="micro-list">${payload.report.healthyObservations.map((item) => `<li>${item}</li>`).join('')}</ul></section>` : ''}
      <section class="panel footer-note">
        <p>ProbePath is intentionally scoped to common low-voltage educational and prototype circuits. Treat this report as guided debugging support, not a universal circuit simulator.</p>
      </section>
    </div>
  `;

  document.querySelector('#printReport')?.addEventListener('click', () => window.print());
}

async function init() {
  if (!reportId) {
    renderError('No report ID was supplied in the URL.');
    return;
  }

  renderLoading();

  try {
    const response = await fetch(`/api/reports/${reportId}`);
    if (!response.ok) {
      throw new Error('API unavailable');
    }

    const payload = await response.json();
    renderReport(payload);
  } catch (error) {
    const localReport = loadLocalReport(reportId);
    if (localReport) {
      renderReport(localReport);
      return;
    }

    renderError(error.message === 'API unavailable' ? 'This report is not available in local browser storage.' : error.message);
  }
}

init();
