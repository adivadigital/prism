// Smoke test for prism_group_layers over the MCP protocol.
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const transport = new StdioClientTransport({ command: 'node', args: [resolve(__dirname, 'server.js')] });
const client = new Client({ name: 'prism-group-test', version: '0.0.1' }, { capabilities: {} });
await client.connect(transport);

const call = async (name, args = {}) => {
  const r = await client.callTool({ name, arguments: args });
  const t = r.content.find(c => c.type === 'text');
  console.log(`\n> ${name}(${JSON.stringify(args)})` + (r.isError ? '  [ERROR]' : ''));
  if (t) console.log(t.text.slice(0, 320));
  let o = {}; try { o = JSON.parse(t.text); } catch {}
  return o;
};

const names = (await client.listTools()).tools.map(t => t.name);
console.log('has prism_group_layers:', names.includes('prism_group_layers'), '| has prism_ungroup_layers:', names.includes('prism_ungroup_layers'));

await call('prism_new_document', { width: 480, height: 320, background: 'white' });
const a = await call('prism_add_rectangle', { x: 40, y: 40, w: 140, h: 100, fill: '#2d7ff9', name: 'Blue' });
const b = await call('prism_add_ellipse', { x: 220, y: 60, w: 140, h: 140, fill: '#e0402a', name: 'Red' });
await call('prism_add_text', { text: 'outside', x: 60, y: 240, size: 30, color: '#111', name: 'Caption' });

// Group the two shapes by id, name the folder
const g = await call('prism_group_layers', { ids: [a.id, b.id], name: 'Shapes' });
console.log('\n=> grouped:', g.groupId, 'members:', (g.members || []).map(m => m.name).join(', '));

// Dim the whole group via the group header id, then export a preview
await call('prism_set_layer_props', { id: g.groupId, opacity: 45 });
await call('prism_export_png', { path: resolve(__dirname, 'test-group-output.png') });

await client.close();
console.log('\nDONE');
process.exit(0);
