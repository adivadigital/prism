// Demo prism_crop_to_content: a small badge in a big empty canvas, then trim to the artwork.
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const __dirname = dirname(fileURLToPath(import.meta.url));
const transport = new StdioClientTransport({ command: 'node', args: [resolve(__dirname, 'server.js')] });
const client = new Client({ name: 'crop-demo', version: '0.0.1' }, { capabilities: {} });
await client.connect(transport);
const call = async (n, a = {}) => { const r = await client.callTool({ name: n, arguments: a }); const t = r.content.find(c => c.type === 'text'); if (r.isError) console.log('[ERR]', n, t && t.text); let o = {}; try { o = JSON.parse(t.text); } catch {} return o; };
const add = async (t, a) => (await call(t, a)).id;

// Big 720x520 transparent canvas, small badge tucked off-center
await call('prism_new_document', { width: 720, height: 520, background: 'transparent' });
await add('prism_add_rectangle', { x: 430, y: 330, w: 230, h: 120, fill: '#1b2450', radius: 18, name: 'Badge' });
await add('prism_add_text', { text: 'AURORA', x: 452, y: 356, size: 34, color: '#ffffff', bold: true, name: 'Word' });
await add('prism_add_text', { text: 'summit', x: 454, y: 404, size: 20, color: '#ffd24a', name: 'Sub' });

const before = await call('prism_info');
await call('prism_export_png', { path: resolve(__dirname, 'crop-before.png') });
console.log('before:', before.width + 'x' + before.height, '(badge in a big empty canvas)');

// Trim the canvas to the artwork, with a 24px transparent margin
const res = await call('prism_crop_to_content', { padding: 24 });
await call('prism_export_png', { path: resolve(__dirname, 'crop-after.png') });
console.log('after :', res.width + 'x' + res.height, '(trimmed to content + 24px), croppedFrom', JSON.stringify(res.croppedFrom));
await client.close();
process.exit(0);
