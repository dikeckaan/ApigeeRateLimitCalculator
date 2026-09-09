const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{spawnSync}=require('node:child_process');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8'),source=html.match(/<script>([\s\S]*?)<\/script>/)[1],ctx=vm.createContext({Intl});
vm.runInContext(source.split('// UI only below this marker')[0]+'\nthis.api={policyZIP,qPolicyGenerate,QDEFAULTS};',ctx);
test('ZIP opens with an independent reader, validates CRCs and preserves every policy and Unicode note',()=>{
 const b=ctx.api.qPolicyGenerate(ctx.api.QDEFAULTS);b.notes.push('UTF-8: Türkçe → 日本語');
 const out=spawnSync('python3',['-c',`import sys,io,zipfile,json
z=zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read()))
assert z.testzip() is None
print(json.dumps({n:z.read(n).decode('utf-8') for n in z.namelist()}))`],{input:Buffer.from(ctx.api.policyZIP(b))});assert.equal(out.status,0,out.stderr.toString());const files=JSON.parse(out.stdout);assert.equal(Object.keys(files).length,b.policies.length+3);for(const p of b.policies)assert.equal(files['policies/'+p.filename],p.xml);assert.match(files['README.txt'],/Türkçe → 日本語/);assert(files['request-steps.xml'].includes('\n<Step>'));assert.equal(JSON.parse(files['manifest.json']).policies.length,5);
});
