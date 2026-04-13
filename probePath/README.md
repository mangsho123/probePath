# ProbePath

ProbePath tells you where to measure next when your circuit does not work. A user picks a circuit template, chooses a failure symptom, enters real probe readings, and gets the next recommended measurement, ranked likely faults, and suggested fixes.

## Why it matters

Beginner and intermediate hardware builders often know **something is wrong** but do not know **what to measure next**. ProbePath narrows that gap. Instead of presenting a wall of theory, it turns common debugging flows into a guided, step-by-step experience that feels approachable in under 30 seconds.

## MVP scope

This version is intentionally limited to common educational and prototype circuits:

- Voltage divider
- Resistor network
- LED + transistor switch
- MOSFET switch
- Simple op-amp amplifier
- Regulator / power rail issue
- MCU + motor brownout issue
- Sensor-to-ADC front end

## How it works

1. Choose a circuit template.
2. Pick the failure symptom.
3. Probe the highlighted test point.
4. Enter the measured value.
5. Review the ranked fault causes and recommended next measurement.
6. Save a shareable report when you are done.

The diagnosis logic is rule-based for the MVP. Each circuit template includes expected node values, common faults, symptom mappings, recommended next probes, and concrete fix suggestions.

## Current architecture

- `app/index.html`: main app shell
- `app/report.html`: shareable report screen
- `app/assets/data.js`: circuit templates, symptoms, faults, and seeded example scenarios
- `app/assets/diagnosis-engine.js`: rule-based scoring and report generation
- `app/assets/app-main.js`: single-page UI workflow and client-side state
- `app/assets/report-main.js`: saved report rendering
- `app/assets/styles.css`: polished engineering-tool UI system
- `server/ProbePathTcpServer.ps1`: lightweight TCP-based static server + JSON API for saved reports
- `data/reports`: persisted shareable reports
- `start.ps1`: one-command launcher
- `.github/workflows/pages.yml`: GitHub Pages deployment workflow for the static app in `app/`

## Tech stack

### Running MVP in this workspace

- Frontend: modern browser app with ES modules, SVG circuit maps, and local state
- Backend: lightweight PowerShell TCP server for static hosting plus report persistence
- Data model: rule-based JSON-like template objects
- Storage: local JSON files for saved reports and local browser history for recent sessions

### Recommended production stack

If you want to take ProbePath further, the natural upgrade path is:

- Next.js or Remix
- TypeScript
- Tailwind or a design-system layer
- SQLite / Postgres for report persistence
- Shared diagnosis engine package for server + client reuse

## Seeded demo scenarios

- Why does my microcontroller reset when the motor starts?
- LED indicator stays dark
- 3.3 V rail droops under load
- Analog sensor reading is way off
- Op-amp output clips and wanders

## Run locally

From this folder:

```powershell
.\start.ps1
```

Then open:

- `http://localhost:5050/`

## Publish with GitHub

ProbePath can now run two ways:

- Local full demo mode with the PowerShell server and local JSON report saving
- Static GitHub Pages mode with browser-local saved reports and bench-summary export

### GitHub Pages setup

1. Create a GitHub repository and push this folder to the `main` branch.
2. In the repository settings, open **Pages** and set the source to **GitHub Actions**.
3. Push to `main` or run the `Deploy ProbePath to GitHub Pages` workflow manually.
4. GitHub Pages will publish the contents of the `app/` folder as the site.

### GitHub Pages behavior

- The app is fully usable as a static site.
- Saved reports are stored in the browser with `localStorage` instead of the PowerShell backend.
- Shareable report links work on the same browser/device where the report was saved.
- For true multi-user shared report URLs, use a hosted backend later.

## Notes

- No login is required.
- The app is optimized for a smooth demo and clear explanation, not universal circuit debugging.
- Shareable reports are local to the machine running the server.
