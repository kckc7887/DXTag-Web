// Tiny non-rendering DOM for deterministic event tests. Not browser emulation.
export function makeDOM(html) {
 let focused;
 const scrolls=[];
 const decode=s=>s.replace(/&(?:amp|lt|gt|quot|apos|#39|#10);/g,m=>({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&#39;':"'",'&#10;':'\n'}[m]));
 class Element {
  constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.attrs={};this.listeners={};this.dataset={};this.style={};this.value='';this.open=false;this.hidden=false;this.disabled=false;this._text='';this.classList={add:(...xs)=>this.className=[...new Set([...this.className.split(/\s+/),...xs])].join(' '),remove:(...xs)=>this.className=this.className.split(/\s+/).filter(x=>!xs.includes(x)).join(' '),contains:x=>this.className.split(/\s+/).includes(x),toggle:(x,force)=>{let add=force??!this.classList.contains(x);this.classList[add?'add':'remove'](x);return add;}};}
  get id(){return this.attrs.id??''} set id(x){this.attrs.id=x}
  get className(){return this.attrs.class??''} set className(x){this.attrs.class=x}
  setAttribute(k,v){this.attrs[k]=String(v);if(k==='hidden')this.hidden=true;if(k==='disabled')this.disabled=true;if(k==='open')this.open=true;if(k.startsWith('data-'))this.dataset[k.slice(5).replace(/-([a-z])/g,(_,x)=>x.toUpperCase())]=String(v)}
  getAttribute(k){return this.attrs[k]??null}
  removeAttribute(k){delete this.attrs[k];if(k==='hidden')this.hidden=false;if(k==='disabled')this.disabled=false}
  append(...xs){for(const x of xs){x.parentElement=this;this.children.push(x)}}
  appendChild(x){this.append(x);return x}
  get isConnected(){let n=this;while(n.parentElement)n=n.parentElement;return n.tagName==='DOCUMENT'}
  replaceChildren(...xs){for(const child of this.children)child.parentElement=null;this.children=[];this._text='';this.append(...xs)}
  set textContent(x){this._text=String(x);this.children=[]} get textContent(){return this._text+this.children.map(x=>x.textContent).join('')}
  set innerHTML(s){this.replaceChildren();parse(s,this);this.html=s} get innerHTML(){return this.html??''}
  addEventListener(type,fn){(this.listeners[type]??=[]).push(fn)}
  dispatch(type,event={}){const e={currentTarget:this,target:this,key:'',preventDefault(){this.defaultPrevented=true},...event};for(const fn of this.listeners[type]??[])fn(e);return e}
  click(){if(!this.disabled)this.dispatch('click')}
  focus(){focused=this} select(){this.selected=true}
  scrollIntoView(options){scrolls.push({element:this,...options})}
  matches(sel){const tag=sel.match(/^[a-z][\w-]*/i)?.[0];if(tag&&tag.toUpperCase()!==this.tagName)return false;for(const m of sel.matchAll(/#([\w-]+)/g))if(this.id!==m[1])return false;for(const m of sel.matchAll(/\.([\w-]+)/g))if(!this.classList.contains(m[1]))return false;for(const m of sel.matchAll(/\[([^=\]]+)(?:=["']?([^"'\]]+)["']?)?\]/g))if(!(m[1] in this.attrs)||(m[2]!==undefined&&this.attrs[m[1]]!==m[2]))return false;return true}
  querySelectorAll(sel){const sels=sel.split(',').map(x=>x.trim());const out=[];function visit(n){for(const c of n.children){if(sels.some(s=>c.matches(s)))out.push(c);visit(c)}}visit(this);return out}
  querySelector(sel){return this.querySelectorAll(sel)[0]??null}
 }
 class Details extends Element{constructor(){super('details')}}
 function parse(s,parent){const stack=[parent];const voids=new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);for(const token of s.match(/<!--[\s\S]*?-->|<![^>]*>|<[^>]+>|[^<]+/g)??[]){if(token.startsWith('<!'))continue;if(token.startsWith('</')){const tag=token.slice(2).match(/^[\w-]+/)?.[0]?.toUpperCase();for(let i=stack.length-1;i>0;i--)if(stack[i].tagName===tag){stack.length=i;break}continue}if(token.startsWith('<')){const tag=token.slice(1).match(/^[\w-]+/)?.[0];if(!tag)continue;const e=tag==='details'?new Details():new Element(tag);const attr=token.slice(tag.length+1).replace(/\/?\s*>$/,'');for(const m of attr.matchAll(/([^\s=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s]+)))?/g))e.setAttribute(m[1],decode(m[2]??m[3]??m[4]??''));stack.at(-1).append(e);if(!voids.has(tag)&&!token.endsWith('/>'))stack.push(e)}else stack.at(-1)._text+=decode(token)}}
 const root=new Element('document');parse(html,root);
 const document={getElementById:id=>root.querySelector('#'+id),querySelector:s=>root.querySelector(s),querySelectorAll:s=>root.querySelectorAll(s),createElement:tag=>tag==='details'?new Details():new Element(tag),createElementNS:(_,tag)=>new Element(tag),get activeElement(){return focused}};
 return {document,Element,Details,scrolls,root};
}

import {build} from 'esbuild';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
// Use the actual source HTML, renderer, radar, samples and analyzer. Only the
// host DOM, Worker transport and clipboard capability are simulated.
const dom=makeDOM(readFileSync('index.html','utf8'));
let worker,clipboard,reducedMotion=true;
const requests=[],timers=[],windowListeners={};
class Worker {constructor(){worker=this}postMessage(x){requests.push(x)}}
const ctx={console,URL,TextDecoder,Uint8Array,HTMLDetailsElement:dom.Details,HTMLElement:dom.Element,Worker,document:dom.document,window:{setTimeout(fn){timers.push(fn)},addEventListener(type,fn){(windowListeners[type]??=[]).push(fn)}},matchMedia:()=>({matches:reducedMotion}),CSS:{escape:x=>x},navigator:{clipboard:{async writeText(s){clipboard=s}}}};
const source=await build({entryPoints:['src/main.ts'],bundle:true,format:'iife',define:{'import.meta.url':'"http://localhost/main.ts"'},write:false});
const helpers=await build({stdin:{contents:"export * from './src/analyze'; export {SAMPLES} from './src/samples'; export {renderChartView,cliJson} from './src/render';",resolveDir:process.cwd()},bundle:true,format:'iife',globalName:'qa',write:false});
vm.runInNewContext(helpers.outputFiles[0].text,ctx);
vm.runInNewContext(source.outputFiles[0].text,ctx);
const $=id=>{const e=dom.document.getElementById(id);assert.ok(e,`Actual HTML must contain #${id}`);return e};
const settle=()=>new Promise(r=>setImmediate(r));
const last=()=>requests.at(-1);
const respond=(request=last())=>{const batch=ctx.qa.analyzeMaidata(request.text);worker.onmessage({data:{id:request.id,ok:true,...batch,slots:ctx.qa.listDifficulties(request.text)}});return batch};
const samples=()=>$('sample-list').children;
const showSample=()=>{samples()[0].click();return respond()};
const assertReport=batch=>{
 assert.equal($('results').hidden,false);
 assert.equal($('results').querySelectorAll('[data-axis]').length,5,'all real axis detail nodes rendered');
 assert.equal($('results').querySelectorAll('[data-jump]').length,5,'five score controls');
 const svg=$('radar-host').querySelector('svg');assert.ok(svg,'real SVG radar is mounted');
 for(const axis of ctx.qa.AXIS_ORDER)assert.ok(svg.getAttribute('aria-label').includes(axis));
 assert.equal(svg.querySelectorAll('.radar-dot').length,5);
 assert.equal($('results').querySelectorAll('table').length,5,'calculation evidence tables');
 assert.equal($('results').querySelectorAll('.evidence').length,5,'observation evidence for each axis');
 for(const id of ['star','burst','rhythm','lock'])assert.ok($('windows-'+id),'four hotspot evidence categories');
 assert.ok(!/NaN|undefined/.test($('results').textContent),'no missing or invalid rendered values');
 assert.equal($('results').querySelectorAll('.tab').length,batch.charts.length);
};
assert.equal(samples().length,ctx.qa.SAMPLES.length,'all actual examples available');
assert.equal(requests.length,1,'initial synthetic demo is actually scored');
assertReport(respond());
assert.ok($('results').querySelector('.source-label').textContent.includes('DEMO'),'initial example is explicitly labeled');
assert.equal(dom.scrolls.length,0,'initial demo does not scroll the viewport');
for(let i=0;i<samples().length;i++){samples()[i].click();const batch=respond();assertReport(batch)}
const first=last();
$('copy-json').click();await settle();
assert.equal(JSON.parse(clipboard).length,ctx.qa.analyzeMaidata(first.text).charts.length);
assert.deepEqual(Object.keys(JSON.parse(clipboard)[0]).sort(),['difficulty','scores','title']);
assert.equal(Object.keys(JSON.parse(clipboard)[0].scores).length,5);
const writeText=ctx.navigator.clipboard.writeText;
ctx.navigator.clipboard.writeText=async()=>{throw new Error('clipboard permission denied')};
$('copy-json').click();await settle();
assert.equal($('json-fallback').hidden,false);assert.equal($('json-output').selected,true);assert.equal(dom.document.activeElement,$('json-output'));assert.equal($('json-output').value,clipboard);
ctx.navigator.clipboard.writeText=writeText;
$('paste-toggle').click();assert.equal($('paste-wrap').hidden,false);assert.equal($('paste-toggle').getAttribute('aria-expanded'),'true');assert.equal(dom.document.activeElement,$('paste-area'));
$('paste-area').value='discard';$('paste-clear').click();assert.equal($('paste-area').value,'');assert.equal(dom.document.activeElement,$('paste-area'));
$('paste-run').click();assert.equal($('results').hidden,true);assert.ok($('status').className.includes('error'));respond(first);assert.equal($('results').hidden,true,'empty paste invalidates older response');
const input='&title=<img src=x onerror=alert(1)>\n&artist=<script>alert(2)</script>\n&inote_2=(120){4}1,2,3,4,E\n&inote_5=(150){8}1,2,3,4,5,6,7,8,E';
$('paste-area').value=input;$('paste-run').click();assert.equal(last().text,input);const multi=respond();assertReport(multi);
assert.equal($('results').querySelectorAll('script,img').length,0,'untrusted metadata never becomes executable HTML');
assert.ok($('results').innerHTML.includes('&lt;img'));
assert.ok($('results').querySelector('.tab[data-slot="5"]').classList.contains('is-active'),'hardest chart selected initially');
$('results').querySelector('.tab[data-slot="2"]').click();assert.equal($('results').querySelector('.tab[data-slot="2"]').getAttribute('aria-pressed'),'true');assert.equal(dom.document.activeElement,$('results').querySelector('.tab[data-slot="2"]'));
for(const row of $('results').querySelectorAll('[data-jump]')){row.click();const axis=ctx.qa.AXIS_ORDER[Number(row.dataset.jump)];assert.equal($('results').querySelector(`[data-axis="${axis}"]`).open,true)}
for(const control of $('radar-host').querySelectorAll('[role="button"]')){
 const axis=ctx.qa.AXIS_ORDER.find(a=>control.getAttribute('aria-label').startsWith(a));
 assert.ok(axis);assert.equal(control.getAttribute('tabindex'),'0');
 for(const key of ['Enter',' ']){const panel=$('results').querySelector(`[data-axis="${axis}"]`);panel.open=false;const event=control.dispatch('keydown',{key});assert.equal(panel.open,true);assert.equal(event.defaultPrevented,true);assert.equal(dom.document.activeElement,panel.querySelector('summary'))}
 const panel=$('results').querySelector(`[data-axis="${axis}"]`);panel.open=false;control.click();assert.equal(panel.open,true);
}
assert.equal($('radar-host').querySelectorAll('[role="button"]').length,5,'all radar label controls keyboard accessible');
for(const link of $('results').querySelectorAll('[data-window]')){const event=link.dispatch('click');const panel=$('windows-'+link.dataset.window);assert.equal(panel.open,true);assert.equal(event.defaultPrevented,true);assert.equal(dom.document.activeElement,panel.querySelector('summary'))}
assert.ok(dom.scrolls.length>0);assert.ok(dom.scrolls.every(s=>s.behavior!=='smooth'),'reduced motion never requests smooth scroll');
reducedMotion=false;showSample();assert.ok(dom.scrolls.some(s=>s.behavior==='smooth'),'normal motion scroll path exercised');reducedMotion=true;
$('reset-view').click();assert.equal($('results').hidden,true);assert.equal($('paste-wrap').hidden,true);assert.equal($('paste-area').value,'');assert.equal(dom.document.activeElement,$('drop-zone'));respond();assert.equal($('results').hidden,true,'reset invalidates pending responses');
let fileClicks=0;$('file-input').addEventListener('click',()=>fileClicks++);$('drop-zone').click();assert.equal(fileClicks,1,'import button opens file input');
const file={name:'chart.txt',arrayBuffer:async()=>new TextEncoder().encode(input).buffer};$('file-input').files=[file];$('file-input').dispatch('change');await settle();assert.equal(last().text,input);respond();assert.equal($('file-input').value,'');
$('drop-zone').dispatch('dragenter');assert.equal($('drop-zone').classList.contains('is-dragging'),true);$('drop-zone').dispatch('drop',{dataTransfer:{files:[file]}});await settle();assert.equal($('drop-zone').classList.contains('is-dragging'),false);assert.equal(last().text,input);respond();
for(const type of ['drop','dragover']){let prevented=false;for(const fn of windowListeners[type]??[])fn({preventDefault(){prevented=true}});assert.equal(prevented,true,`${type} outside input cannot navigate away`)}
// An absent clipboard API takes the same usable manual-copy path.
ctx.navigator.clipboard=undefined;$('copy-json').click();await settle();assert.equal($('json-fallback').hidden,false);assert.equal($('json-output').selected,true);
ctx.navigator.clipboard={writeText};
// An old denied clipboard promise must never open a fallback on newer results.
let rejectCopy;ctx.navigator.clipboard.writeText=()=>new Promise((_,reject)=>rejectCopy=reject);$('copy-json').click();showSample();rejectCopy(new Error('late denial'));await settle();assert.equal($('json-fallback').hidden,true);ctx.navigator.clipboard.writeText=writeText;
let resolveFile;$('file-input').files=[{name:'slow.txt',arrayBuffer:()=>new Promise(r=>resolveFile=r)}];$('file-input').dispatch('change');samples()[0].click();const newer=last();resolveFile(new TextEncoder().encode('obsolete').buffer);await settle();assert.equal(last().id,newer.id,'late file decode cannot replace newer input');respond(newer);
let rejectFile;$('file-input').files=[{name:'slow-error.txt',arrayBuffer:()=>new Promise((_,r)=>rejectFile=r)}];$('file-input').dispatch('change');showSample();const goodStatus=$('status').textContent;rejectFile(new Error('old failure'));await settle();assert.equal($('status').textContent,goodStatus,'stale file failure ignored');
samples()[0].click();const stale=last();samples()[1].click();const fresh=last();respond(fresh);const freshHTML=$('results').innerHTML;respond(stale);assert.equal($('results').innerHTML,freshHTML,'old worker result ignored');
$('paste-area').value='bad';$('paste-run').click();worker.onmessage({data:{id:last().id,ok:false,message:'bad input'}});assert.equal($('results').hidden,true);assert.equal($('status').textContent,'bad input');
$('paste-run').click();worker.onmessage({data:{id:last().id,ok:true,charts:[],slots:[],errors:[{difficulty:'MASTER',message:'unsupported chart'}]}});assert.equal($('results').hidden,true);assert.ok($('errors').textContent.includes('unsupported chart'));
// Partial success preserves scored results and disables the failed difficulty.
samples()[0].click();const partial=ctx.qa.analyzeMaidata(last().text);worker.onmessage({data:{id:last().id,ok:true,...partial,slots:[...ctx.qa.listDifficulties(last().text),{slot:6,name:'Re:MASTER'}],errors:[{difficulty:'Re:MASTER',message:'unsupported chart'}]}});
assert.equal($('results').hidden,false);assert.equal($('results').querySelector('.tab[data-slot="6"]').disabled,true);assert.ok($('errors').textContent.includes('unsupported chart'));
showSample();worker.onerror();assert.equal($('results').hidden,true);assert.ok($('status').className.includes('error'));respond();assert.equal($('results').hidden,true,'worker error invalidates response');
$('file-input').files=[{name:'bad.txt',arrayBuffer:async()=>{throw new Error('file could not be read')}}];$('file-input').dispatch('change');await settle();assert.equal($('results').hidden,true);assert.ok($('status').textContent.includes('file could not be read'));
const css=readFileSync('src/style.css','utf8');assert.match(css,/prefers-reduced-motion\s*:\s*reduce/);assert.match(css,/:focus-visible/);assert.match(css,/@media/);
console.log('PASS source-backed simulated-DOM UI: all examples, file/drop/paste, five-axis SVG + evidence + four hotspot categories, multi-difficulty selection/focus, escaped metadata, JSON + denied clipboard fallback, reset, empty/error states, worker/file races, reduced-motion behavior and focus CSS. Not a real browser/render, layout, viewport, clipboard-permission or screen-reader test.');
