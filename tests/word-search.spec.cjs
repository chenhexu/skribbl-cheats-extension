const {test,expect}=require('@playwright/test');
const fs=require('node:fs/promises');

const words=['fish','fishes','dolphin','whale','shark','octopus','seaweed','ocean','bread','pizza','apple','pasta','beets','toast','chair','plane','teacher','cathedral','banana','cookie','ice cream','zebra'];
async function setup(page,{hint='_____',custom=words,restore=false,legacyCache=false,removedWords=[],paddingWords=3001}={}){
  const bundleVersion='v'+require('../manifest.json').version_name;
  page.on('pageerror',error=>{throw error;});
  await page.goto('/');
  await page.evaluate(({hint,custom,restore,bundleVersion,legacyCache,removedWords,paddingWords})=>{
    document.querySelector('header').hidden=true;document.querySelector('main').hidden=true;
    if(!restore)localStorage.setItem('skribblAutoGuesserSettings_v1',JSON.stringify({delayMs:1500,dotPrefix:false,panelX:25,panelY:20,panelWidth:445,detailsCollapsed:true,devPanelOpen:false}));
    if(!restore)localStorage.setItem('skribblAutoGuesserWordCache_v1',JSON.stringify({...(legacyCache?{}:{version:'2',bundleVersion}),words:[...custom,...Array.from({length:paddingWords},(_,i)=>'paddingword'+i)],removedWords}));
    const game=document.createElement('section');game.id='game-wrapper';game.style.cssText='margin-left:500px;width:500px;padding:20px;background:#f8fafc';
    game.innerHTML='<div id="game-players"><div class="player-name">bugatti (You)</div></div><div id="currentWord"></div><div id="game-chat" class="chat"><div class="chat-content" style="height:300px;overflow:auto"></div><form><input placeholder="Type your guess here..."><button type="submit">Send</button></form></div>';
    game.querySelector('#currentWord').textContent=hint;document.body.append(game);window.submitted=[];
    window.appendChat=(text,author='')=>{const row=document.createElement('p');const b=document.createElement('b'),span=document.createElement('span');b.textContent=author?author+': ':text;span.textContent=author?text:'';row.append(b,span);game.querySelector('.chat-content').append(row);};
    game.querySelector('form').addEventListener('submit',event=>{event.preventDefault();const input=event.target.querySelector('input');submitted.push(input.value);input.value='';});
  },{hint,custom,restore,bundleVersion,legacyCache,removedWords,paddingWords});
  for(const file of ['guess-delivery.js','word-search.js','content.js'])await page.addScriptTag({content:await fs.readFile(file,'utf8')});
  await expect(page.locator('#sag-search-input')).toBeVisible();
  if(hint.trim())await expect(page.locator('#sag-candidate-top button').first()).toBeVisible();
  else await expect(page.locator('#sag-candidate-top')).toHaveText('Waiting for hint…');
}
const candidates=page=>page.locator('#sag-candidate-top button');
const values=page=>candidates(page).allTextContents();

