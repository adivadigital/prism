# Prism

A self-contained, single-file image and vector editor that runs entirely in the browser, plus an MCP server that drives it programmatically in a visible Chrome window so you can watch edits happen live.

Prism is vanilla JavaScript with no build step and no dependencies. The whole app is one HTML file. Open it and you get a Photoshop and Illustrator style workspace: raster layers, blend modes, selections, adjustments and filters, plus a full vector toolset with a pen, editable Bezier paths, pathfinder booleans, compound paths, variable-width strokes, text on a path, and more.

## The app

Open [`public/prism.html`](public/prism.html) directly in any modern browser, or serve the folder:

```bash
cd public && python3 -m http.server 4181
# then visit http://localhost:4181/prism.html
```

Highlights:

- Raster: layers, groups (nestable), masks, blend modes, opacity, brush/eraser/clone/heal, gradients, adjustments (levels, curves, hue/sat, and more), filters, smart objects with editable smart filters, and layer styles.
- Vector: rectangle, ellipse, line, and pen tools; Direct Selection for editing anchors and Bezier handles; pathfinder combine (union, subtract, intersect, exclude); compound paths for real holes; stroke options (dashes, caps, joins, arrowheads); variable-width strokes with an interactive Width Tool; and live-linked text on a path.
- Documents: multi-layer files, canvas resize, image size scaling, crop to content, and PNG export at 1x/2x/3x.

## The MCP server

[`prism-mcp/`](prism-mcp/) is a Model Context Protocol server that opens Prism in a real Chrome window and exposes the editor as tools, so an assistant can build and manipulate documents step by step while you watch.

```bash
cd prism-mcp
npm install
node server.js
```

Environment overrides:

- `PRISM_HTML` — path to the Prism HTML file (defaults to `../public/prism.html`).
- `PRISM_CHROME` — path to the Chrome executable.

The `*.mjs` files in `prism-mcp/` are runnable demos and smoke tests that connect over the MCP protocol, build a document, and export a PNG. For example:

```bash
node prism-mcp/poster.mjs
node prism-mcp/transform-demo.mjs
```

## Layout

```
public/prism.html     the entire editor, one file
prism-mcp/server.js   the MCP server
prism-mcp/*.mjs       demos and protocol smoke tests
```

The server resolves the app at `../public/prism.html` relative to itself, so keep the two folders as siblings.
