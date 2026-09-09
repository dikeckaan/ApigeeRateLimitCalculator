const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const source=html.match(/<script>([\s\S]*?)<\/script>/)[1];
const ctx=vm.createContext({Intl});
vm.runInContext(source.split('// UI only below this marker')[0]+'\nthis.api={DEFAULTS,validateConfig,parseTimes,makeTraffic,simulate,summary,toCSV};',ctx);
const api=ctx.api;
const config=override=>api.validateConfig({...api.DEFAULTS,...override});
const run=(override={},algorithm)=>api.simulate(config(override),undefined,algorithm);
const statuses=(override={},algorithm)=>Array.from(run(override,algorithm).rows,r=>r.status);

test('single HTML has valid JS and no runtime network dependencies',()=>{new vm.Script(source);assert(!/<script[^>]+src=|<link[^>]+href=|fetch\(|XMLHttpRequest|@import/.test(html));});
test('original baseline: MP sharing and independent per-MP rates',()=>{
 assert.deepEqual(statuses({count:8}),[200,200,429,429,200,200,429,429]);
 assert.deepEqual(statuses({count:8,effective:false}),Array(8).fill(200));
 assert.equal(api.summary(run().rows).pass,20);
});
test('smoothing boundary accepts exactly at gap; rejection does not extend it',()=>{
 assert.deepEqual(statuses({mps:1,rate:5,interval:199,count:4}),[200,429,200,429]);
 assert.deepEqual(statuses({mps:1,rate:5,interval:200,count:4}),[200,200,200,200]);
 assert.deepEqual(statuses({mps:1,rate:5,traffic:'custom',timestamps:'0, 199, 200'}),[200,429,200]);
});
test('per-minute conversion and fractional MP rate',()=>{
 assert.deepEqual(statuses({mps:1,rate:30,unit:'pm',interval:500,count:5}),[200,429,429,429,200]);
 assert.equal(run({mps:3,rate:2}).gap,1500);
});
test('same MP can be throttled while other MPs have unused capacity',()=>{
 assert.equal(api.summary(run({count:8,routing:'single'}).rows).pass,2);
 assert.equal(api.summary(run({count:8,routing:'round'}).rows).pass,4);
});
test('shared sliding window supports burst and expires exact boundary',()=>{
 assert.deepEqual(statuses({model:'x',interval:0,count:12}),[...Array(10).fill(200),429,429]);
 assert.deepEqual(statuses({model:'x',rate:2,interval:250,count:5}),[200,200,429,429,200]);
 assert.deepEqual(statuses({model:'x',mps:1}),statuses({model:'x',mps:50}));
 assert.deepEqual(statuses({model:'x',rate:1,unit:'pm',traffic:'custom',timestamps:'0,59999,60000'}),[200,429,200]);
});
test('fixed window boundary differs from sliding window',()=>{
 const c={model:'x',rate:2,traffic:'custom',timestamps:'998,999,1000,1001'};
 assert.deepEqual(statuses(c,'fixed'),[200,200,200,200]);
 assert.deepEqual(statuses(c,'sliding'),[200,200,429,429]);
});
test('token bucket starts full, refills continuously, caps idle credit',()=>{
 assert.deepEqual(statuses({rate:2,capacity:2,traffic:'custom',timestamps:'0,0,0,499,500,10000,10000,10000'},'token'),[200,200,429,429,200,200,200,429]);
 assert.equal(run({rate:2,capacity:1,traffic:'custom',timestamps:'0,250'},'token').rows[1].wait,250);
});
test('burst profile respects size, interval, partial final burst and offset',()=>{
 assert.deepEqual(Array.from(api.makeTraffic(config({traffic:'burst',burstSize:3,interval:100,count:8,start:50})),r=>r.t),[50,50,50,150,150,150,250,250]);
});
test('jitter and random routing repeat from seed and use independent streams',()=>{
 const c=config({traffic:'jitter',routing:'random',count:100});
 const a=api.makeTraffic(c),b=api.makeTraffic(c);assert.deepEqual(a,b);
 assert.notDeepEqual(a,api.makeTraffic(config({...c,seed:43})));
 a.slice(1).forEach((r,i)=>{const gap=r.t-a[i].t;assert(gap>=25&&gap<=75);assert(r.mp>=1&&r.mp<=2);});
 assert.deepEqual(Array.from(a,r=>r.t),Array.from(api.makeTraffic(config({...c,routing:'single'})),r=>r.t));
});
test('custom timestamps sort, preserve duplicates, and reject malformed data',()=>{
 assert.deepEqual(Array.from(api.parseTimes('1000, 0; 0\n2.5')),[0,0,2.5,1000]);
 for(const text of ['','-1','1,NaN','Infinity','0x10','<script>','1e99'])assert.throws(()=>api.parseTimes(text));
 assert.throws(()=>api.parseTimes(Array(10001).fill('0').join(',')));
});
test('validation rejects invalid active fields and tolerates unused fields',()=>{
 for(const c of [{rate:0},{rate:1.5},{mps:0},{interval:-1},{count:10001},{capacity:''},{rate:null},{model:'invalid'},{effective:'true'}])assert.throws(()=>config(c));
 assert.doesNotThrow(()=>config({traffic:'custom',count:'',interval:'',timestamps:'0,1'}));
 assert.equal(config({model:'x',effective:false}).effective,true);
});
test('CSV contains all 10,000 results including wait and status',()=>{
 const result=run({count:10000});const csv=api.toCSV(result.rows);assert.equal(csv.split('\r\n').length,10001);assert(csv.includes('10000,'));assert(csv.startsWith('\ufeffrequest,time_ms,mp,status,wait_ms,reason'));
});
test('initial version backup is byte-for-byte preserved',()=>{
 const crypto=require('node:crypto');const digest=crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'../backups/spike-arrest-v1.html'))).digest('hex');assert.equal(digest,'226a51538c7472dbac465405247a700a923799695546288b13137841259df081');
});
test('target recommendations round down, handle low per-MP rates and use real calendar months',()=>{
 const scope=vm.createContext({Intl});vm.runInContext(source.split('// UI only below this marker')[0]+'\nthis.suggest=targetSuggestion;',scope);
 const a=scope.suggest({count:1,unit:'second',mps:2});assert.equal(a.shared.rate,1);assert.equal(a.shared.unit,'ps');assert.equal(a.perMP.rate,30);assert.equal(a.perMP.unit,'pm');
 const b=scope.suggest({count:101,unit:'minute',mps:3});assert.equal(b.perMP.nominal,99);assert.equal(b.shared.nominal,101);
 const feb=scope.suggest({count:100,unit:'month',month:'2028-02',mps:2});assert.equal(feb.period,29*86400000);assert.equal(feb.shared,null);
 assert.throws(()=>scope.suggest({count:1,unit:'month',month:'2026-13',mps:1}));
});
test('target random arrivals are exact, repeatable, sorted and inside the selected period',()=>{
 const scope=vm.createContext({Intl});vm.runInContext(source.split('// UI only below this marker')[0]+'\nthis.api={targetSuggestion,targetRandomTimes};',scope);const a=scope.api,t=a.targetSuggestion({count:10000,unit:'month',month:'2028-02',mps:3}),rows=a.targetRandomTimes(t,42);
 assert.equal(rows.length,10000);assert.deepEqual(rows,a.targetRandomTimes(t,42));assert.notDeepEqual(rows,a.targetRandomTimes(t,43));rows.forEach((v,i)=>{assert(v>=0&&v<t.period);assert(i===0||v>=rows[i-1]);});assert.throws(()=>a.targetRandomTimes({...t,count:10001},42),/10,000/);assert.throws(()=>a.targetRandomTimes(t,-1),/Sample seed/);
});
