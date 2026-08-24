#!/usr/bin/env node
// Prism MCP server — drives the Prism image editor (public/prism.html) in a VISIBLE
// browser window via puppeteer, exposing its PrismAPI as MCP tools. Non-headless so
// the user can watch edits happen live.

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import puppeteer from 'puppeteer-core';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve, extname } from 'node:path';
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PRISM_HTML = process.env.PRISM_HTML || resolve(__dirname, '../public/prism.html');
const PRISM_URL  = pathToFileURL(PRISM_HTML).href;
const CHROME = process.env.PRISM_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

// ---- Browser session (lazy, persistent across tool calls) --------------------
let browser = null, page = null;
async function ensurePage() {
  if (page && !page.isClosed()) return page;
  if (!browser || !browser.connected) {
    browser = await puppeteer.launch({
      executablePath: CHROME,
      headless: false,
      defaultViewport: null,
      args: ['--window-size=1400,900', '--no-first-run', '--no-default-browser-check'],
    });
  }
  const pages = await browser.pages();
  page = pages[0] || await browser.newPage();
  await page.goto(PRISM_URL, { waitUntil: 'load' });
  await page.waitForFunction('window.PrismAPI && window.PrismAPI.ready && window.PrismAPI.ready()', { timeout: 20000 });
  return page;
}
// Call a PrismAPI method inside the page (awaits async methods like openImage).
async function api(method, args = []) {
  const p = await ensurePage();
  return await p.evaluate(async (m, a) => {
    const fn = window.PrismAPI[m];
    if (typeof fn !== 'function') throw new Error('PrismAPI.' + m + ' is not a function');
    const r = fn(...a);
    return (r && typeof r.then === 'function') ? await r : r;
  }, method, args);
}
const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif' };
const text = (o) => ({ content: [{ type: 'text', text: typeof o === 'string' ? o : JSON.stringify(o, null, 2) }] });
const withImage = (o, b64) => ({ content: [{ type: 'text', text: typeof o === 'string' ? o : JSON.stringify(o, null, 2) }, { type: 'image', data: b64, mimeType: 'image/png' }] });