for(const {answer,lengths,bank} of [
  {answer:'machine gun',lengths:[7,3],bank:['machine gun','grocery bag','coconut oil','fly','hot dog','bowling ball']},
  {answer:'a christmas carol',lengths:[1,9,5],bank:['a christmas carol','a christmas story','christmas carol','carol']}
])test('recovering revealed '+lengths.join('+')+' words retains every word length',async({page},info)=>{
  await setup(page,{hint:lengths.map(n=>'_'.repeat(n)).join(' '),custom:bank});
  await page.evaluate(({lengths})=>{
    const header=document.createElement('div');header.id='game-word';
    header.innerHTML='<div class="description">GUESS THIS</div><div class="word" style="display:none"></div><div class="hints"></div>';
    const container=document.querySelector('#currentWord');container.replaceChildren();container.id='';container.className='container';
    container.replaceWith(header);header.querySelector('.hints').append(container);
    // The public client creates one hint span per character, including separators.
    for(let i=0;i<lengths.reduce((a,b)=>a+b,0)+lengths.length-1;i++){
      const span=document.createElement('div');span.className='hint';span.style.display='inline-block';span.textContent='_';container.append(span);
    }
    const label=document.createElement('div');label.className='word-length';label.textContent=lengths.join(' ');container.append(label);
  },{lengths});
  const expected=lengths.map(n=>'_'.repeat(n)).join(' ')+' ('+lengths.join(' ')+')';
  await expect(page.locator('#sag-hint-compact')).toHaveText(expected);
  await page.evaluate(letter=>document.querySelector('#game-word .hint').textContent=letter,answer[0]);
  await expect(page.locator('#sag-hint-compact')).toHaveText(answer[0]+expected.slice(1));
  await page.evaluate(answer=>{
    document.querySelectorAll('#game-word .hint').forEach((span,i)=>span.textContent=answer[i]);
    appendChat('bugatti guessed the word!');
  },answer);
  const recover=page.getByRole('button',{name:'Not guessed? Show words'});await expect(recover).toBeVisible();await recover.click();
  await expect(page.locator('#sag-hint-compact')).toHaveText(expected);
  await expect.poll(()=>values(page)).toEqual(bank.filter(word=>word.split(' ').map(w=>w.length).join(' ')===lengths.join(' ')).sort());
  await page.locator('#skribbl-auto-guesser-panel').screenshot({path:info.outputPath('recovered-'+lengths.join('-')+'.png')});
  await page.evaluate(()=>{
    document.querySelector('#game-word .hints').style.display='none';
    const other=document.createElement('div');other.textContent='Round 1 of 3';document.querySelector('#game-wrapper').append(other);
  });
  await expect(page.locator('#sag-candidate-top')).toHaveText('Waiting for hint…');
});

test('no hint waits quietly despite failed AI health; genuine empty results and service errors stay distinct',async({page},info)=>{
  let healthCalls=0,searchCalls=0;
  await page.route('**/health',route=>{healthCalls++;return route.abort('failed');});
  await page.route('**/api/word-search',route=>{searchCalls++;return route.fulfill({status:503,json:{error:'Search service offline'}});});
  await setup(page,{hint:''});await page.locator('#sag-related-words').check();
  await expect.poll(()=>healthCalls).toBeGreaterThan(0);
  const search=page.locator('#sag-search-input'),status=page.locator('#sag-search-status'),list=page.locator('#sag-candidate-top');
  await search.fill('food');await page.waitForTimeout(300);
  await expect(status).toBeHidden();await expect(list).toHaveText('Waiting for hint…');expect(searchCalls).toBe(0);
  await page.locator('#skribbl-auto-guesser-panel').screenshot({path:info.outputPath('waiting-for-hint.png')});
  await page.evaluate(()=>document.querySelector('#currentWord').textContent='_____');
  await expect.poll(()=>values(page)).toContain('bread');
  await expect(status).toContainText('Search service offline');expect(searchCalls).toBe(1);
  await search.fill('zzzzzzz');await expect(list).toHaveText('No matches');
  await page.evaluate(()=>document.querySelector('#currentWord').textContent='');
  await expect(list).toHaveText('Waiting for hint…');await expect(status).toBeHidden();
});

test('offline animal and insect searches include species, parts and strictly eligible phrases',async({page},info)=>{
  await page.route('**/api/word-search',route=>route.fulfill({status:503,json:{error:'Offline fixture'}}));
  await setup(page,{hint:'________',custom:['reindeer','dinosaur','bear trap','tail','mantis','insect','spider','cathedral','bear claw','bear traps','boar trap','deer trap']});
  await page.locator('#sag-related-words').check();
  const search=page.locator('#sag-search-input');await search.fill('animal');
  await expect.poll(()=>values(page)).toEqual(['dinosaur','reindeer']);
  await expect(page.locator('#sag-search-status')).toContainText('Offline fixture');
  expect(await candidates(page).filter({hasText:'reindeer'}).getAttribute('data-match')).toBe('Animals category');
  await page.locator('#skribbl-auto-guesser-panel').screenshot({path:info.outputPath('offline-reindeer.png')});
  await page.evaluate(()=>document.querySelector('#currentWord').textContent='____');
  await expect.poll(()=>values(page)).toEqual(['tail']);
  expect(await candidates(page).first().getAttribute('data-match')).toContain('part or related item');
  await page.evaluate(()=>document.querySelector('#currentWord').textContent='____ ____');
  await expect.poll(()=>values(page)).toEqual(['bear claw','bear trap','boar trap','deer trap']);
  await page.evaluate(()=>document.querySelector('#currentWord').textContent='b___ t___');
  await expect.poll(()=>values(page)).toEqual(['bear trap','boar trap']);
  await page.locator('#sag-search-closest').uncheck();await expect.poll(()=>values(page)).toEqual(['bear trap','boar trap']);
  await page.locator('#skribbl-auto-guesser-panel').screenshot({path:info.outputPath('offline-animal-phrases.png')});
  await page.evaluate(()=>document.querySelector('#currentWord').textContent='______');await search.fill('insect');
  await expect.poll(()=>values(page)).toEqual(['insect','mantis']);
  expect(await candidates(page).filter({hasText:'mantis'}).getAttribute('data-match')).toBe('Insects category');
  await page.locator('#skribbl-auto-guesser-panel').screenshot({path:info.outputPath('offline-mantis.png')});
});

