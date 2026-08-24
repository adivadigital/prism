// Rebuild the nested poster, duplicate the whole Poster group, and prove the copy is independent.
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const transport = new StdioClientTransport({ command: 'node', args: [resolve(__dirname, 'server.js')] });
const client = new Client({ name: 'poster-dup', version: '0.0.1' }, { capabilities: {} });
await client.connect(transport);
const call = async (n, a = {}) => { const r = await client.callTool({ name: n, arguments: a }); const t = r.content.find(c => c.type === 'text'); if (r.isError) console.log('  [ERROR]', n, t && t.text); let o = {}; try { o = JSON.parse(t.text); } catch {} return o; };
const add = async (t, a) => (await call(t, a)).id;
const grp = async (ids, name) => (await call('prism_group_layers', { ids, name })).groupId;

await call('prism_new_document', { width: 800, height: 1200, background: 'transparent' });
await call('prism_add_rectangle', { x: 0, y: 0, w: 800, h: 1200, fill: '#0f1330', name: 'BG' });
const gHeader = await grp([
  await add('prism_add_text', { text: 'AURORA', x: 70, y: 110, size: 96, color: '#ffffff', bold: true, name: 'Title' }),
  await add('prism_add_text', { text: 'DESIGN SUMMIT 2026', x: 74, y: 214, size: 30, color: '#ffd24a', bold: true, name: 'Subtitle' }),
  await add('prism_add_line', { x1: 74, y1: 276, x2: 420, y2: 276, color: '#ff5f6d', width: 5, name: 'Accent' }),
], 'Header');
const gCardA = await grp([
  await add('prism_add_rectangle', { x: 70, y: 340, w: 660, h: 250, fill: '#1b2450', radius: 20, name: 'A-bg' }),
  await add('prism_add_text', { text: 'Keynotes', x: 104, y: 372, size: 40, color: '#ffffff', bold: true, name: 'A-title' }),
  await add('prism_add_text', { text: 'Talks from the people shaping tools.', x: 104, y: 446, size: 24, color: '#cfd6ff', name: 'A-body' }),
], 'Card A');
const gCardB = await grp([
  await add('prism_add_rectangle', { x: 70, y: 650, w: 660, h: 250, fill: '#1b2450', radius: 20, name: 'B-bg' }),
  await add('prism_add_text', { text: 'Workshops', x: 104, y: 682, size: 40, color: '#ffffff', bold: true, name: 'B-title' }),
  await add('prism_add_text', { text: 'Hands-on sessions, small groups.', x: 104, y: 756, size: 24, color: '#cfd6ff', name: 'B-body' }),
], 'Card B');
const gContent = await grp([gCardA, gCardB], 'Content');
const gFooter = await grp([
  await add('prism_add_line', { x1: 70, y1: 1010, x2: 730, y2: 1010, color: '#3aa0ff', width: 3, name: 'Divider' }),
  await add('prism_add_text', { text: 'JUNE 12-14   ·   BERLIN   ·   aurora.design', x: 70, y: 1044, size: 26, color: '#cfd6ff', name: 'Info' }),
], 'Footer');
const gPoster = await grp([gHeader, gContent, gFooter], 'Poster');

// === Duplicate the whole Poster group ===
const dup = await call('prism_duplicate_layer', { id: gPoster });
console.log('duplicated Poster ->', dup.id, '(' + dup.name + '), direct children:', (dup.members || []).map(m => m.name).join(', '));

// Layer tree
const info = await call('prism_info');
const byParent = {}; for (const l of info.layers) (byParent[l.groupId || ''] ||= []).push(l);
const label = l => (l.type === 'group' ? '📂 ' : '• ') + l.name;
const tree = (key, d) => { for (const l of (byParent[key] || []).slice().reverse()) { console.log('   ' + '  '.repeat(d) + label(l)); if (l.type === 'group') tree(l.id, d + 1); } };
console.log('\nLayer tree (two independent Poster trees):'); tree('', 0);
console.log('\ngroup count:', info.layers.filter(l => l.type === 'group').length, '| total layers:', info.layers.length);

// Independence check: dim the COPY's Content, confirm the ORIGINAL's Content is untouched.
const copyContentId = (dup.members || []).find(m => m.name === 'Content').id;
await call('prism_set_layer_props', { id: copyContentId, opacity: 40 });
const info2 = await call('prism_info');
const op = id => info2.layers.find(l => l.id === id).opacity;
console.log('\nIndependence: original Content opacity =', op(gContent), '| copy Content opacity =', op(copyContentId));
await call('prism_set_layer_props', { id: copyContentId, opacity: 100 }); // restore

// Visual proof: HIDE the original Poster; the copy alone must render the full poster.
await call('prism_set_layer_props', { id: gPoster, visible: false });
const out = resolve(__dirname, 'poster-dup-copyonly.png');
await call('prism_export_png', { path: out });
await client.close();
console.log('\nSaved (original hidden, copy only):', out);
process.exit(0);
