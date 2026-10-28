const {test}=require('node:test');
const assert=require('node:assert/strict');
const Transport=require('../plan-transport');
function setup(){const events=[];let attached=false,hook=null;const transport=new Transport({moveIntervalMs:0,attach:async()=>{attached=true;},detach:async()=>{attached=false;},command:async(tab,method,p)=>{events.push({...p,tab});if(hook)await hook(p);}});return {transport,events,setHook:h=>hook=h,isAttached:()=>attached};}
const points=Array.from({length:80},(_,i)=>({x:i+10,y:50+Math.sin(i/10)*20}));
test('one curve uses one press/release with button held for every move',async()=>{
  const {transport:t,events,isAttached}=setup();await t.begin(1,'one');await t.stroke(1,'one',points);await t.cancel(1,'one');
  assert.equal(events.filter(e=>e.type==='mousePressed').length,1);assert.equal(events.filter(e=>e.type==='mouseReleased').length,1);
  const moves=events.filter(e=>e.type==='mouseMoved');assert.equal(moves.length,points.length-1);assert.ok(moves.every(e=>e.buttons===1));assert.equal(isAttached(),false);
});

test('tool clicks need only press/release and no fixed settling sleep',async()=>{
  const {transport:t,events}=setup();await t.begin(1,'tool');const result=await t.tool(1,'tool',[{x:25,y:30}]);
  assert.deepEqual(events.map(e=>e.type),['mousePressed','mouseReleased']);assert.equal(result.events,2);await t.cancel(1,'tool');
});

test('stop during pointer-rate pacing releases the held button before detach',async()=>{
  const events=[];let moved=0,detached=false;
  const t=new Transport({moveIntervalMs:30,attach:async()=>{},detach:async()=>{detached=true;},command:async(_tab,_method,p)=>{events.push(p);if(p.type==='mouseMoved'&&++moved===1)setTimeout(()=>t.cancel(1,'paced'),2);}});
  await t.begin(1,'paced');await assert.rejects(t.stroke(1,'paced',points),{name:'AbortError'});await t.cancel(1,'paced');
  assert.equal(moved,1);assert.equal(events.at(-1).type,'mouseReleased');assert.equal(detached,true);
});
test('cancel during a held drag releases the button and stops remaining moves',async()=>{
  const {transport:t,events,setHook,isAttached}=setup();await t.begin(1,'old');let count=0;setHook(p=>{if(p.type==='mouseMoved'&&++count===4)t.cancel(1,'old');});
  await assert.rejects(t.stroke(1,'old',points),{name:'AbortError'});await t.cancel(1,'old');assert.equal(events.at(-1).type,'mouseReleased');assert.ok(count<points.length);assert.equal(isAttached(),false);
});
test('quick restart never resumes the previous job or detaches the new job',async()=>{
  const {transport:t,events,setHook,isAttached}=setup();await t.begin(1,'old');let next;setHook(p=>{if(p.type==='mousePressed'&&!next)next=t.begin(1,'new');});
  await assert.rejects(t.stroke(1,'old',points),{name:'AbortError'});await next;setHook(null);await t.cancel(1,'old');assert.equal(isAttached(),true);await t.stroke(1,'new',points.slice(0,3));await t.cancel(1,'new');assert.equal(events.filter(e=>e.type==='mousePressed').length,2);assert.equal(isAttached(),false);
});
test('CDP failure still releases pressed input',async()=>{
  const {transport:t,events,setHook}=setup();await t.begin(1,'one');let count=0;setHook(p=>{if(p.type==='mouseMoved'&&++count===3)throw new Error('target closed');});
  await assert.rejects(t.stroke(1,'one',points),/target closed/);assert.equal(events.at(-1).type,'mouseReleased');await t.cancel(1,'one');
});
test('external debugger detach stops commands and invalid strokes are rejected',async()=>{
  const {transport:t}=setup();await t.begin(1,'one');await assert.rejects(t.stroke(1,'one',[{x:NaN,y:1},{x:2,y:3}]),/Invalid/);t.disconnected(1);await assert.rejects(t.stroke(1,'one',points),{name:'AbortError'});await t.cancel(1,'one');
});

for(const stalledType of ['mousePressed','mouseMoved'])test('Stop interrupts an unacknowledged '+stalledType+' without waiting for its callback',async()=>{
  const events=[];let detached=false,reached,finish;
  const sent=new Promise(resolve=>{reached=resolve;});
  const t=new Transport({moveIntervalMs:0,attach:async()=>{},detach:async()=>{detached=true;},command:async(_tab,_method,p)=>{
    events.push(p);if(p.type===stalledType){reached();await new Promise(resolve=>{finish=resolve;});}
  }});
  await t.begin(1,'stall');const job=t.stroke(1,'stall',points);const rejected=assert.rejects(job,{name:'AbortError'});
  await sent;await t.cancel(1,'stall');await rejected;
  assert.equal(detached,true);assert.equal(events.at(-1).type,'mouseReleased');const count=events.length;
  finish();await new Promise(resolve=>setTimeout(resolve,10));assert.equal(events.length,count);
});

test('a command timeout ends the curve and releases before cleanup',async()=>{
  const events=[];const t=new Transport({commandTimeoutMs:20,moveIntervalMs:0,attach:async()=>{},detach:async()=>{},command:async(_tab,_method,p)=>{events.push(p);if(p.type==='mouseMoved')await new Promise(()=>{});}});
  await t.begin(1,'timeout');await assert.rejects(t.stroke(1,'timeout',points),/timed out/);await t.cancel(1,'timeout');
  assert.deepEqual(events.map(e=>e.type),['mousePressed','mouseMoved','mouseReleased']);
});

test('cancel before begin rejects a delayed begin without attaching',async()=>{
  const {transport:t,isAttached}=setup();await t.cancel(1,'late');await assert.rejects(t.begin(1,'late'),{name:'AbortError'});assert.equal(isAttached(),false);
  await t.begin(1,'fresh');await t.cancel(1,'late');assert.equal(isAttached(),true);await t.cancel(1,'fresh');
});