test('new round clears the query and ignores old AI results; hint reveals and Stop keep it',async({page})=>{
  const releases=[],requests=[];
  await page.route('**/api/word-search',async route=>{
    requests.push(route.request().postDataJSON());await new Promise(resolve=>releases.push(resolve));
    try{await route.fulfill({json:{matches:[{word:'chair',score:1}]}});}catch(_){}
  });
  await setup(page);await page.locator('#sag-related-words').check();
  const search=page.locator('#sag-search-input');await search.fill('food');
  await expect.poll(()=>requests.length).toBe(1);
  await page.locator('#sag-stop').click();await expect(search).toHaveValue('food');
  await page.evaluate(()=>document.querySelector('#currentWord').textContent='___t_');
  await expect.poll(()=>values(page)).toEqual(['beets','pasta']);await expect(search).toHaveValue('food');
  // A fresh transition may arrive while semantic inference is still pending.
  await page.evaluate(()=>appendChat('Other is drawing now!'));
  await expect(search).toHaveValue('');await expect(page.locator('#sag-search-hint')).toBeHidden();
  await page.evaluate(()=>document.querySelector('#currentWord').textContent='_____');
  await expect.poll(()=>values(page)).toContain('chair');
  releases.forEach(resolve=>resolve());await page.waitForTimeout(350);
  await expect(search).toHaveValue('');expect(await values(page)).toContain('apple');expect(await values(page)).toContain('chair');
  await expect(page.locator('#sag-related-words')).toBeChecked();
});

test('food search is instant, hint restricted, alphabetical and survives unavailable AI',async({page},info)=>{
  await page.route('**/api/word-search',route=>route.fulfill({status:503,json:{error:'Missing checkpoint'}}));
  await setup(page);await page.locator('#sag-related-words').check();
  await page.locator('#sag-search-input').fill('food');
  await expect.poll(()=>values(page)).toEqual(['apple','beets','bread','pasta','pizza','toast']);
  await expect(page.locator('#sag-search-status')).toContainText('AI unavailable');
  await expect(page.locator('#sag-search-status')).toContainText('Missing checkpoint');
  expect(await candidates(page).first().getAttribute('data-match')).toBe('Food category');
  expect(await candidates(page).first().evaluate(el=>getComputedStyle(el).borderLeftWidth)).toBe('4px');
  await page.locator('#sag-search-closest').uncheck();
  await expect.poll(()=>values(page)).toEqual(['apple','beets','bread','pasta','pizza','toast']);
  await page.evaluate(()=>document.querySelector('#currentWord').textContent='___t_');
  await expect.poll(()=>values(page)).toEqual(['beets','pasta']);
  await page.locator('#skribbl-auto-guesser-panel').screenshot({path:info.outputPath('food-hint-search.png')});
  await page.locator('#sag-search-input').press('Enter');
  await expect.poll(()=>page.evaluate(()=>submitted)).toEqual(['beets']);
});

test('AI updates use current order for shortcuts, filter malicious extras and reuse cached scores',async({page})=>{
  let calls=0;
  await page.route('**/api/word-search',async route=>{calls++;const body=route.request().postDataJSON();expect(body.candidates.every(w=>w.length===7)).toBe(true);await route.fulfill({json:{matches:[{word:'teacher',score:.95},{word:'dolphin',score:.8},{word:'seaweed',score:.7},{word:'pizza',score:1}]}});});
  await setup(page,{hint:'_______'});await page.locator('#sag-related-words').check();await page.locator('#sag-search-input').fill('fish');
  await expect(page.locator('#sag-search-status')).toContainText('Local AI ready');
  const ranked=await values(page);expect(ranked[0]).toBe('teacher');expect(ranked).toContain('dolphin');expect(ranked).not.toContain('pizza');
  await page.locator('#sag-search-closest').uncheck();
  await expect.poll(()=>values(page)).toEqual(['dolphin','octopus','seaweed','teacher']);expect(calls).toBe(1);
  await page.locator('#sag-search-input').press('2');await expect.poll(()=>page.evaluate(()=>submitted)).toEqual(['octopus']);
  await page.evaluate(()=>appendChat('octopus','bugatti'));await expect.poll(()=>values(page)).not.toContain('octopus');
});

