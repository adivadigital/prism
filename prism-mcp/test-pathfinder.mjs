import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'node:url'; import { dirname, resolve } from 'node:path';
const __dirname=dirname(fileURLToPath(import.meta.url));
const transport=new StdioClientTransport({command:'node',args:[resolve(__dirname,'server.js')]});
const client=new Client({name:'pf',version:'0.0.1'},{capabilities:{}});
await client.connect(transport);
const call=async(n,a={})=>{const r=await client.callTool({name:n,arguments:a});const t=r.content.find(c=>c.type==='text');let o={};try{o=JSON.parse(t.text)}catch{}if(r.isError)console.log('ERR',n,t.text);return o;};
const circle=(cx,cy,r,fill,name)=>{ const pts=[]; for(let i=0;i<24;i++){const a=i/24*Math.PI*2; pts.push([Math.round(cx+r*Math.cos(a)), Math.round(cy+r*Math.sin(a))]);} return call('prism_add_path',{points:pts, closed:true, smooth:true, fill, name}); };
console.log('has prism_combine_paths:', (await client.listTools()).tools.some(t=>t.name==='prism_combine_paths'));
await call('prism_new_document',{width:320,height:320,background:'#0f1330'});
const A=await circle(150,160,95,'#ffd24a','A');   // yellow disc
const B=await circle(200,160,95,'#0f1330','B');   // overlapping disc (cutter)
const r=await call('prism_combine_paths',{ ids:[A.id, B.id], op:'subtract', smooth:true });
console.log('crescent points:', r.points);
await call('prism_export_png',{path:resolve(__dirname,'pathfinder-out.png')});
console.log('saved pathfinder-out.png');
await client.close(); process.exit(0);
