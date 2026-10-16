import assert from 'node:assert/strict';
import worker from '../worker/ai-worker.js';
const env = {GEMINI_API_KEY:'MOCK_ONLY',APP_ACCESS_TOKEN:'secret_for_test',ALLOWED_ORIGIN:'https://example.github.io',GEMINI_MODEL:'gemini-2.5-flash'};
function req(path,method='GET',body=null,token='secret_for_test',origin='https://example.github.io'){
 const headers={'Origin':origin};if(body){headers['Content-Type']='application/json';headers['Authorization']=`Bearer ${token}`;}
 return new Request(`https://unit-test.workers.dev${path}`,{method,headers,body:body?JSON.stringify(body):undefined});
}
const health=await worker.fetch(req('/health'),env);
assert.equal(health.status,200);assert.equal((await health.json()).ok,true);
const denial=await worker.fetch(req('/analyze','POST',{ocr:'Test'},'wrong'),env);
assert.equal(denial.status,401);
const badOrigin=await worker.fetch(req('/health','GET',null,'secret','https://attacker.example'),env);
assert.equal(badOrigin.status,403);
const empty=await worker.fetch(req('/analyze','POST',{}),env);
assert.equal(empty.status,400);
const originalFetch=globalThis.fetch;
globalThis.fetch=async(url,init)=>{
 assert.match(url,/gemini-2\.5-flash:generateContent/);
 assert.equal(init.headers['x-goog-api-key'],'MOCK_ONLY');
 const r=JSON.parse(init.body);assert.match(r.contents[0].parts[0].text,/Wuthering Waves/);
 return Response.json({candidates:[{content:{parts:[{text:JSON.stringify({title:'Quest',objective:'Investigate',summary:'Hint',confidence:'thấp',steps:['Open the map','Find the door'],questions:[]})}]}}]});
};
try {
 const ai=await worker.fetch(req('/analyze','POST',{questTitle:'Quest',ocr:'Investigate',image:null}),env);
 assert.equal(ai.status,200);const payload=await ai.json();
 assert.equal(payload.steps.length,2);assert.equal(payload.title,'Quest');
} finally {globalThis.fetch=originalFetch}
console.log('PASS: Cloudflare Worker health, auth, CORS, validation, mocked Gemini response.');
