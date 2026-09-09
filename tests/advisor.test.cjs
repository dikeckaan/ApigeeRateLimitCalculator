const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8'),script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
const ctx=vm.createContext({Intl});vm.runInContext(script.split('// UI only below this marker')[0]+'\nthis.api={aParseCSV,aAutoMap,aTimestamp,aNormalize,aGlob,aExclude,aGroups,aAnalyze,aReplay};',ctx);const a=ctx.api;
const t=Date.UTC(2026,8,1),map={time:0,count:4,api:1,developer:2,path:3,app:-1,status:-1,environment:-1};
const options={map,mode:'events',bucketMs:60000,format:'auto',timezone:0,stripQuery:true};
const settings={start:t,end:t+60000,timezone:0,mode:'events',bucketMs:60000,percentile:100,headroom:20};
const row=(offset,count=1,extra={})=>({t:t+offset,count,line:1,api:'orders',developer:'dev',path:'/orders',app:'',status:'200',environment:'prod',...extra});
test('CSV parser handles BOM, CRLF, quotes, quoted delimiters, escaped quotes and multiline fields',()=>{
 const p=a.aParseCSV('\ufefftimestamp;api;developer\r\n2026-09-01T00:00:00Z;"a;b";"first\n""last"""\r\n');assert.equal(p.delimiter,';');assert.equal(p.rows.length,1);assert.equal(p.rows[0].cells[1],'a;b');assert.equal(p.rows[0].cells[2],'first\n"last"');
 assert.equal(a.aParseCSV('timestamp\tapi\n0\tx').delimiter,'\t');
 for(const s of ['x,x\n1,2','x,\n1,2','x\n"bad','x\n"ok"bad','x'])assert.throws(()=>a.aParseCSV(s));
});
test('column aliases recognize common Edge request and analytics names',()=>{
 const m=a.aAutoMap(['client_received_start_timestamp','apiproxy','developer_email','request_uri','sum(message_count)','developer_app','response_status_code']);assert.equal(m.time,0);assert.equal(m.count,4);assert.equal(m.developer,2);assert.equal(m.app,5);assert.equal(m.environment,-1);
});
test('timestamps accept ISO, explicit offsets, UTC suffix and Unix seconds/milliseconds; reject ambiguity',()=>{
 assert.equal(a.aTimestamp('2026-09-01 03:00:00','iso',3),t);assert.equal(a.aTimestamp('2026-09-01T03:00:00+03:00'),t);assert.equal(a.aTimestamp('2026-09-01 00:00:00 UTC'),t);assert.equal(a.aTimestamp(String(t)),t);assert.equal(a.aTimestamp(String(t/1000)),t);
 for(const s of ['09/01/2026','2026-02-30','2026-09-01T25:00:00Z','2026-01-01T00:00:00+99:00','abc'])assert.throws(()=>a.aTimestamp(s));
});
test('normalization reports invalid rows and preserves aggregated counts without expansion',()=>{
 const p=a.aParseCSV('timestamp,api,developer,path,count\n2026-09-01T00:00:00Z,a,d,https://host.test/orders?x=1,500\nBAD,a,d,/x,1\n2026-09-01T00:00:00Z,a,d,/x,2,extra');
 const n=a.aNormalize(p,{...options,mode:'buckets'});assert.equal(n.rows.length,1);assert.equal(n.rows[0].count,500);assert.equal(n.rows[0].path,'/orders');assert.equal(n.invalid.length,2);
 const off=a.aNormalize(a.aParseCSV('timestamp,api,developer,path,count\n2026-09-01T00:00:01Z,a,d,/x,5'),{...options,mode:'buckets'});assert.equal(off.invalid.length,1);
});
test('exclusions use OR semantics, deduplicate total impact, report overlap and validate mapped fields',()=>{
 const rows=[row(0,2,{api:'health',developer:'internal',path:'/health'}),row(1,3,{api:'orders',developer:'internal'}),row(2,5)];
 const r=a.aExclude(rows,[{field:'developer',op:'exact',value:'internal'},{field:'path',op:'glob',value:'/health*'}],map,false);assert.equal(r.rows.length,1);assert.equal(r.excludedRequests,5);assert.equal(r.stats[0].requests,5);assert.equal(r.stats[1].requests,2);
 assert.equal(a.aExclude(rows,[{field:'api',op:'exact',value:'HEALTH'}],map,true).excludedRequests,2);
 assert.throws(()=>a.aExclude(rows,[{field:'app',op:'exact',value:'x'}],map,false));assert.throws(()=>a.aExclude(rows,[{field:'api',op:'prefix',value:''}],map,false));
});
test('wildcards are literal except for *, avoiding arbitrary regex execution',()=>{
 assert(a.aGlob('/v1/orders/42','/v1/*/42'));assert(!a.aGlob('/v1/orders/42','/v1/.*'));assert(a.aGlob('a.b','a.b'));assert(a.aGlob('anything','*'));assert(!a.aGlob('x',''));assert(a.aGlob('a'.repeat(1000)+'b','*a*a*a*b'));
});
test('recommendations use complete buckets, include zeros and compute candidate replay',()=>{
 const r=a.aAnalyze([row(0,10),row(1000,5)],{...settings,end:t+2000});const second=r.results.find(r=>r.unit==='second');assert.equal(second.buckets,2);assert.equal(second.peak,10);assert.equal(second.recommended,12);assert.equal(second.rejected,0);assert.equal(r.results.find(r=>r.unit==='minute').supported,false);
 const q=a.aAnalyze([row(0,10)],{...settings,percentile:95,headroom:0});assert.equal(q.results[0].p95,0);assert.equal(q.results[0].recommended,1);assert.equal(q.results[0].rejected,9);
});
test('partial periods cannot size a larger limit; coarse buckets cannot size finer limits',()=>{
 const result=a.aAnalyze([row(0,1000),row(3600000,2000)],{...settings,mode:'buckets',bucketMs:3600000,end:t+7200000});assert.equal(result.results[0].supported,false);assert.equal(result.results[1].supported,false);assert.equal(result.results[2].recommended,2400);assert.equal(result.results[3].supported,false);assert.equal(result.results[4].supported,false);
 const partial=a.aAnalyze([row(1000,1000)],{...settings,start:t+1000,end:t+59000});assert.equal(partial.results[1].supported,false);
});
test('calendar month recommendations require a full real month',()=>{
 const start=Date.UTC(2028,1,1),end=Date.UTC(2028,2,1);const r=a.aAnalyze([{...row(0,100),t:start}],{...settings,start,end});const month=r.results.find(r=>r.unit==='month');assert.equal(month.buckets,1);assert.equal(month.recommended,120);
 assert.equal(a.aAnalyze([{...row(0,100),t:start}],{...settings,start:start+1000,end}).results.find(r=>r.unit==='month').supported,false);
});
test('partial source buckets are excluded from range and not prorated',()=>{
 const r=a.aAnalyze([row(0,100),row(60000,200)],{...settings,mode:'buckets',bucketMs:60000,end:t+90000});assert.equal(r.total,100);assert.equal(r.outsideRequests,200);
});
test('group keys do not collide and grouping requires mapped fields',()=>{
 const groups=a.aGroups([row(0,2,{api:'a / b',developer:'c'}),row(1,3,{api:'a',developer:'b / c'})],'apiDeveloper',map);assert.equal(groups.length,2);assert.equal(groups[0].total,3);assert.throws(()=>a.aGroups([row(0)],'app',map));
});
test('combined replay is atomic and does not add standalone rejections',()=>{
 const r=a.aReplay([row(0,10),row(60000,10)],[{unit:'minute',recommended:5},{unit:'hour',recommended:6}],0);assert.equal(r.accepted,6);assert.equal(r.rejected,14);
});
test('large empty reporting ranges avoid materializing millions of zero buckets',()=>{
 const r=a.aAnalyze([row(0)],{...settings,end:t+366*86400000});assert.equal(r.results[0].buckets,366*86400);assert.equal(r.results[0].p99,0);assert.throws(()=>a.aAnalyze([],{...settings,end:t+367*86400000}));
});
