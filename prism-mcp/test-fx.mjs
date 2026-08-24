// Smoke test for the smart-object + layer-style tools.
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const transport = new StdioClientTransport({ command: 'node', args: [resolve(__dirname, 'server.js')] });
const client = new Client({ name: 'prism-fx-test', version: '0.0.1' }, { capabilities: {} });
await client.connect(transport);

const call = async (name, args = {}) => {
  const r = await client.callTool({ name, arguments: args });
  const t = r.content.find(c => c.type === 'text');
  const img = r.content.find(c => c.type === 'image');
  console.log(`\n> ${name}(${JSON.stringify(args)})` + (r.isError ? '  [ERROR]' : ''));
  if (t) console.log(t.text.slice(0, 260));
  if (img) console.log(`  [image ${img.mimeType}, ${Math.round(img.data.length * 3 / 4)} bytes]`);
  let out = {}; try { out = JSON.parse(t.text); } catch {}
  return out;
};

const names = (await client.listTools()).tools.map(t => t.name);
console.log('SMART/STYLE TOOLS:', names.filter(n => /smart|style|rasterize/.test(n)).join(', '));

await call('prism_new_document', { width: 640, height: 400, background: 'white' });

// A styled rectangle: drop shadow + white stroke
const box = await call('prism_add_rectangle', { x: 80, y: 80, w: 280, h: 180, fill: '#2d7ff9', radius: 22 });
await call('prism_set_layer_style', { effect: 'dropShadow', params: { distance: 16, size: 14, opacity: 65, angle: 135 } });
await call('prism_set_layer_style', { effect: 'stroke', params: { color: '#ffffff', size: 6, position: 'outside' } });

// Styled text: outer glow
await call('prism_add_text', { text: 'FX', x: 400, y: 120, size: 120, color: '#ffd24a', bold: true });
await call('prism_set_layer_style', { effect: 'outerGlow', params: { color: '#ff7a00', size: 24, opacity: 90 } });

// Smart object with a re-editable filter stack (convert the rectangle)
await call('prism_to_smart_object', { id: box.id });
const f1 = await call('prism_add_smart_filter', { kind: 'gaussian', params: { r: 4 }, id: box.id });
const f2 = await call('prism_add_smart_filter', { kind: 'huesat', params: { h: 40, s: 25 }, id: box.id });
await call('prism_list_smart_filters', { id: box.id });
await call('prism_set_smart_filter_enabled', { filterId: f1.filterId, enabled: false, id: box.id }); // turn blur off, non-destructively
await call('prism_update_smart_filter', { filterId: f2.filterId, params: { h: 160 }, id: box.id });   // re-tune hue live

const outPath = resolve(__dirname, 'test-fx-output.png');
await call('prism_export_png', { path: outPath });

await client.close();
console.log('\nDONE — saved', outPath);
process.exit(0);
