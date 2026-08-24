// Smoke test: spawn the MCP server, list tools, and drive a full compose→export.
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const transport = new StdioClientTransport({ command: 'node', args: [resolve(__dirname, 'server.js')] });
const client = new Client({ name: 'prism-test', version: '0.0.1' }, { capabilities: {} });
await client.connect(transport);

const tools = await client.listTools();
console.log('TOOLS:', tools.tools.map(t => t.name).join(', '));

const call = async (name, args = {}) => {
  const r = await client.callTool({ name, arguments: args });
  const t = r.content.find(c => c.type === 'text');
  const img = r.content.find(c => c.type === 'image');
  console.log(`\n> ${name}(${JSON.stringify(args)})` + (r.isError ? '  [ERROR]' : ''));
  if (t) console.log(t.text.slice(0, 220));
  if (img) console.log(`  [image ${img.mimeType}, ${Math.round(img.data.length * 3 / 4)} bytes]`);
  return r;
};

await call('prism_new_document', { width: 640, height: 400, background: 'white' });
await call('prism_add_rectangle', { x: 60, y: 60, w: 300, h: 180, fill: '#2d7ff9', radius: 28 });
await call('prism_add_ellipse', { x: 300, y: 150, w: 220, h: 220, fill: '#e0402a' });
await call('prism_add_text', { text: 'Prism MCP', x: 80, y: 300, size: 44, color: '#111111', bold: true });
await call('prism_apply_adjustment', { kind: 'huesat', params: { h: 40, s: 20 } });
const info = await call('prism_info');
const outPath = resolve(__dirname, 'test-output.png');
await call('prism_export_png', { path: outPath });

await client.close();
console.log('\nDONE — saved', outPath);
process.exit(0);
