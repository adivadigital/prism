import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'node:url'; import { dirname, resolve } from 'node:path';
const __dirname=dirname(fileURLToPath(import.meta.url));
const transport=new StdioClientTransport({command:'node',args:[resolve(__dirname,'server.js')]});
const client=new Client({name:'stroke',version:'0.0.1'},{capabilities:{}});
await client.connect(transport);
const call=async(n,a={})=>{const r=await client.callTool({name:n,arguments:a});const t=r.content.find(c=>c.type==='text');let o={};try{o=JSON.parse(t.text)}catch{}if(r.isError)console.log('ERR',n,t.text);return o;};
console.log('has prism_set_stroke:', (await client.listTools()).tools.some(t=>t.name==='prism_set_stroke'));
await call('prism_new_document',{width:420,height:300,background:'#0f1330'});
// 1) dashed rounded rect (created dashed via addPath)
await call('prism_add_path',{points:[[30,30],[190,30],[190,120],[30,120]], closed:true, fill:null, stroke:'#ffd24a', strokeWidth:5, dash:[16,10], cap:'round', name:'Dashed'});
// 2) dotted line
await call('prism_add_path',{points:[[30,155],[190,155]], stroke:'#3aa0ff', strokeWidth:7, dash:[2,12], cap:'round', name:'Dotted'});
// 3) zigzag with MITER joins (sharp corners), thick
await call('prism_add_path',{points:[[230,120],[270,40],[310,120],[350,40],[390,120]], closed:false, stroke:'#ff5f6d', strokeWidth:12, join:'miter', cap:'square', name:'Zig-miter'});
// 4) same zigzag lower with ROUND joins for contrast
await call('prism_add_path',{points:[[230,270],[270,190],[310,270],[350,190],[390,270]], closed:false, stroke:'#7bd88f', strokeWidth:12, join:'round', cap:'round', name:'Zig-round'});
// 5) long dash-dot underline
await call('prism_add_path',{points:[[30,200],[190,200]], stroke:'#e0e0e0', strokeWidth:4, dash:[18,8,3,8], cap:'butt', name:'DashDot'});
await call('prism_export_png',{path:resolve(__dirname,'stroke-out.png')});
console.log('saved stroke-out.png');
await client.close(); process.exit(0);
