// Demo prism_export_slices: build a poster whose sections are top-level groups, then slice each to PNG.
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const __dirname = dirname(fileURLToPath(import.meta.url));
const transport = new StdioClientTransport({ command: 'node', args: [resolve(__dirname, 'server.js')] });
const client = new Client({ name: 'slices-demo', version: '0.0.1' }, { capabilities: {} });
await client.connect(transport);
const call = async (n, a = {}) => { const r = await client.callTool({ name: n, arguments: a }); const t = r.content.find(c => c.type === 'text'); if (r.isError) console.log('[ERR]', n, t && t.text); let o = {}; try { o = JSON.parse(t.text); } catch {} return { o, r }; };
const id = async (n, a) => (await call(n, a)).o.id;
const grp = async (ids, name) => (await call('prism_group_layers', { ids, name })).o.groupId;

await call('prism_new_document', { width: 800, height: 1200, background: '#0f1330' });

// Header (top-level group)
await grp([
  await id('prism_add_text', { text: 'AURORA', x: 70, y: 110, size: 96, color: '#ffffff', bold: true, name: 'Title' }),
  await id('prism_add_text', { text: 'DESIGN SUMMIT 2026', x: 74, y: 214, size: 30, color: '#ffd24a', bold: true, name: 'Subtitle' }),
  await id('prism_add_line', { x1: 74, y1: 276, x2: 420, y2: 276, color: '#ff5f6d', width: 5, name: 'Accent' }),
], 'Header');

// Content (top-level group with two nested cards)
const gCardA = await grp([
  await id('prism_add_rectangle', { x: 70, y: 340, w: 660, h: 250, fill: '#1b2450', radius: 20, name: 'A-bg' }),
  await id('prism_add_text', { text: 'Keynotes', x: 104, y: 372, size: 40, color: '#ffffff', bold: true, name: 'A-title' }),
], 'Card A');
const gCardB = await grp([
  await id('prism_add_rectangle', { x: 70, y: 650, w: 660, h: 250, fill: '#1b2450', radius: 20, name: 'B-bg' }),
  await id('prism_add_text', { text: 'Workshops', x: 104, y: 682, size: 40, color: '#ffffff', bold: true, name: 'B-title' }),
], 'Card B');
await grp([gCardA, gCardB], 'Content');

// Footer (top-level group)
await grp([
  await id('prism_add_line', { x1: 70, y1: 1010, x2: 730, y2: 1010, color: '#3aa0ff', width: 3, name: 'Divider' }),
  await id('prism_add_text', { text: 'JUNE 12-14   ·   BERLIN', x: 70, y: 1044, size: 26, color: '#cfd6ff', name: 'Info' }),
], 'Footer');

// Slice every top-level group to its own PNG, cropped, saved to ./slices/
const dir = resolve(__dirname, 'slices');
const { o } = await call('prism_export_slices', { dir });
console.log('Exported', o.count, 'slices to', o.dir);
for (const s of o.slices) console.log('  -', s.name, s.width + '×' + s.height, '->', s.path);
await client.close();
process.exit(0);
