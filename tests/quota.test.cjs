const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8'),script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
const ctx=vm.createContext({Intl});vm.runInContext(script.split('// UI only below this marker')[0]+'\nthis.api={QDEFAULTS,qValidate,qPlan,qTraffic,qSimulate,qBounds,qCSV,qTime};',ctx);const a=ctx.api;
const config=(o={})=>a.qValidate({...a.QDEFAULTS,...o});
const rule=(limit,unit,mode='calendar')=>({enabled:true,limit,unit,mode});
const events=(q,offsets)=>offsets.map((t,i)=>({id:i+1,t:q.startMs+t,source:0}));
test('multiple second/minute/hour/day/month rules apply together and identify bottlenecks',()=>{
 const q=config({rules:[rule(1,'second'),rule(2,'minute'),rule(3,'hour'),rule(4,'day'),rule(5,'month')]});
 const result=a.qSimulate(q,events(q,[0,1,1000,2000,60000,61000,3600000,3601000,86400000,86401000]));
 assert.deepEqual(Array.from(result.rows,r=>r.status),[200,429,200,429,200,429,200,429,200,429]);
 assert.deepEqual(Array.from(result.rows.filter(r=>r.status===429),r=>Array.from(r.violations)),[[0],[1],[2],[3],[4]]);
 assert.equal(result.rows[9].next,Date.parse('2026-09-30T21:00:00Z'));
});
test('atomic accepted-only accounting is independent of rule order',()=>{
 const q=config({rules:[rule(1,'second'),rule(2,'minute')]});const input=events(q,[0,1,2,1000,2000]);
 const result=a.qSimulate(q,input);assert.deepEqual(Array.from(result.rows,r=>r.status),[200,429,429,200,429]);
 assert.deepEqual(Array.from(a.qSimulate(config({...q,rules:[...q.rules].reverse()}),input).rows,r=>r.status),Array.from(result.rows,r=>r.status));
});
test('all-attempt counting and sliding wait include the rejected attempt',()=>{
 const q=config({rules:[rule(1,'second','sliding')],counting:'attempts'});const result=a.qSimulate(q,events(q,[0,100,1000,1100]));
 assert.deepEqual(Array.from(result.rows,r=>r.status),[200,429,429,429]);assert.equal(result.rows[1].next,q.startMs+1100);assert.equal(result.stats[0].maximum,2);
});
test('multiple violations counted separately; next time must satisfy every violated rule',()=>{
 const q=config({rules:[rule(1,'minute'),rule(1,'day')]});const result=a.qSimulate(q,events(q,[0,1]));assert.deepEqual(Array.from(result.rows[1].violations),[0,1]);assert.equal(result.rows[1].next,q.startMs+86400000);assert.equal(result.stats.reduce((s,r)=>s+r.blocked,0),2);
});
test('sliding window expires requests exactly at boundary',()=>{
 const q=config({rules:[rule(2,'minute','sliding')]});assert.deepEqual(Array.from(a.qSimulate(q,events(q,[0,0,59999,60000,60000])).rows,r=>r.status),[200,200,429,200,200]);
});
test('calendar months honor leap years, variable lengths and timezone',()=>{
 const feb=a.qBounds(Date.parse('2028-02-15T00:00:00Z'),'month',3);assert.equal(feb.end-feb.start,29*86400000);assert.equal(feb.end,Date.parse('2028-02-29T21:00:00Z'));
 const jan=a.qBounds(Date.parse('2026-01-15T00:00:00Z'),'month',0);assert.equal(jan.end-jan.start,31*86400000);
 const q=config({start:'2026-01-31T23:59',end:'2026-02-01T00:01',rules:[rule(1,'month')]});assert.deepEqual(Array.from(a.qSimulate(q,events(q,[0,59000,60000])).rows,r=>r.status),[200,429,200]);
});
test('default plan generates exactly base plus overlapping/additive peaks',()=>{
 const q=config(),p=a.qPlan(q);assert.equal(p.base,14000);assert.equal(p.peak,14000);assert.equal(p.total,28000);assert.equal(p.occurrences.length,14);
 const overlapping=config({start:'2026-09-01T00:00',end:'2026-09-02T00:00',base:0,peaks:[{start:'12:00',end:'13:00',amount:100,repeat:'all'},{start:'12:00',end:'13:00',amount:200,repeat:'all'}]});assert.equal(a.qPlan(overlapping).total,300);
});
test('overnight, partial, weekday/weekend, and one-off peaks',()=>{
 const q=config({start:'2026-09-02T00:00',end:'2026-09-02T01:00',base:0,peaks:[{start:'23:00',end:'01:00',amount:200,repeat:'once',date:'2026-09-01'}]});assert.equal(a.qPlan(q).total,100);
 const w=config({start:'2026-09-04T00:00',end:'2026-09-07T00:00',base:0,peaks:[{start:'12:00',end:'13:00',amount:100,repeat:'weekdays'},{start:'12:00',end:'13:00',amount:200,repeat:'weekends'}]});assert.equal(a.qPlan(w).total,500);
 const once=config({base:0,peaks:[{start:'12:00',end:'13:00',amount:100,repeat:'once',date:'2026-09-03'}]});assert.equal(a.qPlan(once).total,100);
});
test('traffic is reproducible, sorted, inside the interval and includes exact requested count',()=>{
 const q=config({base:100,baseUnit:'total',peaks:[]}),rows=a.qTraffic(q);assert.equal(rows.length,100);assert.deepEqual(rows,a.qTraffic(q));assert.notDeepEqual(rows,a.qTraffic(config({...q,seed:43})));
 rows.forEach((r,i)=>{assert(r.t>=q.startMs&&r.t<q.endMs);assert(i===0||r.t>=rows[i-1].t);});
 const even=a.qTraffic(config({...q,distribution:'even'}));assert.equal(even[1].t-even[0].t,(q.endMs-q.startMs)/100);
});
test('empty traffic, disabled rules and full CSV export',()=>{
 const q=config({base:0,peaks:[],rules:[]});assert.equal(a.qSimulate(q).rows.length,0);
 const noLimits=config({base:10,baseUnit:'total',peaks:[],rules:[{...rule(1,'month'),enabled:false}]});const result=a.qSimulate(noLimits);assert(result.rows.every(r=>r.status===200));assert.equal(a.qCSV(result.rows,noLimits).split('\r\n').length,11);
});
test('invalid dates, month sliding, malformed rules and oversized simulations are rejected',()=>{
 for(const c of [{start:'2026-02-30T00:00'},{end:'2026-09-01T00:00'},{end:'2028-01-01T00:00'},{rules:[rule(1,'month','sliding')]},{base:''},{base:1.5},{timezone:99},{rules:Array(13).fill(rule(1,'hour'))},{peaks:[{start:'12:00',end:'12:00',amount:1,repeat:'all'}]}])assert.throws(()=>config(c));
 assert.throws(()=>a.qPlan(config({base:100000,baseUnit:'minute'})),/100,000/);
});
test('100,000 requests evaluated without sampling',()=>{
 const q=config({base:100000,baseUnit:'total',peaks:[],rules:[rule(100000,'month')]});const result=a.qSimulate(q);assert.equal(result.rows.length,100000);assert(result.rows.every(r=>r.status===200));
});
test('policy generation maps active rules with explicit counter and reset semantics',()=>{
 const scope=vm.createContext({Intl});vm.runInContext(script.split('// UI only below this marker')[0]+'\nthis.generate=qPolicyGenerate;',scope);
 const out=scope.generate({...a.QDEFAULTS,rules:[rule(3,'second','sliding'),{...rule(10,'minute'),enabled:false},rule(3600,'hour','sliding'),rule(10000,'month')]},'verified.client.id');
 assert.equal(out.policies.length,3);assert.equal(out.policies[1].filename,'Quota-03-hour.xml');assert.match(out.policies[0].xml,/<Distributed>false<\/Distributed>/);assert(!out.policies[0].xml.includes('<Synchronous>'));
 assert.match(out.policies[1].xml,/type="rollingwindow"/);assert.match(out.policies[1].xml,/<Synchronous>true<\/Synchronous>/);assert.match(out.policies[1].xml,/<Identifier ref="verified.client.id"\/>/);
 assert(!out.policies[2].xml.includes('type="calendar"'));assert(!out.policies[2].xml.includes('<StartTime>'));assert(out.notes.some(n=>n.includes('UTC+3')));assert(out.notes.some(n=>n.includes('atomic')));assert.equal((out.requestSteps.match(/<Step>/g)||[]).length,3);
 assert.throws(()=>scope.generate({...a.QDEFAULTS,rules:[]}),/Enable at least one/);assert.throws(()=>scope.generate(a.QDEFAULTS,'x"/><Invalid/>'),/Identifier/);
});