// ---- Tool definitions --------------------------------------------------------
const num = (d) => ({ type: 'number', ...(d !== undefined ? { default: d } : {}) });
const str = (d) => ({ type: 'string', ...(d !== undefined ? { default: d } : {}) });
const TOOLS = [
  { name: 'prism_info', description: 'Get the current Prism document: dimensions, active layer, and the full layer list. Opens the Prism window if not already open.', inputSchema: { type: 'object', properties: {} } },
  { name: 'prism_new_document', description: 'Create a new blank document. Resets all layers. background accepts "white", "black", "transparent", or any hex color (e.g. "#0f1330").', inputSchema: { type: 'object', properties: { width: num(800), height: num(600), background: { type: 'string', default: 'white' } } } },
  { name: 'prism_open_image', description: 'Open an image file (PNG/JPG/WebP/GIF) from disk as a new document sized to the image.', inputSchema: { type: 'object', properties: { path: str(), asNewDocument: { type: 'boolean', default: true }, name: str() }, required: ['path'] } },
  { name: 'prism_add_rectangle', description: 'Add an editable vector rectangle layer. fill/stroke are hex colors (or null for none). radius rounds the corners.', inputSchema: { type: 'object', properties: { x: num(0), y: num(0), w: num(100), h: num(80), fill: str('#2d7ff9'), stroke: { type: ['string', 'null'] }, strokeWidth: num(0), radius: num(0), name: str() } } },
  { name: 'prism_add_ellipse', description: 'Add an editable vector ellipse layer inscribed in the given box.', inputSchema: { type: 'object', properties: { x: num(0), y: num(0), w: num(100), h: num(80), fill: str('#2d7ff9'), stroke: { type: ['string', 'null'] }, strokeWidth: num(0), name: str() } } },
  { name: 'prism_add_line', description: 'Add an editable vector line from (x1,y1) to (x2,y2). Optional arrowStart/arrowEnd (triangle|arrow|circle|square|bar) add arrowheads; cap and dash also supported.', inputSchema: { type: 'object', properties: { x1: num(0), y1: num(0), x2: num(100), y2: num(100), color: str('#000000'), width: num(3), cap: { type: 'string', enum: ['butt', 'round', 'square'] }, dash: { type: 'array', items: num() }, arrowStart: { type: 'string', enum: ['triangle', 'arrow', 'circle', 'square', 'bar'] }, arrowEnd: { type: 'string', enum: ['triangle', 'arrow', 'circle', 'square', 'bar'] }, arrowSize: num(), varWidth: { description: 'variable-width stroke: preset (taper/pointed/leaf/waist/bulge/taper-in) or array of {at,w}', oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'object' } }] }, name: str() } } },
  { name: 'prism_add_path', description: 'Add an editable Bézier path (like the Pen tool). points is an array of anchors, each either [x,y] (a corner) or {x,y, hIn:[hx,hy], hOut:[hx,hy]} with cubic-Bézier control handles (absolute coords). closed:true makes it a filled shape. smooth:true auto-generates smooth curve handles through the anchors when none are supplied (great for wavy lines/blobs). fill/stroke are hex colors or null; strokeWidth in px. Editable afterward with the Direct Selection tool.', inputSchema: { type: 'object', properties: { points: { type: 'array', items: {}, description: '[x,y] pairs or {x,y,hIn,hOut} objects' }, closed: { type: 'boolean', default: false }, smooth: { type: 'boolean', default: false }, holes: { type: 'array', items: { type: 'array', items: {} }, description: 'optional inner subpaths (each an array of [x,y]/anchor points) that cut holes via even-odd fill' }, fill: { type: ['string', 'null'] }, stroke: { type: ['string', 'null'] }, strokeWidth: num(), cap: { type: 'string', enum: ['butt', 'round', 'square'] }, join: { type: 'string', enum: ['miter', 'round', 'bevel'] }, dash: { type: 'array', items: num() }, dashOffset: num(), arrowStart: { type: 'string', enum: ['triangle', 'arrow', 'circle', 'square', 'bar'] }, arrowEnd: { type: 'string', enum: ['triangle', 'arrow', 'circle', 'square', 'bar'] }, arrowSize: num(), varWidth: { description: 'variable-width stroke (open paths): preset name (taper/pointed/leaf/waist/bulge/taper-in) or array of {at,w} stops', oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'object' } }] }, name: str() }, required: ['points'] } },
  { name: 'prism_set_stroke', description: 'Set stroke options on a shape or path layer (by id, else active): color (hex or null), width (px), cap (butt/round/square line ends), join (miter/round/bevel corners), dash (array of dash,gap lengths in px — e.g. [12,6]; [] for solid), dashOffset (px). Arrowheads for OPEN paths/lines: arrowStart / arrowEnd (triangle | arrow | circle | square | bar | none) filled with the stroke color and aligned to the path tangent; arrowSize scales them (default 1). Only the properties you pass are changed.', inputSchema: { type: 'object', properties: { id: str(), color: { type: ['string', 'null'] }, width: num(), cap: { type: 'string', enum: ['butt', 'round', 'square'] }, join: { type: 'string', enum: ['miter', 'round', 'bevel'] }, dash: { type: 'array', items: num() }, dashOffset: num(), arrowStart: { type: 'string', enum: ['triangle', 'arrow', 'circle', 'square', 'bar', 'none'] }, arrowEnd: { type: 'string', enum: ['triangle', 'arrow', 'circle', 'square', 'bar', 'none'] }, arrowSize: num(), varWidth: { description: 'variable-width stroke for OPEN paths/lines: a preset (uniform/taper/taper-in/pointed/leaf/waist/bulge) or an array of {at:0..1, w:multiplier} width stops; "uniform"/null clears', oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'object' } }, { type: 'null' }] } } } },
  { name: 'prism_path_to_selection', description: 'Convert a path layer into the marquee selection (like ⌘-clicking a path in Photoshop) — the path\'s filled region (open paths are closed) becomes the active selection, which then constrains fills, filters, adjustments, and deletes. Pass the path layer id (from prism_info), else the active/topmost path. mode: replace (default), add, subtract, or intersect with the current selection.', inputSchema: { type: 'object', properties: { id: str(), mode: { type: 'string', enum: ['replace', 'add', 'subtract', 'intersect'], default: 'replace' } } } },
  { name: 'prism_selection_to_path', description: 'Trace the current selection\'s outline into a new editable Bézier path layer (like Photoshop\'s "Make Work Path from Selection"). smooth:true rounds the traced polygon into smooth curves; tolerance (px, default 2) controls how much the contour is simplified — higher = fewer anchors. Requires an active selection.', inputSchema: { type: 'object', properties: { smooth: { type: 'boolean', default: false }, tolerance: num(2) } } },
  { name: 'prism_combine_paths', description: 'Pathfinder: boolean-combine 2+ path layers into one new path (like Illustrator Pathfinder). ids lists the path layer ids (from prism_info). op: union (merge), intersect (overlap only), subtract (first path minus the rest — order matters), or exclude (non-overlapping XOR). smooth:true rounds the result; tolerance (px, default 1.5) simplifies. The source paths are replaced by the combined path (inherits the first path\'s fill/stroke). Produces a proper compound path — holes and disjoint pieces are preserved.', inputSchema: { type: 'object', properties: { ids: { type: 'array', items: { type: 'string' } }, op: { type: 'string', enum: ['union', 'subtract', 'intersect', 'exclude'], default: 'union' }, smooth: { type: 'boolean', default: false }, tolerance: num(1.5) }, required: ['ids'] } },
  { name: 'prism_make_compound_path', description: 'Combine 2+ path layers into one compound path (like Illustrator ⌘8). The first id is the outer contour; the rest become subpaths — any contour nested inside another cuts a hole (even-odd fill). Unlike prism_combine_paths this keeps the exact Bézier anchors (no re-tracing). Source layers are replaced by the compound path.', inputSchema: { type: 'object', properties: { ids: { type: 'array', items: { type: 'string' } } }, required: ['ids'] } },
  { name: 'prism_release_compound_path', description: 'Release a compound path back into separate path layers (one per subpath). Pass the compound path id, else the active layer.', inputSchema: { type: 'object', properties: { id: str() } } },
  { name: 'prism_add_text', description: 'Add an editable text layer.', inputSchema: { type: 'object', properties: { text: str('Text'), x: num(40), y: num(40), size: num(48), color: str('#000000'), font: str('Arial'), bold: { type: 'boolean', default: false }, italic: { type: 'boolean', default: false }, align: { type: 'string', enum: ['left', 'center', 'right'], default: 'left' }, name: str() } } },
  { name: 'prism_add_text_on_path', description: 'Add text that flows along a Bézier path (like Illustrator Type on a Path) — each glyph is placed by arc-length and rotated to the path tangent. The text is LIVE-LINKED to its path: give points (array of [x,y] or {x,y,hIn,hOut} anchors; smooth:true auto-curves) to create an invisible editable source path, OR pathId to follow an existing path layer — editing that path afterward (Direct Selection, move, pathfinder) re-flows the text automatically. align positions the run (left=start, center, right=end); offset shifts the start (px); tracking adds letter spacing; baselineShift lifts text off the path.', inputSchema: { type: 'object', properties: { text: str('Text'), points: { type: 'array', items: {} }, pathId: str(), closed: { type: 'boolean', default: false }, smooth: { type: 'boolean', default: false }, size: num(48), color: str('#000000'), font: str('Arial'), bold: { type: 'boolean', default: false }, italic: { type: 'boolean', default: false }, align: { type: 'string', enum: ['left', 'center', 'right'], default: 'left' }, offset: num(0), tracking: num(0), baselineShift: num(0), name: str() }, required: ['text'] } },
  { name: 'prism_text_to_path', description: 'Live-link an existing text layer to an existing path so the text flows along it and re-flows whenever the path is edited. Pass the text layer id (or omit for the active layer) and the pathId.', inputSchema: { type: 'object', properties: { id: str(), pathId: str() }, required: ['pathId'] } },
  { name: 'prism_release_text_from_path', description: 'Unbind a text-on-path layer so it becomes normal horizontal text again (by id, else active).', inputSchema: { type: 'object', properties: { id: str() } } },
  { name: 'prism_apply_filter', description: 'Apply a filter destructively to the active layer. Use prism_list_filters for kinds and their params.', inputSchema: { type: 'object', properties: { kind: str(), params: { type: 'object' } }, required: ['kind'] } },
  { name: 'prism_apply_adjustment', description: 'Apply a color/tone adjustment destructively to the active layer. Use prism_list_adjustments for kinds and params.', inputSchema: { type: 'object', properties: { kind: str(), params: { type: 'object' } }, required: ['kind'] } },
  { name: 'prism_list_filters', description: 'List available filter kinds and their parameters.', inputSchema: { type: 'object', properties: {} } },
  { name: 'prism_list_adjustments', description: 'List available adjustment kinds and their parameters.', inputSchema: { type: 'object', properties: {} } },
  { name: 'prism_select_layer', description: 'Make a layer active by id (see prism_info / prism_list_layers).', inputSchema: { type: 'object', properties: { id: str() }, required: ['id'] } },
  { name: 'prism_set_layer_props', description: 'Update a layer: opacity (0-100), blend mode, visibility, or name. Targets the given id, else the active layer.', inputSchema: { type: 'object', properties: { id: str(), opacity: num(), blend: str(), visible: { type: 'boolean' }, name: str() } } },
  { name: 'prism_delete_layer', description: 'Delete a layer (by id, else the active layer).', inputSchema: { type: 'object', properties: { id: str() } } },
  { name: 'prism_clip_to_below', description: 'Toggle a clipping mask: clip the layer (by id, else active) into the shape of the layer directly below it.', inputSchema: { type: 'object', properties: { id: str() } } },
  { name: 'prism_flatten', description: 'Flatten all layers into one.', inputSchema: { type: 'object', properties: {} } },
  { name: 'prism_undo', description: 'Undo the last operation.', inputSchema: { type: 'object', properties: {} } },
  { name: 'prism_redo', description: 'Redo.', inputSchema: { type: 'object', properties: {} } },
  { name: 'prism_render', description: 'Return the current composited canvas as a PNG image (so you can see the current state).', inputSchema: { type: 'object', properties: {} } },
  { name: 'prism_export_png', description: 'Export the document as a PNG. If path is given, saves to disk; always returns a preview image. scale (default 1) renders at a hi-DPI multiplier — 2 for @2x, 3 for @3x — vector shapes and text re-render crisp at the higher resolution (not a blurry upscale).', inputSchema: { type: 'object', properties: { path: str(), scale: num(1) } } },

  // --- Smart objects (non-destructive) ---
  { name: 'prism_to_smart_object', description: 'Convert a layer (by id, else active) into a Smart Object so filters/adjustments applied to it stay re-editable and non-destructive.', inputSchema: { type: 'object', properties: { id: str() } } },
  { name: 'prism_add_smart_filter', description: 'Add a re-editable filter OR adjustment to a Smart Object\'s stack (kinds come from prism_list_filters / prism_list_adjustments). Returns the filterId. Layer must be a Smart Object.', inputSchema: { type: 'object', properties: { kind: str(), params: { type: 'object' }, id: str() }, required: ['kind'] } },
  { name: 'prism_list_smart_filters', description: 'List the re-editable smart-filter stack on a Smart Object layer (each has filterId, kind, enabled, params).', inputSchema: { type: 'object', properties: { id: str() } } },
  { name: 'prism_set_smart_filter_enabled', description: 'Show/hide a smart filter without deleting it.', inputSchema: { type: 'object', properties: { filterId: str(), enabled: { type: 'boolean' }, id: str() }, required: ['filterId', 'enabled'] } },
  { name: 'prism_update_smart_filter', description: 'Change the parameters of an existing smart filter (re-renders live).', inputSchema: { type: 'object', properties: { filterId: str(), params: { type: 'object' }, id: str() }, required: ['filterId', 'params'] } },
  { name: 'prism_remove_smart_filter', description: 'Delete a smart filter from the stack.', inputSchema: { type: 'object', properties: { filterId: str(), id: str() }, required: ['filterId'] } },
  { name: 'prism_reorder_smart_filter', description: 'Move a smart filter up or down in the stack (order changes the rendered result).', inputSchema: { type: 'object', properties: { filterId: str(), direction: { type: 'string', enum: ['up', 'down'] }, id: str() }, required: ['filterId', 'direction'] } },
  { name: 'prism_reset_smart_transform', description: 'Reset a Smart Object\'s scale/rotation back to its embedded content\'s native size.', inputSchema: { type: 'object', properties: { id: str() } } },
  { name: 'prism_rasterize', description: 'Rasterize a Smart Object or vector shape layer into plain pixels (bakes in all smart filters / geometry).', inputSchema: { type: 'object', properties: { id: str() } } },

  // --- Layer styles (non-destructive fx) ---
  { name: 'prism_list_layer_style_types', description: 'List the available layer-style effects (dropShadow, innerShadow, innerGlow, outerGlow, bevel, stroke, colorOverlay, gradientOverlay) with their parameter names and defaults.', inputSchema: { type: 'object', properties: {} } },
  { name: 'prism_set_layer_style', description: 'Enable/configure a layer-style effect on a layer (by id, else active). Merges params and turns the effect on unless params.enabled is false. See prism_list_layer_style_types for param names.', inputSchema: { type: 'object', properties: { effect: { type: 'string', enum: ['dropShadow', 'innerShadow', 'innerGlow', 'outerGlow', 'bevel', 'stroke', 'colorOverlay', 'gradientOverlay'] }, params: { type: 'object' }, id: str() }, required: ['effect'] } },
  { name: 'prism_get_layer_styles', description: 'Get the current layer-style configuration for a layer.', inputSchema: { type: 'object', properties: { id: str() } } },
  { name: 'prism_clear_layer_styles', description: 'Remove all layer styles from a layer.', inputSchema: { type: 'object', properties: { id: str() } } },

  // --- Groups (folders) ---
  { name: 'prism_group_layers', description: 'Group layers into a folder (like ⌘G). Pass the layer ids to group (from prism_info); omit ids to group the current selection. Returns the new groupId. Only ungrouped, non-group layers can be grouped.', inputSchema: { type: 'object', properties: { ids: { type: 'array', items: { type: 'string' } }, name: str() } } },
  { name: 'prism_ungroup_layers', description: 'Ungroup a folder back into individual layers. Pass the group\'s id (else acts on the active layer/group).', inputSchema: { type: 'object', properties: { id: str() } } },
  { name: 'prism_move_layer', description: 'Reorder a layer in the stack. Give a direction (up/down/front/back) OR an absolute toIndex (0 = bottom of stack). Group folders move as a whole block; a layer inside a group reorders within that group. Use ids from prism_info.', inputSchema: { type: 'object', properties: { id: str(), direction: { type: 'string', enum: ['up', 'down', 'front', 'back'] }, toIndex: { type: 'number' } }, required: ['id'] } },
  { name: 'prism_duplicate_layer', description: 'Duplicate a layer (by id, else the active layer), inserting the copy directly above the original. Copies pixels, mask, layer styles, smart object + smart filters, and vector shape geometry. Duplicating a group folder clones the folder and all its members. Returns the new layer id.', inputSchema: { type: 'object', properties: { id: str() } } },
  { name: 'prism_offset_layer', description: 'Spatially translate a layer by (dx, dy) pixels (positive dx = right, positive dy = down). Group-aware: offsetting a folder moves its whole subtree together. Lossless — shapes/text move by geometry, rasters by an integer blit. Use to reposition or lay out duplicated layers/groups.', inputSchema: { type: 'object', properties: { id: str(), dx: num(0), dy: num(0) }, required: ['id'] } },
  { name: 'prism_align_layers', description: 'Align and/or evenly distribute layers/groups by their visible bounds. Pass ids (from prism_info); omit to use the current selection. Each selected group is aligned as one unit. align: left/right/hcenter (horizontal) or top/bottom/vcenter (vertical). distribute: horizontal or vertical (evenly spaces the centers; needs ≥3 items). relativeTo: "selection" (default, align within the group of items) or "canvas" (align to the document edges/center). You can pass align and distribute together.', inputSchema: { type: 'object', properties: { ids: { type: 'array', items: { type: 'string' } }, align: { type: 'string', enum: ['left', 'right', 'hcenter', 'top', 'bottom', 'vcenter'] }, distribute: { type: 'string', enum: ['horizontal', 'vertical'] }, relativeTo: { type: 'string', enum: ['selection', 'canvas'] } } } },
  { name: 'prism_resize_canvas', description: 'Resize the document canvas (Canvas Size — does NOT scale content). Existing layers keep their pixel size and are repositioned by the anchor: growing adds transparent space, shrinking crops. anchor is a 9-grid position (default center); or pass explicit offsetX/offsetY (pixels the existing content shifts, positive = right/down) to override the anchor. Use to add margins, change aspect ratio, or make room before laying out.', inputSchema: { type: 'object', properties: { width: num(), height: num(), anchor: { type: 'string', enum: ['top-left', 'top', 'top-right', 'left', 'center', 'right', 'bottom-left', 'bottom', 'bottom-right'] }, offsetX: num(), offsetY: num() }, required: ['width', 'height'] } },
  { name: 'prism_export_slices', description: 'Export each group (folder) as its own PNG, rendered in isolation on a transparent background. Defaults to every TOP-LEVEL group; pass ids for specific groups (any nesting level). crop (default true) trims each slice to the group\'s visible bounds. scale (default 1) renders at a hi-DPI multiplier (2 = @2x, 3 = @3x; vectors/text stay crisp). Pass dir to save the PNGs to a folder (one file per group, named after the group); a preview image is returned for every slice regardless.', inputSchema: { type: 'object', properties: { dir: str(), ids: { type: 'array', items: { type: 'string' } }, crop: { type: 'boolean', default: true }, scale: num(1) } } },
  { name: 'prism_crop_to_content', description: 'Trim the canvas to the artwork: resizes the document to the tight bounding box of all visible (non-transparent) pixels, removing empty margins. Content is repositioned to the origin, not scaled. Optional padding adds a transparent margin (px) on every side.', inputSchema: { type: 'object', properties: { padding: num(0) } } },
  { name: 'prism_image_size', description: 'Resize the whole image WITH content scaling (Image Size — everything scales, unlike prism_resize_canvas which only changes the canvas). Pass scale (percent: 50 = half, 200 = double), or an explicit width and/or height. If only one of width/height is given, the other is computed to keep the aspect ratio. On uniform scaling, vector shapes, text, and smart objects stay editable (their geometry scales); non-uniform scaling of rotated shapes or text bakes them; rasters are resampled.', inputSchema: { type: 'object', properties: { width: num(), height: num(), scale: num() } } },
  { name: 'prism_transform_layer', description: 'Rotate and/or flip a layer or group around its own center. rotate = degrees clockwise (any angle; 90/180/270 are lossless). flip = horizontal or vertical. Group-aware: the whole subtree transforms together as one unit. Vector shapes stay editable (applied to geometry); text, smart objects, and rasters are baked to pixels. Content rotated past the canvas edge is clipped — crop/resize the canvas first if needed.', inputSchema: { type: 'object', properties: { id: str(), rotate: num(0), flip: { type: 'string', enum: ['horizontal', 'vertical'] } }, required: ['id'] } },
];