test('old query and hint responses cannot replace current matches; rapid typing makes one request',async({page})=>{
  const requests=[];let release;
  await page.route('**/api/word-search',async route=>{
    const body=route.request().postDataJSON();requests.push(body);
    if(body.query==='fish')await new Promise(resolve=>release=resolve);
    try{await route.fulfill({json:{matches:body.candidates.map(word=>({word,score:word==='chair'?.9:.2}))}});}catch(_){}
  });
  await setup(page);await page.locator('#sag-related-words').check();
  await page.locator('#sag-search-input').pressSequentially('fish',{delay:25});
  await expect.poll(()=>requests.length).toBe(1);expect(requests[0].query).toBe('fish');
  await page.locator('#sag-search-input').fill('food');await page.evaluate(()=>document.querySelector('#currentWord').textContent='___t_');
  await expect.poll(()=>requests.length).toBe(2);release();
  await expect.poll(()=>values(page)).toEqual(['beets','pasta']);
  expect(requests[1].candidates).toEqual(expect.arrayContaining(['beets','pasta']));expect(requests[1].candidates.every(w=>w.length===5 && w[3]==='t')).toBe(true);
});

test('ordinary substring behavior, persistence and the full bank beyond 1200 candidates',async({page})=>{
  const large=Array.from({length:1301},(_,i)=>'a'+[Math.floor(i/676)%26,Math.floor(i/26)%26,i%26,0].map(n=>String.fromCharCode(97+n)).join(''));
  await setup(page,{custom:[...large,'zebra','dolphin']});
  await page.locator('#sag-search-input').fill('zeb');await expect.poll(()=>values(page)).toEqual(['zebra']);
  await page.locator('#sag-related-words').check();await page.locator('#sag-search-closest').uncheck();
  await setup(page,{restore:true});await expect(page.locator('#sag-related-words')).toBeChecked();await expect(page.locator('#sag-search-closest')).not.toBeChecked();
  await page.locator('#sag-related-words').uncheck();await page.evaluate(()=>document.querySelector('#currentWord').textContent='_______');
  await page.locator('#sag-search-input').fill('dol');await expect.poll(()=>values(page)).toEqual(['dolphin']);
});

test('actual local model returns semantic suggestions while preserving five-letter limits',async({page},info)=>{
  const health=await (await page.request.get('/health')).json();test.skip(!health.wordSearch?.installed,'Install optional search model');
  await setup(page);await page.locator('#sag-related-words').check();await page.locator('#sag-search-input').fill('ocean');
  await expect(page.locator('#sag-search-status')).toContainText('Local AI ready',{timeout:30000});
  expect(await values(page)).toContain('shark');expect(await values(page)).toContain('whale');expect((await values(page)).every(word=>word.length===5)).toBe(true);
  await page.locator('#sag-search-input').fill('food');await expect(page.locator('#sag-search-status')).toContainText('Local AI ready');
  expect(await values(page)).toContain('bread');expect(await values(page)).not.toContain('chair');
  await page.locator('#skribbl-auto-guesser-panel').screenshot({path:info.outputPath('local-semantic-search.png')});
});

test('missing extension permission is explicit and setup opens the extension viewer',async({page})=>{
  await setup(page);
  await page.evaluate(()=>{window.extensionMessages=[];window.chrome={runtime:{id:'fixture',sendMessage:async message=>{extensionMessages.push(message);return message.action==='openStudio'?{ok:true}:{ok:false,error:'Enable local AI access using Local AI setup in the large viewer'};}}};});
  await page.locator('#sag-related-words').check();await page.locator('#sag-search-input').fill('food');
  await expect(page.locator('#sag-search-status')).toContainText('Enable local AI access');expect(await values(page)).toContain('bread');
  await page.locator('#sag-search-setup').click();expect((await page.evaluate(()=>extensionMessages)).at(-1)).toEqual({action:'openStudio',setup:true});
  await expect(page.locator('#sag-search-status')).toContainText('Choose an engine in AI setup');
});

