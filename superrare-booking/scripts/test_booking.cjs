// Offline behavioral checks. All network, storage, clocks, and dialogs are mocked.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const template = fs.readFileSync(path.join(__dirname, '../assets/booking.template.js'), 'utf8');
const baseTime = Date.parse('2030-10-09T02:00:00Z');
const config = {eventName:'BIGBANG', eventDate:'2030-10-11', opensAt:'2030-10-09T10:00:00+08:00', closesAt:'2030-10-11T21:00:00+08:00', allowedStartTimes:[]};
const booking = {slotDate:config.eventDate, status:'CONFIRMED'};
const slots = [{id:2, startTime:'12:00', endTime:'13:00', quota:10, booked:0}, {id:1, startTime:'10:00', endTime:'11:00', quota:10, booked:0}];
const ok = data => ({ok:true, status:200, json:async()=>({code:0, data})});
const rejection = (message, httpOK=true) => ({ok:httpOK, status:httpOK?200:500, json:async()=>({code:1, message})});
async function run(options={}) {
  let now=baseTime, saved=false, joins=0;
  const calls=[], logs=[], storage=options.storage || new Map();
  const settings={...config, ...options.config};
  class Clock extends Date { constructor(...args) { super(...(args.length?args:[now])); } static now(){return now;} }
  const context={
    Date:Clock, location:{origin:'https://superrareshop.com', pathname:'/appointment', ...options.location}, window:{},
    confirm:()=>options.confirm !== false, alert:()=>{}, AbortSignal:{timeout:()=>undefined},
    console:{log:(...x)=>logs.push(x.join(' ')), error:(...x)=>logs.push(x.join(' '))},
    localStorage:{getItem:key=>({bb_auth_USER:'{"token":"MOCK"}',bb_device_id:'MOCK'}[key] || null)},
    sessionStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
    setTimeout:fn=>{now+=4000; fn();},
    fetch:async(url,init)=>{
      calls.push({url,...init});
      assert.equal(init.credentials,'same-origin'); assert.equal(init.redirect,'error');
      assert.ok(url.startsWith('/api/appointments'));
      if(url.includes('/mine?')) return ok(options.existing || (saved?[booking]:[]));
      if(url.includes('/days?')) return ok(options.days || [{id:7,slotDate:settings.eventDate,activityName:'BIGBANG',venue:'Test',bookState:'OPEN'}]);
      if(url.endsWith('/join')) {
        joins++;
        if(options.notOpen) return rejection('该日预约未开放');
        return ok({state:options.queue?'QUEUING':'ADMITTED'});
      }
      if(url.endsWith('/heartbeat')) return ok({state:'ADMITTED'});
      if(url.includes('/slots?')) return ok(options.slots || slots);
      if(url === '/api/appointments') {
        const id=JSON.parse(init.body).slotId;
        if(options.timeout){if(options.savedOnTimeout) saved=true; throw new Error('timeout');}
        if(options.full && id===1) return rejection('该时段已约满', !options.httpFailure);
        if(options.badEnvelope) return {ok:true,status:200,json:async()=>({data:{}})};
        saved=!options.invisible;
        return ok({id:99});
      }
      throw new Error('Unexpected route '+url);
    }
  };
  let escaped;
  try {await vm.runInNewContext(template.replace('/*__BOOKING_CONFIG__*/',JSON.stringify(settings)), context);}
  catch(error){escaped=error;}
  return {calls, logs, storage, escaped, joins, writes:calls.filter(c=>c.url==='/api/appointments')};
}
(async()=>{
  let result=await run();
  assert.equal(result.writes.length,1); assert.equal(JSON.parse(result.writes[0].body).slotId,1); assert.equal(result.storage.size,0);
  result=await run({existing:[booking]}); assert.equal(result.calls.length,1); assert.equal(result.writes.length,0);
  result=await run({full:true}); assert.deepEqual(result.writes.map(c=>JSON.parse(c.body).slotId),[1,2]);
  result=await run({timeout:true}); assert.equal(result.writes.length,1); assert.equal(result.storage.size,1);
  let rerun=await run({storage:result.storage}); assert.equal(rerun.writes.length,0); assert.ok(rerun.logs.some(x=>x.includes('unresolved')));
  result=await run({timeout:true,savedOnTimeout:true}); assert.equal(result.writes.length,1); assert.equal(result.storage.size,0);
  result=await run({full:true,httpFailure:true}); assert.equal(result.writes.length,1); assert.equal(result.storage.size,1);
  result=await run({invisible:true}); assert.equal(result.writes.length,1); assert.equal(result.storage.size,1); assert.ok(result.logs.some(x=>x.includes('not yet visible')));
  result=await run({badEnvelope:true}); assert.equal(result.writes.length,1); assert.equal(result.storage.size,1);
  result=await run({config:{allowedStartTimes:['12:00']}}); assert.equal(JSON.parse(result.writes[0].body).slotId,2);
  result=await run({config:{allowedStartTimes:['15:00']}}); assert.equal(result.writes.length,0);
  result=await run({slots:[{...slots[0],quota:'invalid'}]}); assert.equal(result.writes.length,0);
  result=await run({queue:true}); assert.equal(result.calls.filter(c=>c.url.endsWith('/heartbeat')).length,1); assert.equal(result.writes.length,1);
  result=await run({notOpen:true}); assert.equal(result.joins,30); assert.equal(result.writes.length,0);
  result=await run({days:[{id:1,slotDate:config.eventDate,activityName:'Other',bookState:'OPEN'}]}); assert.equal(result.writes.length,0); assert.equal(result.joins,0);
  result=await run({confirm:false}); assert.equal(result.calls.length,0);
  result=await run({location:{origin:'https://example.com'}}); assert.ok(result.escaped); assert.equal(result.calls.length,0);
  result=await run({config:{closesAt:'2030-10-09T09:59:00+08:00'}}); assert.ok(result.escaped); assert.equal(result.calls.length,0);
  console.log('Passed 18 offline scenarios: selection, duplicates, queue, bounded retries, uncertain writes, rerun guard, malformed data, target checks, and cancellation.');
})().catch(error=>{console.error(error);process.exitCode=1;});
