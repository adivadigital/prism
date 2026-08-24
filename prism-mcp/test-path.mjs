import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'node:url'; import { dirname, resolve } from 'node:path';
const __dirname=dirname(fileURLToPath(import.meta.url));
const transport=new StdioClientTransport({command:'node',args:[resolve(__dirname,'server.js')]});
const client=new Client({name:'path',version:'0.0.1'},{capabilities:{}});
await client.connect(transport);
const call=async(n,a={})=>{const r=await client.callTool({name:n,arguments:a});const t=r.content.find(c=>c.type==='text');let o={};try{o=JSON.parse(t.text)}catch{}if(r.isError)console.log('ERR',n,t.text);return o;};
console.log('has prism_add_path:', (await client.listTools()).tools.some(t=>t.name==='prism_add_path'));
await call('prism_new_document',{width:520,height:340,background:'#0f1330'});
// smooth open wave (auto-smooth through anchors)
await call('prism_add_path',{ points:[[40,180],[140,110],[240,200],[340,110],[460,190]], smooth:true, stroke:'#3aa0ff', strokeWidth:6, name:'Wave' });
// closed smooth blob (auto-smooth, filled)
await call('prism_add_path',{ points:[[120,60],[240,50],[300,120],[250,200],[130,190],[90,120]], smooth:true, closed:true, fill:'#ff5f6d', stroke:'#ffd24a', strokeWidth:3, name:'Blob' });
const out=resolve(__dirname,'path-out.png');
await call('prism_export_png',{path:out});
console.log('saved',out);
await client.close(); process.exit(0);
