// Demo prism_transform_layer: rotate a whole badge group around its center (before/after).
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const __dirname = dirname(fileURLToPath(import.meta.url));
const transport = new StdioClientTransport({ command: 'node', args: [resolve(__dirname, 'server.js')] });
const client = new Client({ name: 'transform-demo', version: '0.0.1' }, { capabilities: {} });
await client.connect(transport);
const call = async (n, a = {}) => { const r = await client.callTool({ name: n, arguments: a }); const t = r.content.find(c => c.type === 'text'); if (r.isError) console.log('[ERR]', n, t && t.text); let o = {}; try { o = JSON.parse(t.text); } catch {} return o; };
const add = async (t, a) => (await call(t, a)).id;
const grp = async (ids, name) => (await call('prism_group_layers', { ids, name })).groupId;

await call('prism_new_document', { width: 600, height: 440, background: '#0f1330' }); // dark bg (top-level, stays put)

// A badge group: navy card + coral accent bar in its top-left + title (asymmetric, so rotation is obvious)
const card = await add('prism_add_rectangle', { x: 170, y: 150, w: 260, h: 140, fill: '#1b2450', radius: 18, name: 'Card' });
const accent = await add('prism_add_rectangle', { x: 170, y: 150, w: 70, h: 14, fill: '#ff5f6d', name: 'Accent' });
const word = await add('prism_add_text', { text: 'AURORA', x: 194, y: 196, size: 40, color: '#ffffff', bold: true, name: 'Word' });
const badge = await grp([card, accent, word], 'Badge');

await call('prism_export_png', { path: resolve(__dirname, 'transform-before.png') });
console.log('before: upright badge');

// Rotate the whole Badge group 18° clockwise around its own center
await call('prism_transform_layer', { id: badge, rotate: 18 });

await call('prism_export_png', { path: resolve(__dirname, 'transform-after.png') });
console.log('after : Badge group rotated 18° as one unit');
await client.close();
process.exit(0);
