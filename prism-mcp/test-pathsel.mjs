import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'node:url'; import { dirname, resolve } from 'node:path';
const __dirname=dirname(fileURLToPath(import.meta.url));
const transport=new StdioClientTransport({command:'node',args:[resolve(__dirname,'server.js')]});
const client=new Client({name:'pathsel',version:'0.0.1'},{capabilities:{}});
await client.connect(transport);
const call=async(n,a={})=>{const r=await client.callTool({name:n,arguments:a});const t=r.content.find(c=>c.type==='text');let o={};try{o=JSON.parse(t.text)}catch{}if(r.isError)console.log('ERR',n,t.text);return o;};
console.log('has prism_path_to_selection:', (await client.listTools()).tools.some(t=>t.name==='prism_path_to_selection'));
await call('prism_new_document',{width:440,height:300,background:'#0f1330'});
// a full blue field
await call('prism_add_rectangle',{x:0,y:0,w:440,h:300,fill:'#3aa0ff',name:'Field'});
// a smooth blob path (outline only)
const path=await call('prism_add_path',{ points:[[120,70],[300,60],[360,150],[300,240],[130,235],[80,150]], smooth:true, closed:true, fill:null, stroke:'#ffd24a', strokeWidth:3, name:'Outline' });
// path -> selection
const sel=await call('prism_path_to_selection',{ id: path.id });
console.log('selection bounds:', JSON.stringify(sel.bounds));
// recolor the Field, constrained to the selection
await call('prism_select_layer',{ id: (await call('prism_info')).layers.find(l=>l.name==='Field').id });
await call('prism_apply_adjustment',{ kind:'huesat', params:{ h:150, s:20 } });
const out=resolve(__dirname,'pathsel-out.png');
await call('prism_export_png',{path:out});
console.log('saved',out);
await client.close(); process.exit(0);
