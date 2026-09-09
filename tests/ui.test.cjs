const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM,VirtualConsole}=require('jsdom');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
function open(source=html,url='file:///tmp/spike-arrest.html'){
 const errors=[],blobs=[],downloads=[];const virtualConsole=new VirtualConsole();virtualConsole.on('jsdomError',e=>errors.push(e.message));
 const dom=new JSDOM(source,{runScripts:'dangerously',url,virtualConsole,beforeParse(w){
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
  await choose({version:2,config:{rate:-1}});assert.equal(x.$('rate').value,'5');assert.match(x.$('notice').textContent,/Could not open/);
  await choose({version:1,config:{rate:99}});assert.equal(x.$('rate').value,'5');assert.deepEqual(x.errors,[]);
 }finally{x.w.close();}
});

test('quota workspace runs multi-limit plan, marks stale results, paginates and validates edits',()=>{
 const x=open();try{
  x.$('quotaTab').click();assert.equal(x.$('spikeLab').hidden,true);assert.equal(x.$('qResults').hidden,false);assert.equal(x.$('qTotal').textContent,'28,000');assert.equal(x.$('qRuleStats').children.length,5);assert.equal(x.$('qRows').children.length,100);
  x.$('qNext').click();assert.equal(x.$('qRows').firstElementChild.firstElementChild.textContent,'101');
  x.input('qBase',1000);assert.equal(x.$('qStale').hidden,false);assert.equal(x.$('qTotal').textContent,'28,000');
  x.$('quotaConfig').dispatchEvent(new x.w.Event('submit',{cancelable:true}));assert.equal(x.$('qTotal').textContent,'21,000');assert.equal(x.$('qStale').hidden,true);
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
  x.input('qBase',0);x.$('quotaConfig').dispatchEvent(new x.w.Event('submit',{cancelable:true}));assert.equal(x.$('qTotal').textContent,'0');assert.equal(x.$('qRatio').textContent,'No traffic');assert.deepEqual(x.errors,[]);
 }finally{x.w.close();}
});

test('entire active site is English, including generated labels and validation',()=>{
 const x=open();try{
  assert.equal(x.w.document.documentElement.lang,'en');assert(!/[çğıöşüÇĞİÖŞÜ]/.test(html));
  x.input('traffic','jitter');x.$('quotaTab').click();x.input('qBase','');assert.match(x.$('qError').textContent,/enter an integer/);
  const copy=x.w.document.body.cloneNode(true);copy.querySelectorAll('script,style').forEach(n=>n.remove());assert(!/\b(istek|kabul|ret|pik|taban|sayfa|saniye|dakika)\b/i.test(copy.textContent));
  assert.deepEqual(x.errors,[]);
 }finally{x.w.close();}
});
test('Spike Arrest random mode draws per recalculation, fixed mode repeats and New seed preserves mode',async()=>{
 const x=open();try{
  x.input('traffic','jitter');assert.equal(x.$('seedMode').value,'random');assert.equal(x.$('seed').readOnly,true);const first=x.$('seed').value;
  x.input('rate',12);assert.notEqual(x.$('seed').value,first);const drawn=x.$('seed').value;
  x.input('seedMode','fixed');assert.equal(x.$('seed').value,drawn);assert.equal(x.$('seed').readOnly,false);
  x.input('seed',1234);const times=x.w.makeTraffic(x.w.read()).map(r=>r.t).join(',');x.input('rate',15);assert.equal(x.$('seed').value,'1234');assert.equal(x.w.makeTraffic(x.w.read()).map(r=>r.t).join(','),times);
  x.$('newSeed').click();assert.notEqual(x.$('seed').value,'1234');assert.equal(x.$('seedMode').value,'fixed');
  x.input('seedMode','random');const used=x.$('seed').value;x.$('saveConfig').click();const saved=JSON.parse(await x.blobText(x.blobs.at(-1)));assert.equal(saved.config.seedMode,'fixed');assert.equal(saved.config.seed,Number(used));assert.equal(x.$('seedMode').value,'random');
  assert.deepEqual(x.errors,[]);
 }finally{x.w.close();}
});
test('quota random mode draws only when run; fixed seeds and exported snapshots are repeatable',async()=>{
 const x=open();let offline;try{
  x.$('quotaTab').click();const initial=x.$('qSeed').value;x.input('qBase',100);assert.equal(x.$('qSeed').value,initial);
  x.$('quotaConfig').dispatchEvent(new x.w.Event('submit',{cancelable:true}));assert.notEqual(x.$('qSeed').value,initial);const random=x.$('qSeed').value;
  x.input('qSeedMode','fixed');assert.equal(x.$('qSeed').readOnly,false);x.$('quotaConfig').dispatchEvent(new x.w.Event('submit',{cancelable:true}));assert.equal(x.$('qSeed').value,random);
  const total=x.$('qPassed').textContent;x.$('quotaConfig').dispatchEvent(new x.w.Event('submit',{cancelable:true}));assert.equal(x.$('qPassed').textContent,total);
  x.$('qNewSeed').click();assert.notEqual(x.$('qSeed').value,random);assert.equal(x.$('qSeedMode').value,'fixed');
  x.input('qSeedMode','random');x.$('quotaConfig').dispatchEvent(new x.w.Event('submit',{cancelable:true}));const used=x.$('qSeed').value;
  x.$('qSave').click();const plan=JSON.parse(await x.blobText(x.blobs.at(-1)));assert.equal(plan.config.seedMode,'fixed');assert.equal(plan.config.seed,Number(used));
  x.$('downloadHtml').click();offline=open(await x.blobText(x.blobs.at(-1)));assert.equal(offline.$('qSeedMode').value,'fixed');assert.equal(offline.$('qSeed').value,used);assert.equal(offline.$('qPassed').textContent,x.$('qPassed').textContent);assert.equal(offline.$('qSeed').readOnly,false);assert.equal(x.$('qSeedMode').value,'random');assert.deepEqual(offline.errors,[]);
 }finally{x.w.close();offline?.w.close();}
});
test('guide chapters, search, navigation, print and examples work',()=>{
 const x=open();try{
  x.$('guideTab').click();assert.equal(x.$('userGuide').hidden,false);assert.equal(x.$('spikeLab').hidden,true);assert.equal(x.$('quotaLab').hidden,true);assert.equal(x.$('guideTOC').children.length,20);
  const links=Array.from(x.$('guideTOC').children);links.forEach(a=>assert(x.w.document.querySelector(a.getAttribute('href'))));
  assert(x.$('userGuide').textContent.trim().split(/\s+/).length>3500);
  x.input('guideSearch','monthly reset');assert(links.some(a=>a.hidden));assert(links.some(a=>!a.hidden));
  x.input('guideSearch','zzznomatchingchapter');assert.equal(x.$('guideEmpty').hidden,false);assert.equal(x.$('guideMatches').textContent,'0 of 20 chapters');
  x.$('clearGuide').click();assert(links.every(a=>!a.hidden));let printed=false;x.w.print=()=>{printed=true;};x.$('printGuide').click();assert.equal(printed,true);
  x.w.document.querySelector('[data-guide-example="boundary"]').click();assert.equal(x.$('spikeLab').hidden,false);assert.equal(x.$('passed').textContent,'2');
  assert.deepEqual(x.errors,[]);
 }finally{x.w.close();}
});
test('guide deep links open the correct workspace and offline snapshots retain the complete guide',async()=>{
 const x=open(html,'https://example.test/#guide-seeds');let offline;try{
  assert.equal(x.$('userGuide').hidden,false);assert.equal(x.$('guide-seeds').hidden,false);assert.equal(x.$('guideTab').getAttribute('aria-pressed'),'true');
  x.$('downloadHtml').click();offline=open(await x.blobText(x.blobs.at(-1)));assert.equal(offline.$('downloadHtml'),null);assert.equal(offline.$('userGuide').hidden,false);assert.equal(offline.$('guideTOC').children.length,20);offline.input('guideSearch','Poisson');assert.equal(offline.$('guideEmpty').hidden,true);assert.deepEqual(offline.errors,[]);
 }finally{x.w.close();offline?.w.close();}
});
test('guide JSON examples load and legacy files default to fixed seeds',()=>{
 const x=open();try{
  const examples=Array.from(x.$('guide-saving').querySelectorAll('pre'),n=>JSON.parse(n.textContent));assert.equal(examples.length,2);
  assert.equal(x.w.validateConfig(examples[0].config).seedMode,'fixed');const q=x.w.qValidate(examples[1].config);assert.equal(x.w.qSimulate(q).rows.filter(r=>r.status===200).length,50);
  assert.equal(x.w.validateConfig({rate:10}).seedMode,'fixed');assert.equal(x.w.qValidate({base:10}).seedMode,'fixed');
  assert.throws(()=>x.w.validateConfig({seedMode:'invalid'}));assert.throws(()=>x.w.qValidate({seedMode:'invalid'}));
  assert.deepEqual(x.errors,[]);
 }finally{x.w.close();}
});

test('CSV advisor loads examples, maps Edge columns and analyzes supported periods',()=>{
 const x=open();try{
  x.$('advisorTab').click();assert.equal(x.$('advisorLab').hidden,false);assert.equal(x.$('spikeLab').hidden,true);
  x.$('aEventSample').click();assert.equal(x.$('aMode').value,'events');assert.equal(x.$('aMap-api').value,'1');assert.equal(x.$('aError').hidden,true);
  x.$('advisorConfig').dispatchEvent(new x.w.Event('submit',{cancelable:true}));assert.equal(x.$('aResults').hidden,false);assert.equal(x.$('aAnalyzedCount').textContent,'720');assert.equal(x.$('aRecommendations').children.length,5);assert.match(x.$('aRecommendations').textContent,/No complete calendar period/);
  x.$('aBucketSample').click();assert.equal(x.$('aMode').value,'buckets');assert.equal(x.$('aBucket').value,'3600000');x.$('advisorConfig').dispatchEvent(new x.w.Event('submit',{cancelable:true}));assert.match(x.$('aRecommendations').textContent,/Source buckets are coarser/);assert.deepEqual(x.errors,[]);
 }finally{x.w.close();}
});
test('CSV advisor exclusions and per-API scope affect recommendations and report metadata',async()=>{
 const x=open();try{
  x.$('advisorTab').click();x.$('aEventSample').click();x.$('aAddExclude').click();const rule=x.$('aExclusions').firstElementChild;rule.querySelector('[data-a-field]').value='path';rule.querySelector('[data-a-op]').value='prefix';rule.querySelector('[data-a-value]').value='/health';
  x.input('aScope','api');x.$('advisorConfig').dispatchEvent(new x.w.Event('submit',{cancelable:true}));assert.equal(x.$('aExcludedCount').textContent,'180');assert.equal(x.$('aKeptCount').textContent,'540');assert.equal(x.$('aGroup').options.length,2);assert.equal(x.$('aAnalyzedCount').textContent,'360');
  x.$('aExportJSON').click();const report=JSON.parse(await x.blobText(x.blobs.at(-1)));assert.equal(report.scope,'api');assert.equal(report.filters[0].value,'/health');assert.equal(report.traffic.excludedRequests,180);assert(!Object.hasOwn(report,'rows'));
  x.input('aHeadroom',30);assert.equal(x.$('aStale').hidden,false);assert.deepEqual(x.errors,[]);
 }finally{x.w.close();}
});
test('invalid CSV rows require explicit skipping and unmapped exclusion fields are blocked',()=>{
 const x=open();try{
  x.$('advisorTab').click();x.$('aPaste').value='timestamp,apiproxy\n2026-09-01T00:00:00Z,a\nBAD,a';x.$('aLoadPaste').click();assert.match(x.$('aValidation').textContent,/1 invalid/);x.$('advisorConfig').dispatchEvent(new x.w.Event('submit',{cancelable:true}));assert.match(x.$('aError').textContent,/explicitly allow/);
  x.$('aSkipInvalid').checked=true;x.$('advisorConfig').dispatchEvent(new x.w.Event('submit',{cancelable:true}));assert.equal(x.$('aResults').hidden,false);
  x.$('aAddExclude').click();const r=x.$('aExclusions').firstElementChild;r.querySelector('[data-a-field]').value='developer';r.querySelector('[data-a-value]').value='internal';x.$('advisorConfig').dispatchEvent(new x.w.Event('submit',{cancelable:true}));assert.match(x.$('aError').textContent,/Map the developer/);assert.deepEqual(x.errors,[]);
 }finally{x.w.close();}
});
test('imported CSV content cannot inject HTML or spreadsheet formulas and is omitted from offline HTML',async()=>{
 const x=open();let offline;try{
  x.$('advisorTab').click();x.$('aPaste').value='timestamp,apiproxy\n2026-09-01T00:00:00Z,=PRIVATE_SENTINEL\n2026-09-01T00:00:01Z,<img src=x onerror=alert(1)>';x.$('aLoadPaste').click();x.input('aScope','api');x.$('advisorConfig').dispatchEvent(new x.w.Event('submit',{cancelable:true}));assert.equal(x.$('aPreviewRows').querySelector('img'),null);assert.equal(x.$('aGroup').querySelector('img'),null);
  assert.equal(x.w.aCsvCell('=SUM(1)'), '"\'=SUM(1)"');
  x.$('aExportCSV').click();const csv=await x.blobText(x.blobs.at(-1));assert(!csv.includes(',"=PRIVATE_SENTINEL"'));
  x.$('downloadHtml').click();const text=await x.blobText(x.blobs.at(-1));assert(!text.includes('PRIVATE_SENTINEL'));assert(!text.includes('<img src=x onerror=alert(1)>'));offline=open(text);assert.equal(offline.$('advisorLab').hidden,false);assert.equal(offline.$('advisorConfig').hidden,true);assert.equal(offline.$('aPaste').value,'');assert.deepEqual(offline.errors,[]);
  x.$('aClear').click();assert(!x.$('aPreviewRows').textContent.includes('PRIVATE_SENTINEL'));assert.equal(x.$('advisorConfig').hidden,true);assert.deepEqual(x.errors,[]);
 }finally{x.w.close();offline?.w.close();}
});
test('Edge Private Cloud limit plan transfers weekly rules and editable Spike Arrest without losing traffic; undo restores destination',()=>{
 const x=open();try{
 assert.match(x.$('model').selectedOptions[0].textContent,/Edge Private Cloud/);
 assert.equal(x.$('planRules').children.length,4);assert.match(x.$('pPreview').textContent,/Combined preview/);
 x.input('qBase',100);x.input('qBaseUnit','total');x.input('qSeedMode','fixed');x.input('qSeed',123);
 x.input('rate',7);x.input('mps',3);
 x.$('pTransfer').click();assert.equal(x.$('quotaLab').hidden,false);assert.equal(x.$('qSpikeEnabled').checked,true);assert.equal(x.$('qSpikeRate').value,'7');assert.equal(x.$('qSpikeMps').value,'3');
 assert.equal(x.$('qBase').value,'100');assert.equal(x.$('qSeed').value,'123');assert.equal(x.$('quotaPeaks').children.length,2);
 assert.equal(x.$('quotaRules').children[2].querySelector('[data-field="unit"]').value,'week');
 x.input('qSpikeRate',9);assert.equal(x.$('rate').value,'7');assert.equal(x.$('qStale').hidden,false);
 x.$('pUndo').click();assert.equal(x.$('qSpikeEnabled').checked,false);assert.equal(x.$('quotaRules').children.length,5);
 assert.deepEqual(x.errors,[]);
 }finally{x.w.close();}
});
test('source plan and chained destination survive offline HTML and scenario exports',async()=>{
 const x=open();let y;try{
 const row=x.$('planRules').children[2];row.querySelector('[data-field="limit"]').value='4321';row.dispatchEvent(new x.w.Event('input',{bubbles:true}));
 x.$('pTransfer').click();x.$('saveConfig').click();const saved=JSON.parse(await x.blobText(x.blobs.at(-1)));assert.equal(saved.limitPlan.rules[2].limit,4321);
 x.$('downloadHtml').click();y=open(await x.blobText(x.blobs.at(-1)));
 assert.equal(y.$('planRules').children[2].querySelector('[data-field="limit"]').value,'4321');assert.equal(y.$('qSpikeEnabled').checked,true);assert.match(y.$('qSpikeSummary').textContent,/Edge Private Cloud/);assert.equal(y.$('downloadHtml'),null);assert.deepEqual(y.errors,[]);
 }finally{x.w.close();y?.w.close();}
});
test('invalid source rules cannot transfer or export a stale plan',()=>{
 const x=open();try{const f=x.$('planRules').querySelector('[data-field="limit"]');f.value='0';f.dispatchEvent(new x.w.Event('input',{bubbles:true}));assert.equal(x.$('pTransfer').disabled,true);x.$('saveConfig').click();assert.equal(x.downloads.length,0);assert.match(x.$('notice').textContent,/Limit 1/);assert.deepEqual(x.errors,[]);}finally{x.w.close();}
});
test('combined log identifies stages, filters without changing the seed, and exports all pages',async()=>{
 const x=open();try{
 x.input('seedMode','fixed');x.input('rate',1000);x.input('mps',1);x.input('interval',10);x.input('count',240);
 for(const row of x.$('planRules').children)row.querySelector('[data-field="enabled"]').checked=false;
 const row=x.$('planRules').children[1];row.querySelector('[data-field="enabled"]').checked=true;row.querySelector('[data-field="limit"]').value='2';row.dispatchEvent(new x.w.Event('input',{bubbles:true}));
 assert.equal(x.$('pRows').children.length,100);assert.match(x.$('pRows').children[2].textContent,/Rule 2: 2 \/ hour/);
 const seed=x.$('seed').value;x.input('pFilter','quota');x.$('pFilter').dispatchEvent(new x.w.Event('change'));assert.match(x.$('pPageInfo').textContent,/238 results/);assert.equal(x.$('seed').value,seed);
 x.$('pNext').click();assert.match(x.$('pPageInfo').textContent,/Page 2 \/ 3/);x.$('pCSV').click();const csv=await x.blobText(x.blobs.at(-1));assert.equal(csv.trim().split('\r\n').length,239);assert.match(csv,/Rule 2: 2 \/ hour/);assert.equal(x.downloads.at(-1).name,'combined-limit-results.csv');
 x.input('pFilter','spike');x.$('pFilter').dispatchEvent(new x.w.Event('change'));assert.match(x.$('pRows').textContent,/No matching/);
 x.input('rate',1);assert.match(x.$('pRows').textContent,/Spike Arrest rejected; quotas not evaluated/);
 x.input('rate',0);assert.equal(x.$('pResults').hidden,true);const n=x.downloads.length;x.$('pCSV').click();assert.equal(x.downloads.length,n);assert.equal(x.$('pRows').children.length,0);assert.deepEqual(x.errors,[]);
 }finally{x.w.close();}
});