// ---- Tool dispatch -----------------------------------------------------------
async function dispatch(name, a = {}) {
  switch (name) {
    case 'prism_info': return text(await api('info'));
    case 'prism_new_document': return text(await api('newDocument', [a.width, a.height, a.background]));
    case 'prism_open_image': {
      const buf = await readFile(resolve(a.path));
      const mime = MIME[extname(a.path).toLowerCase()] || 'image/png';
      const dataURL = `data:${mime};base64,${buf.toString('base64')}`;
      return text(await api('openImage', [dataURL, { asNewDocument: a.asNewDocument !== false, name: a.name }]));
    }
    case 'prism_add_rectangle': return text(await api('addRectangle', [a]));
    case 'prism_add_ellipse': return text(await api('addEllipse', [a]));
    case 'prism_add_line': return text(await api('addLine', [a]));
    case 'prism_add_path': return text(await api('addPath', [a]));
    case 'prism_set_stroke': return text(await api('setStroke', [a.id, a]));
    case 'prism_path_to_selection': return text(await api('pathToSelection', [a.id, a.mode]));
    case 'prism_selection_to_path': return text(await api('selectionToPath', [a.smooth, a.tolerance]));
    case 'prism_combine_paths': return text(await api('combinePaths', [a.ids, a.op, a.smooth, a.tolerance]));
    case 'prism_make_compound_path': return text(await api('makeCompoundPath', [a.ids]));
    case 'prism_release_compound_path': return text(await api('releaseCompoundPath', [a.id]));
    case 'prism_add_text': return text(await api('addText', [a]));
    case 'prism_add_text_on_path': return text(await api('addTextOnPath', [a]));
    case 'prism_text_to_path': return text(await api('textToPath', [a.id, a.pathId]));
    case 'prism_release_text_from_path': return text(await api('releaseTextFromPath', [a.id]));
    case 'prism_apply_filter': return text(await api('applyFilter', [a.kind, a.params || {}]));
    case 'prism_apply_adjustment': return text(await api('applyAdjustment', [a.kind, a.params || {}]));
    case 'prism_list_filters': return text(await api('listFilters'));
    case 'prism_list_adjustments': return text(await api('listAdjustments'));
    case 'prism_select_layer': return text(await api('selectLayer', [a.id]));
    case 'prism_set_layer_props': return text(await api('setLayerProps', [a.id, a]));
    case 'prism_delete_layer': return text(await api('deleteLayer', [a.id]));
    case 'prism_clip_to_below': return text(await api('clipToBelow', [a.id]));
    case 'prism_flatten': return text(await api('flatten'));
    case 'prism_undo': return text(await api('undo'));
    case 'prism_redo': return text(await api('redo'));
    case 'prism_render': {
      const dataURL = await api('exportPNG');
      const b64 = dataURL.split(',')[1];
      return withImage('Current canvas', b64);
    }
    case 'prism_export_png': {
      const dataURL = await api('exportPNG', [a.scale]);
      const b64 = dataURL.split(',')[1];
      let saved = null;
      if (a.path) { await writeFile(resolve(a.path), Buffer.from(b64, 'base64')); saved = resolve(a.path); }
      return withImage(saved ? { saved } : { saved: null, note: 'no path given; preview only' }, b64);
    }
    // Smart objects
    case 'prism_to_smart_object': return text(await api('toSmartObject', [a.id]));
    case 'prism_add_smart_filter': return text(await api('addSmartFilter', [a.kind, a.params || {}, a.id]));
    case 'prism_list_smart_filters': return text(await api('listSmartFilters', [a.id]));
    case 'prism_set_smart_filter_enabled': return text(await api('setSmartFilterEnabled', [a.filterId, a.enabled, a.id]));
    case 'prism_update_smart_filter': return text(await api('updateSmartFilter', [a.filterId, a.params || {}, a.id]));
    case 'prism_remove_smart_filter': return text(await api('removeSmartFilter', [a.filterId, a.id]));
    case 'prism_reorder_smart_filter': return text(await api('reorderSmartFilter', [a.filterId, a.direction === 'up' ? 1 : -1, a.id]));
    case 'prism_reset_smart_transform': return text(await api('resetSmartTransform', [a.id]));
    case 'prism_rasterize': return text(await api('rasterize', [a.id]));
    // Layer styles
    case 'prism_list_layer_style_types': return text(await api('listLayerStyleTypes'));
    case 'prism_set_layer_style': return text(await api('setLayerStyle', [a.effect, a.params || {}, a.id]));
    case 'prism_get_layer_styles': return text(await api('getLayerStyles', [a.id]));
    case 'prism_clear_layer_styles': return text(await api('clearLayerStyles', [a.id]));
    // Groups
    case 'prism_group_layers': return text(await api('groupLayers', [a.ids || null, a.name]));
    case 'prism_ungroup_layers': return text(await api('ungroupLayers', [a.id]));
    case 'prism_move_layer': return text(await api('moveLayer', [a.id, a.direction, a.toIndex]));
    case 'prism_duplicate_layer': return text(await api('duplicateLayer', [a.id]));
    case 'prism_offset_layer': return text(await api('offsetLayer', [a.id, a.dx, a.dy]));
    case 'prism_align_layers': return text(await api('alignLayers', [a.ids || null, a.align, a.distribute, a.relativeTo]));
    case 'prism_resize_canvas': return text(await api('resizeCanvas', [a.width, a.height, a.anchor, a.offsetX, a.offsetY]));
    case 'prism_crop_to_content': return text(await api('cropToContent', [a.padding]));
    case 'prism_image_size': return text(await api('imageSize', [a.width, a.height, a.scale]));
    case 'prism_transform_layer': return text(await api('transformLayer', [a.id, a.rotate, a.flip]));
    case 'prism_export_slices': {
      const slices = await api('exportSlices', [a.ids || null, a.crop !== false, a.scale]);
      if (a.dir) await mkdir(resolve(a.dir), { recursive: true });
      const used = {}, saved = [], content = [];
      for (const s of slices) {
        const b64 = s.dataURL.split(',')[1];
        const entry = { name: s.name, width: s.width, height: s.height };
        if (a.dir) {
          let base = String(s.name || 'group').trim().replace(/[^\w.-]+/g, '_') || 'group';
          used[base] = (used[base] || 0) + 1; if (used[base] > 1) base += '_' + used[base];
          const p = resolve(a.dir, base + '.png'); await writeFile(p, Buffer.from(b64, 'base64')); entry.path = p;
        }
        saved.push(entry);
        if (content.length < 24) { content.push({ type: 'text', text: `${s.name} — ${s.width}×${s.height}` }, { type: 'image', data: b64, mimeType: 'image/png' }); }
      }
      return { content: [{ type: 'text', text: JSON.stringify({ dir: a.dir || null, count: saved.length, slices: saved }, null, 2) }, ...content] };
    }
    default: throw new Error('Unknown tool: ' + name);
  }
}

// ---- MCP wiring --------------------------------------------------------------
const server = new Server({ name: 'prism-mcp', version: '0.1.0' }, { capabilities: { tools: {} } });
server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));
server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;
  try {
    return await dispatch(name, args || {});
  } catch (err) {
    return { isError: true, content: [{ type: 'text', text: 'Error in ' + name + ': ' + (err && err.message ? err.message : String(err)) }] };
  }
});

process.on('SIGINT', async () => { try { if (browser) await browser.close(); } catch {} process.exit(0); });
process.on('SIGTERM', async () => { try { if (browser) await browser.close(); } catch {} process.exit(0); });

const transport = new StdioServerTransport();
await server.connect(transport);
console.error('prism-mcp: ready (Chrome=' + CHROME + ', doc=' + PRISM_URL + ')');
