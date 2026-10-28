const {test}=require('node:test');
const assert=require('node:assert/strict');
const S=require('../word-search');
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
test('related search combines spelling, plurals and ocean relationships without adding words',()=>{
  const bank=['fish','fishes','dolphin','shark','chair','jellyfish','fishbowl'];
  const matches=S.rank('fish',bank,{related:true});
  assert.equal(matches[0].word,'fish');assert.equal(matches[1].word,'fishes');
  assert.ok(matches.some(m=>m.word==='dolphin' && /ocean life/.test(m.reason)));
  assert.ok(matches.some(m=>m.word==='shark' && m.strong));assert.ok(!matches.some(m=>m.word==='chair'));
  assert.ok(matches.every(m=>bank.includes(m.word)));
  assert.deepEqual(S.rank('dol',bank).map(m=>m.word),['dolphin']);
  assert.deepEqual(S.rank('fish',bank).map(m=>m.word),['fish','fishes','jellyfish','fishbowl']);
});
test('food categories respect a supplied hint bank and alphabetic option keeps the same matches',()=>{
  const bank=['pizza','apple','bread','chair','plane','toast'];
  const ranked=S.rank('food',bank,{related:true}), alpha=S.rank('food',bank,{related:true,closestFirst:false});
  assert.deepEqual(ranked.map(m=>m.word),['apple','bread','pizza','toast']);
  assert.deepEqual(new Set(ranked.map(m=>m.word)),new Set(alpha.map(m=>m.word)));
  assert.ok(ranked.every(m=>m.strong));assert.ok(!S.rank('animals',['cathedral'],{related:true}).length);
  assert.equal(S.rank('food',['cookies'],{related:true})[0].reason,'Food category');
  assert.deepEqual(S.rank('food',['flood','apple'],{related:true}).map(m=>m.word),['apple','flood']);
});
test('80 percent spelling is strong and unrelated semantic response entries cannot enter the bank',()=>{
  assert.equal(S.spelling('apple','applf'),.8);
  const matches=S.rank('applf',['apple','chair'],{related:true,semantic:[{word:'dolphin',score:1},{word:'chair',score:.3}]});
  assert.equal(matches[0].word,'apple');assert.equal(matches[0].strong,true);assert.match(matches[0].reason,/80%/);
  assert.ok(!matches.some(m=>m.word==='dolphin'));assert.match(S.indicator(matches[0]).border,/120 /);
  const semantic=S.rank('machine',['device','banana'],{related:true,semantic:[{word:'device',score:.65},{word:'banana',score:.39}]});
  assert.deepEqual(semantic.map(m=>m.word),['device']);assert.match(semantic[0].reason,/local AI/);
});

test('offline animals include species, lower-ranked parts and whole terms in phrases',()=>{
  const bank=['reindeer','mantis','tail','antlers','bear trap','red panda','cathedral','antique','chair'];
  const ranked=S.rank('animals',bank,{related:true});
  for(const word of ['reindeer','mantis','red panda']){
    const match=ranked.find(m=>m.word===word);assert.ok(match,word);assert.equal(match.strong,true);assert.equal(match.reason,'Animals category');
  }
  for(const word of ['tail','antlers','bear trap']){
    const match=ranked.find(m=>m.word===word);assert.ok(match,word);assert.equal(match.strong,false);assert.ok(match.score<ranked.find(m=>m.word==='reindeer').score);
  }
  assert.ok(!ranked.some(m=>['cathedral','antique','chair'].includes(m.word)));
  assert.deepEqual(new Set(S.rank('animal',bank,{related:true,closestFirst:false}).map(m=>m.word)),new Set(ranked.map(m=>m.word)));
  assert.deepEqual(S.rank('animals',['tail'],{related:false}),[]);
  assert.match(S.rank('animal',['dog-walker'],{related:true})[0].reason,/Contains animals term: dog/);
  assert.match(S.rank('food',['apple pie'],{related:true})[0].reason,/Contains food term/);
});

