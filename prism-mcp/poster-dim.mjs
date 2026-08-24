// Build a nested-group poster over the MCP protocol to test nesting end-to-end.
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const transport = new StdioClientTransport({ command: 'node', args: [resolve(__dirname, 'server.js')] });
const client = new Client({ name: 'poster-nested', version: '0.0.1' }, { capabilities: {} });
await client.connect(transport);

const call = async (name, args = {}) => {
  const r = await client.callTool({ name, arguments: args });
  const t = r.content.find(c => c.type === 'text');
  if (r.isError) console.log('  [ERROR]', name, t && t.text);
  let o = {}; try { o = JSON.parse(t.text); } catch {}
  return o;
};
const add = async (tool, args) => (await call(tool, args)).id;      // returns new layer id
const group = async (ids, name) => (await call('prism_group_layers', { ids, name })).groupId;

await call('prism_new_document', { width: 800, height: 1200, background: 'transparent' });

// Background
await call('prism_add_rectangle', { x: 0, y: 0, w: 800, h: 1200, fill: '#0f1330', name: 'BG' });

// --- Header ---
const hTitle = await add('prism_add_text', { text: 'AURORA', x: 70, y: 110, size: 96, color: '#ffffff', bold: true, name: 'Title' });
const hSub   = await add('prism_add_text', { text: 'DESIGN SUMMIT 2026', x: 74, y: 214, size: 30, color: '#ffd24a', bold: true, name: 'Subtitle' });
const hLine  = await add('prism_add_line', { x1: 74, y1: 276, x2: 420, y2: 276, color: '#ff5f6d', width: 5, name: 'Accent' });
const gHeader = await group([hTitle, hSub, hLine], 'Header');

// --- Content: two nested Card groups ---
const aBg   = await add('prism_add_rectangle', { x: 70, y: 340, w: 660, h: 250, fill: '#1b2450', radius: 20, name: 'A-bg' });
const aHead = await add('prism_add_text', { text: 'Keynotes', x: 104, y: 372, size: 40, color: '#ffffff', bold: true, name: 'A-title' });
const aBody = await add('prism_add_text', { text: 'Talks from the people shaping tools.', x: 104, y: 446, size: 24, color: '#cfd6ff', name: 'A-body' });
const gCardA = await group([aBg, aHead, aBody], 'Card A');

const bBg   = await add('prism_add_rectangle', { x: 70, y: 650, w: 660, h: 250, fill: '#1b2450', radius: 20, name: 'B-bg' });
const bHead = await add('prism_add_text', { text: 'Workshops', x: 104, y: 682, size: 40, color: '#ffffff', bold: true, name: 'B-title' });
const bBody = await add('prism_add_text', { text: 'Hands-on sessions, small groups.', x: 104, y: 756, size: 24, color: '#cfd6ff', name: 'B-body' });
const gCardB = await group([bBg, bHead, bBody], 'Card B');

const gContent = await group([gCardA, gCardB], 'Content');   // nesting: folders inside a folder

// --- Footer ---
const fLine = await add('prism_add_line', { x1: 70, y1: 1010, x2: 730, y2: 1010, color: '#3aa0ff', width: 3, name: 'Divider' });
const fInfo = await add('prism_add_text', { text: 'JUNE 12-14   ·   BERLIN   ·   aurora.design', x: 70, y: 1044, size: 26, color: '#cfd6ff', name: 'Info' });
const gFooter = await group([fLine, fInfo], 'Footer');

// --- Wrap everything in a top-level Poster group (3 levels of nesting total) ---
const gPoster = await group([gHeader, gContent, gFooter], 'Poster');

// Print the resulting layer tree
await call('prism_set_layer_props', { id: gContent, opacity: 40 }); // dim the nested Content group
const info = await call('prism_info');
const byParent = {};
for (const l of info.layers) { (byParent[l.groupId || ''] ||= []).push(l); }
const label = l => (l.type === 'group' ? '📂 ' : '• ') + l.name;
const printTree = (key, depth) => {
  for (const l of (byParent[key] || []).slice().reverse()) { // top-of-panel first
    console.log('   ' + '  '.repeat(depth) + label(l));
    if (l.type === 'group') printTree(l.id, depth + 1);
  }
};
console.log('\nLayer tree:');
printTree('', 0);

const out = resolve(__dirname, 'poster-nested-dim.png');
await call('prism_export_png', { path: out });
await client.close();
console.log('\nSaved', out);
process.exit(0);
