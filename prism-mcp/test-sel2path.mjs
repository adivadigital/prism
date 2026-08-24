import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'node:url'; import { dirname, resolve } from 'node:path';
const __dirname=dirname(fileURLToPath(import.meta.url));
const transport=new StdioClientTransport({command:'node',args:[resolve(__dirname,'server.js')]});
const client=new Client({name:'sel2path',version:'0.0.1'},{capabilities:{}});
await client.connect(transport);
const call=async(n,a={})=>{const r=await client.callTool({name:n,arguments:a});const t=r.content.find(c=>c.type==='text');let o={};try{o=JSON.parse(t.text)}catch{}if(r.isError)console.log('ERR',n,t.text);return o;};
console.log('has prism_selection_to_path:', (await client.listTools()).tools.some(t=>t.name==='prism_selection_to_path'));
await call('prism_new_document',{width:360,height:280,background:'#0f1330'});
// a rough polygon path -> selection (the "source" region), then trace it back as a SMOOTH work path
const poly=await call('prism_add_path',{ points:[[70,60],[180,40],[300,90],[280,200],[150,240],[60,180]], closed:true, fill:'#3aa0ff', name:'Region' });
await call('prism_path_to_selection',{ id: poly.id });
// now trace the selection into a smooth editable path, give it a bright stroke to show the trace
const wp=await call('prism_selection_to_path',{ smooth:true, tolerance:3 });
console.log('work path points:', wp.points);
const info=await call('prism_info');
const id=info.layers.find(l=>l.name==='Work Path').id;
// (the work path is stroke-only by default with fg color) — recolor stroke bright yellow, thick
await call('prism_export_png',{path:resolve(__dirname,'sel2path-out.png')});
console.log('saved sel2path-out.png');
await client.close(); process.exit(0);
