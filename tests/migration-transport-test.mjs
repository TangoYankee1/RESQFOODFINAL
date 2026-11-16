import test from 'node:test';
import assert from 'node:assert/strict';
import { createGateway } from '../backend/gateway.mjs';
import { createBackendTransport } from '../public/js/core/backend-transport.mjs';
const origin = 'https://resqfood-ec8f5.web.app';
const gateway = createGateway({
  allowedOrigins: [origin], maxBytes: 1024,
  verifyToken: async token => {
    if (token !== 'test-valid') throw Object.assign(new Error('Invalid session'), { code: 'unauthenticated' });
    return { uid: 'alice', token: { role: 'donor' } };
  },
  handlers: {
    directory: { public: true, run: async () => ({ organizations: [] }) },
    identity: { run: async (data, ctx) => ({ uid: ctx.auth.uid, data }) },
    broken: { public: true, run: async () => { throw new Error('PRIVATE SECRET'); } },
  },
});
function request(name, { body = '{"data":{}}', token, method = 'POST', site = origin } = {}) {
  return new Request('https://api.example/api/' + name, { method,
    headers: { Origin: site, 'Content-Type': 'application/json', ...(token ? {Authorization: token} : {}) },
    ...(method === 'POST' ? {body} : {}),
  });
}
test('public directory and CORS response', async () => {
  const res = await gateway(request('directory'));
  assert.equal(res.status, 200); assert.equal(res.headers.get('Access-Control-Allow-Origin'), origin);
  assert.deepEqual(await res.json(), {data: {organizations: []}});
});
test('private operation requires a verified session', async () => {
  assert.equal((await gateway(request('identity'))).status, 401);
  assert.equal((await gateway(request('identity', {token:'Bearer forged'}))).status, 401);
  const body = await (await gateway(request('identity', {token:'Bearer test-valid',body:'{"data":{"uid":"attacker"}}'}))).json();
  assert.equal(body.data.uid, 'alice');
});
test('untrusted origin and inherited/raw handler routes rejected', async () => {
  assert.equal((await gateway(request('directory', {site:'https://evil.example'}))).status,403);
  for (const name of ['constructor','toString','signupWithProfileHandler']) assert.equal((await gateway(request(name))).status,404);
});
test('preflight and unsupported methods', async () => {
  assert.equal((await gateway(request('identity',{method:'OPTIONS'}))).status,204);
  assert.equal((await gateway(request('identity',{method:'GET'}))).status,405);
});
test('malformed, spoofed-context, and oversized request envelopes rejected', async () => {
  for (const body of ['{','null','[]','{"auth":{"uid":"admin"},"data":{}}']) assert.equal((await gateway(request('directory',{body}))).status,400);
  assert.equal((await gateway(request('directory',{body:JSON.stringify({data:'a'.repeat(1100)})}))).status,429);
});
test('unexpected backend errors do not expose secrets', async () => {
  const res = await gateway(request('broken')); assert.equal(res.status,500);
  assert.doesNotMatch(await res.text(),/PRIVATE SECRET/);
});
test('transport calls gateway with Firebase token and unwraps response', async () => {
  const call = createBackendTransport({ backendUrl:'https://api.example',auth:{currentUser:{getIdToken:async ()=>'test-valid'}},
    fetchImpl: async (url, init) => { assert.equal(init.redirect,'error'); assert.equal(init.credentials,'omit'); return gateway(new Request(url,init)); },
  });
  assert.deepEqual(await call('identity',{n:1}),{uid:'alice',data:{n:1}});
});
test('transport preserves domain error codes and local adapter', async () => {
  const call = createBackendTransport({backendUrl:'https://api.example',auth:{currentUser:null},fetchImpl:async (url,init)=>gateway(new Request(url,init))});
  await assert.rejects(call('identity'),{code:'functions/unauthenticated'});
  const local = createBackendTransport({localCall:async (name,data)=>({name,data})});
  assert.deepEqual(await local('identity',{n:2}),{name:'identity',data:{n:2}});
});
test('transport rejects unsafe URLs and malformed responses', async () => {
  for (const backendUrl of ['http://api.example','https://user:pass@api.example','https://api.example?key=secret']) assert.throws(()=>createBackendTransport({backendUrl}));
  const call=createBackendTransport({backendUrl:'https://api.example',auth:{currentUser:null},fetchImpl:async()=>new Response('oops')});
  await assert.rejects(call('directory'),{code:'functions/unavailable'});
  await assert.rejects(call('../identity'));
});
test('mutations are not automatically retried on network errors', async () => {
  let attempts=0;
  const call=createBackendTransport({backendUrl:'https://api.example',auth:{currentUser:null},fetchImpl:async()=>{attempts++;throw new TypeError('offline');}});
  await assert.rejects(call('identity'),{code:'functions/unavailable'}); assert.equal(attempts,1);
});
