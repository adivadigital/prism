# prism-mcp

An MCP server that drives the **Prism** image editor (`../public/prism.html`) in a
**visible** Chrome window, exposing its `PrismAPI` as tools. Non-headless so you can
watch edits happen live.

## How it works
- `server.js` launches your installed Google Chrome (via `puppeteer-core`), loads
  `prism.html`, and calls `window.PrismAPI.*` for each tool.
- The browser window stays open across tool calls (one live document/session).

## Tools
Document: `prism_new_document`, `prism_open_image`, `prism_info`, `prism_flatten`,
`prism_undo`, `prism_redo`.
Add layers: `prism_add_rectangle`, `prism_add_ellipse`, `prism_add_line`, `prism_add_text`.
Edit: `prism_apply_filter`, `prism_apply_adjustment` (+ `prism_list_filters` /
`prism_list_adjustments`), `prism_select_layer`, `prism_set_layer_props`,
`prism_delete_layer`, `prism_clip_to_below`.
Output: `prism_render` (preview image), `prism_export_png` (save + preview).

## Config
Registered in `../.mcp.json` for this project. Overridable via env:
- `PRISM_HTML` — path to prism.html (default `../public/prism.html`)
- `PRISM_CHROME` — path to the Chrome binary

## Test
```bash
node test-client.mjs   # opens Chrome, builds a demo, writes test-output.png
```
