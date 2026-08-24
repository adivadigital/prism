// Demo prism_resize_canvas: build a tight card, then grow the canvas to frame it (before/after).
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const __dirname = dirname(fileURLToPath(import.meta.url));
const transport = new StdioClientTransport({ command: 'node', args: [resolve(__dirname, 'server.js')] });
const client = new Client({ name: 'canvas-demo', version: '0.0.1' }, { capabilities: {} });
await client.connect(transport);
const call = async (n, a = {}) => { const r = await client.callTool({ name: n, arguments: a }); const t = r.content.find(c => c.type === 'text'); if (r.isError) console.log('[ERR]', n, t && t.text); let o = {}; try { o = JSON.parse(t.text); } catch {} return o; };
const add = async (t, a) => (await call(t, a)).id;

// Tight 360x150 card
await call('prism_new_document', { width: 360, height: 150, background: 'transparent' });
await call('prism_add_rectangle', { x: 0, y: 0, w: 360, h: 150, fill: '#1b2450', radius: 18, name: 'Card' });
await call('prism_add_text', { text: 'AURORA', x: 28, y: 34, size: 46, color: '#ffffff', bold: true, name: 'Title' });
await call('prism_add_text', { text: 'design summit', x: 30, y: 96, size: 22, color: '#ffd24a', name: 'Sub' });
const info1 = await call('prism_info');
await call('prism_export_png', { path: resolve(__dirname, 'canvas-before.png') });
console.log('tight card', info1.width + 'x' + info1.height, '-> canvas-before.png');

// Grow the canvas to 640x400, centered — content keeps its size, gains a margin
await call('prism_resize_canvas', { width: 640, height: 400, anchor: 'center' });

// Add a light background filling the new canvas, sent to the back, to reveal the added margin
const bg = await add('prism_add_rectangle', { x: 0, y: 0, w: 640, h: 400, fill: '#eef1f7', name: 'Frame' });
await call('prism_move_layer', { id: bg, direction: 'back' });

const info2 = await call('prism_info');
await call('prism_export_png', { path: resolve(__dirname, 'canvas-after.png') });
console.log('resized canvas', info2.width + 'x' + info2.height, '(card unscaled, centered) -> canvas-after.png');
await client.close();
process.exit(0);