test('full dictionary semantic results and live typing stay responsive',async({page},info)=>{
  const health=await (await page.request.get('/health')).json();test.skip(!health.wordSearch?.installed,'Install optional search model');
  const content=await fs.readFile('content.js','utf8'),bundle=JSON.parse(content.split('const BUNDLED_WORDS = ')[1].split('];')[0]+']');
  await setup(page,{hint:'_______',custom:bundle});await page.locator('#sag-related-words').check();
  await page.locator('#sag-search-input').fill('fish');await expect(page.locator('#sag-search-status')).toContainText('Local AI ready',{timeout:30000});
  expect(await values(page)).toContain('dolphin');expect((await values(page)).every(w=>w.length===7)).toBe(true);
  await page.locator('#skribbl-auto-guesser-panel').screenshot({path:info.outputPath('fish-full-dictionary.png')});
  await page.evaluate(()=>document.querySelector('#currentWord').textContent='______');
  await page.locator('#sag-search-input').fill('music');await expect(page.locator('#sag-search-status')).toContainText('Local AI ready');
  await expect(candidates(page).first()).toHaveText('guitar');expect(await candidates(page).first().getAttribute('data-match')).toContain('local AI');
  await page.locator('#skribbl-auto-guesser-panel').screenshot({path:info.outputPath('music-real-ai.png')});
  await page.evaluate(()=>document.querySelector('#currentWord').textContent='_____');await page.locator('#sag-search-input').fill('food');
  await expect(page.locator('#sag-search-status')).toContainText('Local AI ready');expect(await values(page)).toContain('bread');
  await page.locator('#skribbl-auto-guesser-panel').screenshot({path:info.outputPath('food-full-dictionary.png')});
  const timings=await page.evaluate(async()=>{
    const input=document.querySelector('#sag-search-input'),samples=[];
    // Measure actual input handlers plus layout, with the real dictionary loaded.
    for(const query of ['f','fo','foo','food']){
      const start=performance.now();input.value=query;input.dispatchEvent(new Event('input',{bubbles:true}));await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);samples.push({query,ms:performance.now()-start});
    }
    return samples;
  });
  expect(Math.max(...timings.map(t=>t.ms))).toBeLessThan(250);
  await fs.writeFile(info.outputPath('typing-latency.json'),JSON.stringify(timings,null,2));
});

test('startup readiness appears before typing and a busy early search retries when preload finishes',async({page},info)=>{
  let ready=false,posts=0;
  await page.route('**/health',route=>route.fulfill({json:{wordSearch:{ready,warming:!ready,installed:true,preloadState:ready?'ready':'encoding',preloadedWords:ready?100:64,totalWords:100}}}));
  await page.route('**/api/word-search',route=>{posts++;return route.fulfill(ready?{json:{matches:[{word:'bread',score:.7}]}}:{status:503,json:{error:'Word-search model busy. Continue typing to retry.'}});});
  await setup(page);await page.locator('#sag-related-words').check();
  await expect(page.locator('#sag-search-status')).toContainText('Warming up local AI');expect(posts).toBe(0);
  await page.locator('#skribbl-auto-guesser-panel').screenshot({path:info.outputPath('preloading.png')});
  await page.locator('#sag-search-input').fill('food');await expect(page.locator('#sag-search-status')).toContainText('AI unavailable');
  ready=true;
  await expect(page.locator('#sag-search-status')).toContainText('Local AI ready',{timeout:5000});expect(posts).toBe(2);
  await page.locator('#sag-search-input').fill('');await expect(page.locator('#sag-search-status')).toHaveText('Local AI ready · preloaded');
  await page.locator('#skribbl-auto-guesser-panel').screenshot({path:info.outputPath('preloaded-ready.png')});
  await page.locator('#sag-related-words').uncheck();await expect(page.locator('#sag-search-status')).toBeHidden();
});

