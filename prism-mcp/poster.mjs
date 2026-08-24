// Build a poster by driving the Prism MCP server over the real MCP protocol.
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const transport = new StdioClientTransport({ command: 'node', args: [resolve(__dirname, 'server.js')] });
const client = new Client({ name: 'prism-poster', version: '0.0.1' }, { capabilities: {} });
await client.connect(transport);

const call = async (name, args = {}) => {
  const r = await client.callTool({ name, arguments: args });
  const t = r.content.find(c => c.type === 'text');
  if (r.isError) console.log(`  [ERROR] ${name}: ${t && t.text}`);
  else console.log(`  ok  ${name}`);
  let o = {}; try { o = JSON.parse(t.text); } catch {}
  return o;
};

const W = 800, H = 1200;
console.log('Building poster…');

await call('prism_new_document', { width: W, height: H, background: 'transparent' });

// Background
await call('prism_add_rectangle', { x: 0, y: 0, w: W, h: H, fill: '#0f1330', name: 'BG' });

// Big top circle with a coral→violet gradient overlay
await call('prism_add_ellipse', { x: 170, y: 110, w: 460, h: 460, fill: '#3aa0ff', name: 'Orb' });
await call('prism_set_layer_style', { effect: 'gradientOverlay', params: { c1: '#ff5f6d', c2: '#7a5cff', angle: 35, opacity: 100 } });

// Thin accent ring (stroke only)
await call('prism_add_ellipse', { x: 120, y: 70, w: 220, h: 220, fill: null, stroke: '#ffd24a', strokeWidth: 6, name: 'Ring' });

// Soft glow behind the title: a shape → smart object → non-destructive heavy blur
await call('prism_add_ellipse', { x: 140, y: 590, w: 520, h: 190, fill: '#ff5f6d', name: 'Glow' });
await call('prism_to_smart_object');
await call('prism_add_smart_filter', { kind: 'gaussian', params: { r: 45 } });
await call('prism_set_layer_props', { opacity: 65 });

// Title with a drop shadow
await call('prism_add_text', { text: 'PRISM', x: 95, y: 560, size: 150, color: '#ffffff', bold: true, name: 'Title' });
await call('prism_set_layer_style', { effect: 'dropShadow', params: { distance: 10, size: 16, opacity: 70, angle: 120 } });

// Subtitle
await call('prism_add_text', { text: 'CREATIVE TECH FESTIVAL', x: 100, y: 760, size: 34, color: '#ffd24a', bold: true });

// Divider + footer
await call('prism_add_line', { x1: 100, y1: 835, x2: 700, y2: 835, color: '#ff5f6d', width: 4 });
await call('prism_add_text', { text: 'JUNE 12-14, 2026   ·   BERLIN', x: 100, y: 875, size: 28, color: '#cfd6ff' });

// Ticket badge (rounded rect + label)
await call('prism_add_rectangle', { x: 100, y: 1030, w: 280, h: 84, fill: '#3aa0ff', radius: 16, name: 'Badge' });
await call('prism_set_layer_style', { effect: 'dropShadow', params: { distance: 6, size: 10, opacity: 55, angle: 120 } });
await call('prism_add_text', { text: 'GET TICKETS', x: 132, y: 1052, size: 30, color: '#0f1330', bold: true });

const outPath = resolve(__dirname, 'poster.png');
await call('prism_export_png', { path: outPath });

await client.close();
console.log('\nPoster saved →', outPath);
process.exit(0);
