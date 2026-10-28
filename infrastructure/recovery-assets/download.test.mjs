import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { download, hash, C } from './helper.mjs';

const bytes = Buffer.from('pinned baseline bytes');
const entry = {path:'fixture.bin', bytes:bytes.length, sha256:hash(bytes)};
async function scenario(handler, run) {
  let requests = 0;
  const server = http.createServer((req,res) => handler(req,res,++requests));
  server.listen(0,'127.0.0.1'); await once(server,'listening');
  const origin = `http://127.0.0.1:${server.address().port}`;
  const records=[];
  const options={timeoutMs:60,retryDelayMs:0,logger:x=>records.push(x),
    fetcher:(url,opts)=>fetch(origin+new URL(url).pathname,opts)};
  try { await run(options,records,()=>requests); }
  finally {server.closeAllConnections();await new Promise(r=>server.close(r));}
}
test('real response verifies all bytes and emits completion',async()=>scenario(
  (_,res)=>res.end(bytes),async(o,r,n)=>{
    assert.deepEqual(await download(entry,o),bytes);assert.equal(n(),1);
    assert.equal(r.at(-1).event,'baseline-complete');
  }));
test('stalled headers exhaust exactly two bounded attempts',async()=>scenario(
  ()=>{},async(o,r,n)=>{const start=Date.now();
    await assert.rejects(download(entry,o),/attempt=2 phase=headers code=TimeoutError/);
    assert.equal(n(),2);assert.ok(Date.now()-start<1000);
    assert.deepEqual(r.filter(x=>x.event==='baseline-error').map(x=>x.retry),[true,false]);
  }));
test('slow trickle body has a total deadline despite ongoing data',async()=>scenario(
  (_,res)=>{res.writeHead(200);res.write(bytes.subarray(0,1));
    const timer=setInterval(()=>res.write(bytes.subarray(0,1)),20);
    res.on('close',()=>clearInterval(timer));},async(o,r,n)=>{
    await assert.rejects(download(entry,o),/attempt=2 phase=body code=TimeoutError/);
    assert.equal(n(),2);assert.ok(r.some(x=>x.phase==='body'&&x.bytes>0));
  }));
test('one transient header timeout retries then verifies success',async()=>scenario(
  (_,res,n)=>{if(n===2)res.end(bytes);},async(o,r,n)=>{
    assert.deepEqual(await download(entry,o),bytes);assert.equal(n(),2);
    assert.equal(r.at(-1).attempt,2);
  }));
test('midbody socket termination retries once',async()=>scenario(
  (_,res,n)=>{if(n===1){res.writeHead(200);res.write(bytes.subarray(0,1));
    setTimeout(()=>res.destroy(),10);}else res.end(bytes);},async(o,r,n)=>{
    assert.deepEqual(await download(entry,o),bytes);assert.equal(n(),2);
    assert.ok(r.some(x=>x.phase==='body'&&x.retry));
  }));
for (const [name,handler] of [
  ['wrong hash',(_,res)=>res.end(Buffer.alloc(bytes.length,120))],
  ['oversized body',(_,res)=>res.end(Buffer.alloc(bytes.length+1))],
  ['short body',(_,res)=>res.end(bytes.subarray(1))],
  ['wrong length header',(_,res)=>{res.setHeader('Content-Length',bytes.length+10);res.end(bytes);}],
  ['forbidden status',(_,res)=>{res.writeHead(403);res.end('denied');}],
  ['cross-origin redirect',(_,res)=>{res.writeHead(301,{location:'https://example.org/'});res.end();}],
]) test(`${name} fails without retry`,async()=>scenario(handler,async(o,r,n)=>{
  await assert.rejects(download(entry,o),/Baseline download failed/);assert.equal(n(),1);
  assert.equal(r.at(-1).retry,false);
}));
test('same-origin redirects share attempt deadline and are bounded',async()=>scenario(
  (_,res)=>{res.writeHead(301,{location:C.origin+'/again'});res.end();},async(o,r,n)=>{
    await assert.rejects(download(entry,o));assert.equal(n(),4);assert.equal(r.at(-1).retry,false);
  }));
test('aggregate deadline prevents another attempt',async()=>scenario(
  ()=>{},async(o,r,n)=>{await assert.rejects(download(entry,{...o,deadlineAt:Date.now()+30}));
    assert.equal(n(),1);assert.equal(r.at(-1).retry,false);
  }));
test('invalid controls and path fail before transport',async()=>{
  await assert.rejects(download({...entry,path:'../bad'}),/Unsafe path/);
  await assert.rejects(download(entry,{timeoutMs:25001}),/Invalid download bounds/);
  await assert.rejects(download(entry,{retryDelayMs:1001}),/Invalid download bounds/);
});