test('insects include mantis and inherited animal coverage without classifying spiders as insects',()=>{
  const bank=['mantis','mantises','praying mantis','beetle','grasshopper','moth','spider','scorpion','wing','antennae'];
  for(const query of ['insect','insects','bug','bugs']){
    const ranked=S.rank(query,bank,{related:true});
    for(const word of ['mantis','mantises','praying mantis','beetle','grasshopper','moth'])assert.equal(ranked.find(m=>m.word===word)?.reason,'Insects category',query+' → '+word);
    for(const word of ['wing','antennae'])assert.ok(ranked.find(m=>m.word===word) && !ranked.find(m=>m.word===word).strong);
    assert.ok(!ranked.some(m=>['spider','scorpion'].includes(m.word)));
  }
  for(const word of ['mantis','beetle','spider','scorpion','axolotl','goldfish','reindeer'])assert.equal(S.rank('animal',[word],{related:true})[0]?.reason,'Animals category',word);
});
test('literal stone survives weak AI scores and color compounds use recognizable terms only',async()=>{
  const bank=['redstone','blueberry','greenhouse','blackboard','redemption','prediction','chair'];
  assert.deepEqual(S.rank('stone',['redstone'],{related:false}).map(m=>m.word),['redstone']);
  assert.equal(S.rank('stone',['redstone'],{related:true,semantic:[{word:'redstone',score:.01}]})[0].reason,'Contains your search');
  for(const query of ['color','colour','colors','colours']){
    const matches=S.rank(query,bank,{related:true});
    assert.deepEqual(matches.map(m=>m.word),['blackboard','blueberry','greenhouse','redstone']);
    assert.equal(matches.find(m=>m.word==='redstone').reason,'Contains color term: red');
  }
  const c=new S.Controller({delay:1,request:async()=>({matches:[{word:'redstone',score:.01}]})});
  assert.deepEqual(c.search('stone',['redstone'],{related:true}).map(m=>m.word),['redstone']);await wait(10);
  assert.deepEqual(c.search('stone',['redstone'],{related:true}).map(m=>m.word),['redstone']);c.reset();
  const matches=S.rank('color',['red','redstone','red panda','redemption'],{related:true});
  assert.equal(matches[0].word,'red');assert.equal(matches[0].strong,true);assert.equal(matches.find(m=>m.word==='redstone').strong,false);
});
test('controller debounces, cancels and ignores late replies across queries, hints and reset',async()=>{
  const requests=[];let updates=0;
  const c=new S.Controller({delay:5,onUpdate:()=>updates++,request:(q,bank,signal)=>new Promise(resolve=>requests.push({q,bank,signal,resolve}))});
  c.search('fi',['shark'],{related:true});c.search('fis',['shark'],{related:true});await wait(15);
  assert.equal(requests.length,1);assert.equal(requests[0].q,'fis');
  c.search('food',['bread'],{related:true,context:'round2'});assert.equal(requests[0].signal.aborted,true);await wait(15);
  requests[0].resolve({matches:[{word:'shark',score:1}]});await wait(1);assert.equal(updates,0);
  requests[1].resolve({matches:[{word:'bread',score:.8},{word:'shark',score:1}]});await wait(1);
  assert.equal(updates,1);assert.deepEqual(c.search('food',['bread'],{related:true,context:'round2'}).map(m=>m.word),['bread']);
  c.search('food',['toast'],{related:true,context:'round2'});await wait(15);c.reset();
  requests[2].resolve({matches:[{word:'toast',score:1}]});await wait(1);assert.equal(updates,1);
});
test('cached model scores avoid requests when changing sort and failures preserve category matches',async()=>{
  let calls=0;const c=new S.Controller({delay:1,request:async()=>{calls++;return {matches:[{word:'whale',score:.8}]};}});
  c.search('fish',['whale','shark'],{related:true});await wait(10);
  c.search('fish',['whale','shark'],{related:true,closestFirst:false});assert.equal(calls,1);
  c.search('other',['whale'],{related:false});c.search('fish',['whale','shark'],{related:true});await wait(10);assert.equal(calls,1);
  const failing=new S.Controller({delay:1,request:async()=>{throw Error('Missing checkpoint');}});
  failing.search('food',['bread','chair'],{related:true});await wait(10);
  assert.deepEqual(failing.search('food',['bread','chair'],{related:true}).map(m=>m.word),['bread']);assert.match(failing.status,/AI unavailable.*Missing checkpoint/);
  c.reset();failing.reset();
});