test('real startup preloads the public bank before the first typed query',async({page})=>{
  const initial=await (await page.request.get('/health')).json();test.skip(!initial.wordSearch?.installed,'Install optional search model');
  await expect.poll(async()=>((await (await page.request.get('/health')).json()).wordSearch.preloadState),{timeout:60000}).toBe('ready');
  const health=(await (await page.request.get('/health')).json()).wordSearch;
  expect(health.preloadedWords).toBeGreaterThan(3000);expect(health.warming).toBe(false);
  const response=await page.request.post('/api/word-search',{data:{query:'food',candidates:['bread','apple','pizza']}});
  const body=await response.json();expect(response.ok()).toBe(true);expect(body.encodedWords).toBe(0);
  expect(body.processingMs).toBeLessThan(500);
  await setup(page);await page.locator('#sag-related-words').check();await expect(page.locator('#sag-search-status')).toHaveText('Local AI ready · preloaded');
});

test('redstone remains searchable under the reported hint before and after weak AI scores',async({page},info)=>{
  await page.route('**/api/word-search',route=>route.fulfill({json:{matches:[{word:'redstone',score:.394}]}}));
  await setup(page,{hint:'r_____n_',custom:['redstone','sandstone','redwood','blackboard']});
  await page.locator('#sag-search-input').fill('stone');await expect.poll(()=>values(page)).toEqual(['redstone']);
  await page.locator('#sag-related-words').check();await expect(page.locator('#sag-search-status')).toContainText('Local AI ready');
  await expect.poll(()=>values(page)).toEqual(['redstone']);
  expect(await candidates(page).first().getAttribute('data-match')).toBe('Contains your search');
  for(const query of ['color','colour']){
    await page.locator('#sag-search-input').fill(query);await expect.poll(()=>values(page)).toEqual(['redstone']);
    await expect(page.locator('#sag-search-status')).toContainText('Local AI ready');await expect.poll(()=>values(page)).toEqual(['redstone']);
    expect(await candidates(page).first().getAttribute('data-match')).toBe('Contains color term: red');
  }
  await page.locator('#skribbl-auto-guesser-panel').screenshot({path:info.outputPath('redstone-color.png')});
  await page.evaluate(()=>document.querySelector('#currentWord').textContent='r____a__');await expect.poll(()=>values(page)).toEqual([]);
});

test('old dictionaries acquire Spotify while retaining custom words and explicit removals across updates',async({page},info)=>{
  const requests=[];page.on('request',request=>requests.push(request.url()));
  await setup(page,{hint:'_______',custom:['spoiler','redstone','zzcustomword'],legacyCache:true});
  await page.locator('#sag-search-input').fill('spo');await expect.poll(()=>values(page)).toEqual(['spoiler','spotify']);
  const cache=await page.evaluate(()=>JSON.parse(localStorage.getItem('skribblAutoGuesserWordCache_v1')));
  expect(cache.version).toBe('2');expect(cache.words).toContain('zzcustomword');expect(cache.words).toContain('spotify');
  expect(requests.some(url=>/raw\.githubusercontent|cdn\.jsdelivr/.test(url))).toBe(false);
  await page.locator('#skribbl-auto-guesser-panel').screenshot({path:info.outputPath('spotify-restored.png')});
  await page.locator('#sag-details-toggle').click();await page.locator('#sag-word-input').fill('Spotify');await page.locator('#sag-remove-word').click();
  await expect.poll(()=>values(page)).toEqual(['spoiler']);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('skribblAutoGuesserWordCache_v1')).removedWords)).toContain('spotify');
  await page.evaluate(()=>{const key='skribblAutoGuesserWordCache_v1',cache=JSON.parse(localStorage.getItem(key));cache.bundleVersion='older-release';localStorage.setItem(key,JSON.stringify(cache));});
  await setup(page,{restore:true,hint:'_______'});await page.locator('#sag-search-input').fill('spo');await expect.poll(()=>values(page)).toEqual(['spoiler']);
  await page.locator('#sag-word-input').fill('Spotify');await page.locator('#sag-add-word').click();await expect.poll(()=>values(page)).toEqual(['spoiler','spotify']);
  await setup(page,{restore:true,hint:'____________'});await page.locator('#sag-search-input').fill('zzcustom');await expect.poll(()=>values(page)).toEqual(['zzcustomword']);
  // Small legacy caches used to be discarded entirely; they also retain custom words.
  await setup(page,{hint:'____________',custom:['zzcustomword'],legacyCache:true,paddingWords:0});
  await page.locator('#sag-search-input').fill('zzcustom');await expect.poll(()=>values(page)).toEqual(['zzcustomword']);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('skribblAutoGuesserWordCache_v1')).words)).toContain('spotify');
});
