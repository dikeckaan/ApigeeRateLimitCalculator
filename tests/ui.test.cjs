const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM,VirtualConsole}=require('jsdom');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
function open(source=html){
 const errors=[],blobs=[],downloads=[];const virtualConsole=new VirtualConsole();virtualConsole.on('jsdomError',e=>errors.push(e.message));
 const dom=new JSDOM(source,{runScripts:'dangerously',url:'file:///tmp/spike-arrest.html',virtualConsole,beforeParse(w){
  w.URL.createObjectURL=b=>{blobs.push(b);return 'blob:test/'+blobs.length;};w.URL.revokeObjectURL=()=>{};
  w.HTMLAnchorElement.prototype.click=function(){downloads.push({name:this.download,url:this.href});};
 }});
 const w=dom.window,$=id=>w.document.getElementById(id);
 const input=(id,value)=>{$(id).value=String(value);$(id).dispatchEvent(new w.Event('input',{bubbles:true}));};
 const blobText=blob=>new Promise((resolve,reject)=>{const r=new w.FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsText(blob);});
 return {dom,w,$,input,errors,blobs,downloads,blobText};
}
test('initial UI renders baseline, comparison, chart and MP cards without errors',()=>{
 const x=open();try{assert.equal(x.$('passed').textContent,'20');assert.equal(x.$('blocked').textContent,'20');assert.equal(x.$('comparison').children.length,4);assert.equal(x.$('mpSummary').children.length,2);assert(x.$('chart').querySelector('svg'));assert(x.$('capacity').closest('#config'));assert.deepEqual(x.errors,[]);}finally{x.w.close();}
});
test('profile controls, invalid input recovery, presets and result filtering',()=>{
 const x=open();try{
  x.input('traffic','custom');assert.equal(x.$('standardFields').hidden,true);assert.equal(x.$('customField').hidden,false);
  x.input('timestamps','-1');assert.equal(x.$('results').hidden,true);assert.equal(x.$('timestamps').getAttribute('aria-invalid'),'true');
  x.input('timestamps','0,100');assert.equal(x.$('results').hidden,false);
  x.input('capacity','');assert.equal(x.$('results').hidden,true);assert(!x.$('capacity').closest('[hidden]'));
  x.input('capacity',10);assert.equal(x.$('results').hidden,false);
  x.w.document.querySelector('[data-preset="boundary"]').click();assert.equal(x.$('passed').textContent,'2');assert.equal(x.$('blocked').textContent,'2');assert.equal(x.$('effective').disabled,true);
  x.$('filter').value='429';x.$('filter').dispatchEvent(new x.w.Event('change'));assert.equal(x.$('rows').children.length,2);
  x.$('timeline').children[2].click();assert.match(x.$('detail').textContent,/#3.*429/);
  x.w.document.querySelector('[data-preset="edge"]').click();assert.equal(x.$('effective').disabled,false);assert.equal(x.$('passed').textContent,'20');
  assert.deepEqual(x.errors,[]);
 }finally{x.w.close();}
});
test('downloaded HTML removes button, retains settings and works offline after re-opening',async()=>{
 const x=open();let offline;
 try{
  x.input('model','x');x.input('unit','pm');x.input('rate',7);x.input('mps',3);x.input('traffic','custom');x.input('timestamps','100, 200, 200, 300');x.input('start',50);x.input('routing','random');x.input('seed',123);x.input('capacity',4);
  const before=x.$('passed').textContent;x.$('downloadHtml').click();assert.equal(x.downloads.at(-1).name,'spike-arrest-offline.html');
  const exported=await x.blobText(x.blobs.at(-1));offline=open(exported);
  assert.equal(offline.$('downloadHtml'),null);assert.equal(offline.w.document.querySelector('[data-online-only]'),null);
  for(const id of ['model','unit','rate','mps','traffic','timestamps','start','routing','seed','capacity'])assert.equal(offline.$(id).value,x.$(id).value,id);
  assert.equal(offline.$('passed').textContent,before);assert.equal(offline.$('results').hidden,false);
  offline.input('rate',1);assert.equal(offline.$('blocked').textContent,'3');assert.deepEqual(offline.errors,[]);
  assert(!/<script[^>]+src=|<link[^>]+href=/.test(exported));assert.deepEqual(x.errors,[]);
 }finally{x.w.close();offline?.w.close();}
});
test('CSV includes filtered-out requests and JSON export includes full configuration',async()=>{
 const x=open();try{
  x.$('filter').value='429';x.$('filter').dispatchEvent(new x.w.Event('change'));x.$('csv').click();const csv=await x.blobText(x.blobs.at(-1));assert.equal(csv.split('\r\n').length,41);assert(csv.includes(',200,'));assert(csv.includes(',429,'));
  x.$('saveConfig').click();const json=JSON.parse(await x.blobText(x.blobs.at(-1)));assert.equal(json.version,2);assert.equal(json.config.rate,10);assert.equal(json.config.traffic,'steady');assert.equal(json.config.capacity,10);
 }finally{x.w.close();}
});
test('scenario import validates before changing UI and rejects invalid files',async()=>{
 const x=open();try{
  const choose=async data=>{const text=JSON.stringify(data);Object.defineProperty(x.$('configFile'),'files',{configurable:true,value:[{size:text.length,text:async()=>text}]});x.$('configFile').dispatchEvent(new x.w.Event('change'));await new Promise(r=>setTimeout(r,0));};
  await choose({version:2,config:{rate:5,model:'x',traffic:'burst',burstSize:10,interval:1000,count:20}});assert.equal(x.$('rate').value,'5');assert.equal(x.$('passed').textContent,'10');
  await choose({version:2,config:{rate:-1}});assert.equal(x.$('rate').value,'5');assert.match(x.$('notice').textContent,/açılamadı/);
  await choose({version:1,config:{rate:99}});assert.equal(x.$('rate').value,'5');assert.deepEqual(x.errors,[]);
 }finally{x.w.close();}
});

test('quota workspace runs multi-limit plan, marks stale results, paginates and validates edits',()=>{
 const x=open();try{
  x.$('quotaTab').click();assert.equal(x.$('spikeLab').hidden,true);assert.equal(x.$('qResults').hidden,false);assert.equal(x.$('qTotal').textContent,'28.000');assert.equal(x.$('qRuleStats').children.length,5);assert.equal(x.$('qRows').children.length,100);
  x.$('qNext').click();assert.equal(x.$('qRows').firstElementChild.firstElementChild.textContent,'101');
  x.input('qBase',1000);assert.equal(x.$('qStale').hidden,false);assert.equal(x.$('qTotal').textContent,'28.000');
  x.$('quotaConfig').dispatchEvent(new x.w.Event('submit',{cancelable:true}));assert.equal(x.$('qTotal').textContent,'21.000');assert.equal(x.$('qStale').hidden,true);
  x.input('qBase',100000);assert.equal(x.$('qRun').disabled,true);assert.equal(x.$('qError').hidden,false);x.input('qBase',0);assert.equal(x.$('qRun').disabled,false);
  x.$('addRule').click();assert.equal(x.$('quotaRules').children.length,6);const last=x.$('quotaRules').lastElementChild;const unit=last.querySelector('[data-field="unit"]');unit.value='month';unit.dispatchEvent(new x.w.Event('input',{bubbles:true}));assert.equal(last.querySelector('[data-field="mode"]').disabled,true);
  last.querySelector('[data-remove-rule]').click();assert.equal(x.$('quotaRules').children.length,5);
  x.$('addPeak').click();const peak=x.$('quotaPeaks').lastElementChild;const repeat=peak.querySelector('[data-field="repeat"]');repeat.value='once';repeat.dispatchEvent(new x.w.Event('input',{bubbles:true}));assert.equal(peak.querySelector('[data-date-wrap]').hidden,false);
  assert.deepEqual(x.errors,[]);
 }finally{x.w.close();}
});
test('download retains quota rules, peaks, active workspace and can rerun without download button',async()=>{
 const x=open();let offline;try{
  x.$('quotaTab').click();x.input('qBase',100);x.input('qBaseUnit','total');x.input('qCounting','attempts');x.input('qSeed',99);x.$('addPeak').click();
  const last=x.$('quotaPeaks').lastElementChild;last.querySelector('[data-field="amount"]').value='321';last.querySelector('[data-field="repeat"]').value='once';last.querySelector('[data-field="date"]').value='2026-09-04';
  x.$('quotaConfig').dispatchEvent(new x.w.Event('submit',{cancelable:true}));const count=x.$('qTotal').textContent;
  x.$('downloadHtml').click();offline=open(await x.blobText(x.blobs.at(-1)));
  assert.equal(offline.$('downloadHtml'),null);assert.equal(offline.$('quotaLab').hidden,false);assert.equal(offline.$('qBase').value,'100');assert.equal(offline.$('qCounting').value,'attempts');assert.equal(offline.$('quotaPeaks').children.length,3);assert.equal(offline.$('qTotal').textContent,count);assert.deepEqual(offline.errors,[]);
 }finally{x.w.close();offline?.w.close();}
});
test('quota plan JSON round trip, filter-aware CSV, and empty traffic state',async()=>{
 const x=open();try{
  x.$('quotaTab').click();x.$('qSave').click();const plan=JSON.parse(await x.blobText(x.blobs.at(-1)));assert.equal(plan.kind,'quota');assert.equal(plan.config.rules.length,5);assert.equal(plan.config.peaks.length,2);
  plan.config.base=7;plan.config.baseUnit='total';plan.config.peaks=[];plan.config.rules=[];
  const text=JSON.stringify(plan);Object.defineProperty(x.$('qFile'),'files',{configurable:true,value:[{size:text.length,text:async()=>text}]});x.$('qFile').dispatchEvent(new x.w.Event('change'));await new Promise(r=>setTimeout(r,0));assert.equal(x.$('qTotal').textContent,'7');assert.equal(x.$('qPassed').textContent,'7');
  x.$('qFilter').value='429';x.$('qFilter').dispatchEvent(new x.w.Event('change'));x.$('qCSV').click();const csv=await x.blobText(x.blobs.at(-1));assert.equal(csv.split('\r\n').length,1);
  x.input('qBase',0);x.$('quotaConfig').dispatchEvent(new x.w.Event('submit',{cancelable:true}));assert.equal(x.$('qTotal').textContent,'0');assert.equal(x.$('qRatio').textContent,'Trafik yok');assert.deepEqual(x.errors,[]);
 }finally{x.w.close();}
});
