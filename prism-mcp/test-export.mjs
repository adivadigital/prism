// End-to-end: build a small document with shapes + a drop-shadow effect, then save it to the
// Desktop as PSD, PDF, JPG and PNG over the MCP protocol (fresh server subprocess).
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { homedir } from 'node:os';
const __dirname = dirname(fileURLToPath(import.meta.url));
const DESK = resolve(homedir(), 'Desktop');
const transport = new StdioClientTransport({ command: 'node', args: [resolve(__dirname, 'server.js')] });
const client = new Client({ name: 'export-test', version: '0.0.1' }, { capabilities: {} });
await client.connect(transport);
const call = async (n, a = {}) => { const r = await client.callTool({ name: n, arguments: a }); const t = r.content.find(c => c.type === 'text'); if (r.isError) console.log('[ERR]', n, t && t.text); let o = {}; try { o = JSON.parse(t.text); } catch {} return o; };
const add = async (t, a) => (await call(t, a)).id;

await call('prism_new_document', { width: 640, height: 460, background: '#0f1730' });
const card = await add('prism_add_rectangle', { x: 90, y: 120, w: 300, h: 200, fill: '#ff5f6d', radius: 22, name: 'Card' });
await add('prism_add_ellipse', { cx: 470, cy: 190, rx: 90, ry: 90, fill: '#3aa0ff', name: 'Dot' });
await add('prism_add_text', { text: 'Prism', x: 120, y: 150, size: 84, color: '#ffd24a', bold: true, name: 'Word' });
// an effect: soft drop shadow on the card
await call('prism_set_layer_style', { effect: 'dropShadow', params: { enabled: true, distance: 14, size: 18, opacity: 70 }, id: card });

const targets = [
  { file: 'Prism Export Test.psd' },
  { file: 'Prism Export Test.pdf' },
  { file: 'Prism Export Test.jpg', quality: 0.92 },
  { file: 'Prism Export Test.png' },
];
for (const t of targets) {
  const res = await call('prism_export', { path: resolve(DESK, t.file), quality: t.quality });
  console.log(`saved ${t.file.padEnd(22)} → ${res.saved || res.error || '?'}  (${res.format || '?'}, ${res.bytes ?? '?'} bytes)`);
}
await client.close();
process.exit(0);
