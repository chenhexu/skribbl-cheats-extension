const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Tracker}=require('../guess-delivery');
const row=(text,author='bugatti')=>({node:{},text,author,system:!author});
function fixture(){let serial=0;const timers=new Map(),confirmed=[],rejected=[];const tracker=new Tracker({setTimer:fn=>{timers.set(++serial,fn);return serial;},clearTimer:id=>timers.delete(id),onConfirm:p=>confirmed.push(p.out),onReject:(p,reason)=>rejected.push([p.out,reason])});return {tracker,confirmed,rejected,expire:()=>{for(const fn of [...timers.values()])fn();}};}
const attempt=(out='red fox')=>({word:out.replace(/^\./,''),out,author:'bugatti',round:1});

test('only an exact fresh own chat echo confirms a multiword guess',()=>{
  const {tracker:t,confirmed}=fixture(),old=row('red fox');t.seed([old]);t.begin(attempt());
  t.scan([old,row('red fox','another'),row('red foxes'),row('red fox is close!','another')]);assert.deepEqual(confirmed,[]);
  assert.equal(t.begin(attempt('other word')),null);t.scan([old,row('  Red   Fox  ')]);assert.deepEqual(confirmed,['red fox']);assert.equal(t.pending,null);
  t.scan([row('  Red   Fox  ')]);assert.deepEqual(confirmed,['red fox']);
});

test('spam rejection does not count as delivered and the same guess can be retried',()=>{
  const {tracker:t,confirmed,rejected}=fixture();t.seed([]);t.begin(attempt('cat'));
  t.scan([row("Spam detected! You're sending messages too quickly.",'another')]);assert.ok(t.pending);
  t.scan([row("Spam detected! You're sending messages too quickly.",'')]);assert.deepEqual(rejected,[['cat','spam']]);assert.deepEqual(confirmed,[]);assert.equal(t.pending,null);
  assert.ok(t.begin(attempt('cat')));t.scan([row('cat')]);assert.deepEqual(confirmed,['cat']);
});

test('chat quota pruning and same-length new rows do not hide acknowledgements',()=>{
  const {tracker:t,confirmed}=fixture(),old=row('old');t.seed([old]);t.begin(attempt('cat'));const posted=row('cat');t.scan([posted],{appended:new Set([posted.node])});assert.deepEqual(confirmed,['cat']);
});

test('rebuilding chat history does not acknowledge a new pending send',()=>{
  const {tracker:t,confirmed}=fixture();t.seed([row('red fox')]);t.begin(attempt());t.scan([row('red fox')]);assert.deepEqual(confirmed,[]);assert.ok(t.pending);
});

test('close-hit acknowledgement keeps dot and plain deliveries separate; a solve confirms the active attempt',()=>{
  const {tracker:t,confirmed}=fixture();t.begin(attempt('.red fox'));t.scan([row('.red fox is close!','')]);assert.deepEqual(confirmed,['.red fox']);
  assert.ok(t.begin(attempt('red fox')));t.scan([row('other guessed the word!','')]);assert.ok(t.pending);t.scan([row('bugatti guessed the word!','')]);assert.deepEqual(confirmed,['.red fox','red fox']);
});

test('timeout, stop and round reset leave no active timer or stale confirmation',()=>{
  const {tracker:t,confirmed,rejected,expire}=fixture();t.begin(attempt('cat'));expire();assert.deepEqual(rejected,[['cat','timeout']]);assert.equal(t.pending,null);
  t.begin(attempt('cat'));t.cancel();expire();assert.equal(rejected.length,1);
  t.reset();t.scan([row('cat')]);assert.deepEqual(confirmed,[]);
});

test('a late own echo after rejection still acknowledges the word exactly once',()=>{
  const {tracker:t,confirmed}=fixture();t.begin(attempt('cat'));t.reject('spam');t.scan([row('cat')]);t.scan([row('cat')]);assert.deepEqual(confirmed,['cat']);assert.equal(t.begin(attempt('cat')),null);
});

test('round transitions are processed before later replies in the same chat batch',()=>{
  const {tracker:t,confirmed}=fixture();t.begin(attempt('cat'));
  t.scan([row('Other is drawing now!',''),row('cat')],{onMessage:message=>{if(message.system)t.reset();}});
  assert.deepEqual(confirmed,[]);assert.equal(t.pending,null);
});
