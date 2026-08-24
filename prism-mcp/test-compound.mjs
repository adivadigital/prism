import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'node:url'; import { dirname, resolve } from 'node:path';
const __dirname=dirname(fileURLToPath(import.meta.url));
const transport=new StdioClientTransport({command:'node',args:[resolve(__dirname,'server.js')]});
const client=new Client({name:'cpd',version:'0.0.1'},{capabilities:{}});
await client.connect(transport);
const call=async(n,a={})=>{const r=await client.callTool({name:n,arguments:a});const t=r.content.find(c=>c.type==='text');let o={};try{o=JSON.parse(t.text)}catch{}if(r.isError)console.log('ERR',n,t.text);return o;};
const disc=(cx,cy,rad,fill,name)=>{const pts=[];for(let i=0;i<28;i++){const a=i/28*Math.PI*2;pts.push([Math.round(cx+rad*Math.cos(a)),Math.round(cy+rad*Math.sin(a))]);}return call('prism_add_path',{points:pts,closed:true,smooth:true,fill,name});};
console.log('has make_compound:', (await client.listTools()).tools.some(t=>t.name==='prism_make_compound_path'));
await call('prism_new_document',{width:340,height:340,background:'#0f1330'});
// ring via pathfinder subtract (outer disc minus inner disc) -> real hole shows the dark bg through it
const outer=await disc(120,170,95,'#ffd24a','outer');
const inner=await disc(120,170,50,'#ffd24a','inner');
const ring=await call('prism_combine_paths',{ids:[outer.id, inner.id], op:'subtract', smooth:true});
console.log('ring holes:', ring.holes);
// a second ring made explicitly with a hole via addPath, offset to the right, coral
const o2=await disc(230,170,80,'#ff5f6d','o2'); // just to reuse coords; then a compound directly:
await call('prism_delete_layer',{id:o2.id});
const r2=await call('prism_add_path',{
  points:(()=>{const p=[];for(let i=0;i<28;i++){const a=i/28*Math.PI*2;p.push([Math.round(235+80*Math.cos(a)),Math.round(170+80*Math.sin(a))]);}return p;})(),
  holes:[(()=>{const p=[];for(let i=0;i<24;i++){const a=i/24*Math.PI*2;p.push([Math.round(235+38*Math.cos(a)),Math.round(170+38*Math.sin(a))]);}return p;})()],
  smooth:true, fill:'#3aa0ff', name:'Ring2'
});
console.log('Ring2 holes:', r2.holes);
await call('prism_export_png',{path:resolve(__dirname,'compound-out.png')});
console.log('saved compound-out.png');
await client.close(); process.exit(0);
