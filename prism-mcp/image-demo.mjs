// Demo prism_image_size: scale a badge up 180% — vector card + text re-render crisp (not resampled).
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const __dirname = dirname(fileURLToPath(import.meta.url));
const transport = new StdioClientTransport({ command: 'node', args: [resolve(__dirname, 'server.js')] });
const client = new Client({ name: 'image-demo', version: '0.0.1' }, { capabilities: {} });
await client.connect(transport);
const call = async (n, a = {}) => { const r = await client.callTool({ name: n, arguments: a }); const t = r.content.find(c => c.type === 'text'); if (r.isError) console.log('[ERR]', n, t && t.text); let o = {}; try { o = JSON.parse(t.text); } catch {} return o; };
const add = async (t, a) => (await call(t, a)).id;
const grp = async (ids, name) => (await call('prism_group_layers', { ids, name })).groupId;

// A compact badge on a transparent canvas
await call('prism_new_document', { width: 320, height: 130, background: 'transparent' });
const card = await add('prism_add_rectangle', { x: 0, y: 0, w: 320, h: 130, fill: '#1b2450', radius: 16, name: 'Card' });
const word = await add('prism_add_text', { text: 'AURORA', x: 24, y: 26, size: 40, color: '#ffffff', bold: true, name: 'Word' });
const sub = await add('prism_add_text', { text: 'design summit', x: 26, y: 84, size: 20, color: '#ffd24a', name: 'Sub' });
await grp([card, word, sub], 'Badge');

const b = await call('prism_info');
await call('prism_export_png', { path: resolve(__dirname, 'image-before.png') });
console.log('before:', b.width + 'x' + b.height);

// Image Size 180% — the whole image scales; vector shape + text re-render crisp at the new size
const res = await call('prism_image_size', { scale: 180 });
await call('prism_export_png', { path: resolve(__dirname, 'image-after.png') });
console.log('after :', res.width + 'x' + res.height, '(scaled 180%, vector/text stay crisp & editable)');
await client.close();
process.exit(0);
