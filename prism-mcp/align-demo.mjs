// Demo prism_align_layers: scatter badges, then align + distribute into a clean row (before/after).
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const __dirname = dirname(fileURLToPath(import.meta.url));
const transport = new StdioClientTransport({ command: 'node', args: [resolve(__dirname, 'server.js')] });
const client = new Client({ name: 'align-demo', version: '0.0.1' }, { capabilities: {} });
await client.connect(transport);
const call = async (n, a = {}) => { const r = await client.callTool({ name: n, arguments: a }); const t = r.content.find(c => c.type === 'text'); if (r.isError) console.log('[ERR]', n, t && t.text); let o = {}; try { o = JSON.parse(t.text); } catch {} return o; };
const add = async (t, a) => (await call(t, a)).id;

await call('prism_new_document', { width: 940, height: 320, background: 'transparent' });
await call('prism_add_rectangle', { x: 0, y: 0, w: 940, h: 320, fill: '#0f1330', name: 'BG' });

// Four badges of varying size, scattered vertically, first near left / last near right
const colors = ['#ff5f6d', '#ffd24a', '#3aa0ff', '#7bd88f'];
const specs = [
  { x: 40,  y: 40,  w: 150, h: 110 },
  { x: 300, y: 170, w: 190, h: 120 },
  { x: 560, y: 70,  w: 140, h: 150 },
  { x: 760, y: 150, w: 150, h: 120 },
];
const ids = [];
for (let i = 0; i < specs.length; i++) {
  const s = specs[i];
  ids.push(await add('prism_add_rectangle', { ...s, fill: colors[i], radius: 18, name: 'Badge ' + (i + 1) }));
}

await call('prism_export_png', { path: resolve(__dirname, 'align-before.png') });
console.log('scattered ->', 'align-before.png');

// Center them vertically on the canvas, and distribute their centers evenly horizontally
await call('prism_align_layers', { ids, align: 'vcenter', distribute: 'horizontal', relativeTo: 'canvas' });

await call('prism_export_png', { path: resolve(__dirname, 'align-after.png') });
console.log('aligned + distributed ->', 'align-after.png');
await client.close();
process.exit(0);
