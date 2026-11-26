import fs from 'node:fs';
import path from 'node:path';

// Read .env file without any external dependencies
const envPath = path.resolve(process.cwd(), '.env');
let grafanaUrl = '';

if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('VITE_GRAFANA_URL=')) {
      grafanaUrl = trimmed.slice('VITE_GRAFANA_URL='.length).trim();
      break;
    }
  }
}

if (!grafanaUrl) {
  console.error('Error: VITE_GRAFANA_URL not found in .env');
  process.exit(1);
}

let parsedUrl;
try {
  parsedUrl = new URL(grafanaUrl);
} catch (e) {
  console.error('Error: Invalid VITE_GRAFANA_URL in .env:', grafanaUrl);
  process.exit(1);
}

const origin = parsedUrl.origin;
// Match /d/<uid>/<slug> or /d-solo/<uid>/<slug>
const match = parsedUrl.pathname.match(/^\/(?:d|d-solo)\/([^/]+)/);
const uid = match ? match[1] : 'codebridge-analytics';

console.log(`Connecting to Grafana at: ${origin}`);
console.log(`Dashboard UID: ${uid}`);

async function discover() {
  try {
    const res = await fetch(`${origin}/api/dashboards/uid/${uid}`, {
      headers: { Accept: 'application/json' },
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    const dashboard = data.dashboard || {};
    const panelsList = [];

    let currentRow = '';
    const rawPanels = dashboard.panels || [];

    for (const p of rawPanels) {
      if (p.type === 'row') {
        currentRow = p.title || 'Untitled Row';
        if (Array.isArray(p.panels)) {
          for (const sub of p.panels) {
            panelsList.push({
              id: sub.id,
              title: sub.title || '(No title)',
              type: sub.type,
              rowTitle: currentRow,
              gridPos: sub.gridPos ? `h:${sub.gridPos.h} w:${sub.gridPos.w} x:${sub.gridPos.x} y:${sub.gridPos.y}` : '-',
            });
          }
        }
      } else {
        panelsList.push({
          id: p.id,
          title: p.title || '(No title)',
          type: p.type,
          rowTitle: currentRow || '-',
          gridPos: p.gridPos ? `h:${p.gridPos.h} w:${p.gridPos.w} x:${p.gridPos.x} y:${p.gridPos.y}` : '-',
        });
      }
    }

    const templating = (dashboard.templating?.list || []).map((t) => ({
      name: t.name,
      label: t.label || t.name,
      includeAll: Boolean(t.includeAll),
      current: t.current?.text || t.current?.value || '-',
    }));

    console.log('\n=== DISCOVERED GRAFANA PANELS ===');
    console.table(panelsList);

    console.log('\n=== TEMPLATE VARIABLES ===');
    console.table(templating);

    // Write docs/GRAFANA_PANELS.md
    const docsDir = path.resolve(process.cwd(), 'docs');
    if (!fs.existsSync(docsDir)) {
      fs.mkdirSync(docsDir, { recursive: true });
    }

    let md = `# Discovered Grafana Panels

**Dashboard Title:** ${dashboard.title || 'CodeBridge Platform Analytics'}
**Dashboard UID:** \`${uid}\`
**Origin:** \`${origin}\`
**Discovered At:** ${new Date().toISOString()}

## Panels

| ID | Title | Type | Row Title | Grid Position |
|---|---|---|---|---|
`;

    for (const p of panelsList) {
      md += `| ${p.id} | ${p.title} | \`${p.type}\` | ${p.rowTitle} | \`${p.gridPos}\` |\n`;
    }

    md += `\n## Template Variables\n\n| Name | Label | Include All | Current Value |\n|---|---|---|---|\n`;
    for (const t of templating) {
      md += `| \`${t.name}\` | ${t.label} | ${t.includeAll} | \`${t.current}\` |\n`;
    }

    const docPath = path.join(docsDir, 'GRAFANA_PANELS.md');
    fs.writeFileSync(docPath, md, 'utf-8');
    console.log(`\nSuccessfully wrote ${docPath}`);
  } catch (err) {
    console.error('Discovery failed:', err.message);
    const docsDir = path.resolve(process.cwd(), 'docs');
    if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });
    const docPath = path.join(docsDir, 'GRAFANA_PANELS.md');
    fs.writeFileSync(
      docPath,
      `# Discovered Grafana Panels (Failed)\n\nDiscovery failed: ${err.message}\nTo re-run:\n\`node scripts/discover-grafana-panels.mjs\`\n`,
      'utf-8'
    );
  }
}

discover();
