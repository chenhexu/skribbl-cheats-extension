const {test,expect}=require('@playwright/test');
const fs=require('node:fs/promises');

async function setup(page,{dot=false,delay=1,hint='___'}={}) {
  const bundleVersion='v'+require('../manifest.json').version_name;
  page.on('pageerror',error=>{throw error;});
  await page.goto('/');
  await page.evaluate(({dot,delay,hint,bundleVersion})=>{
    document.querySelector('header').hidden=true;document.querySelector('main').hidden=true;
    localStorage.setItem('skribblAutoGuesserSettings_v1',JSON.stringify({delayMs:delay,dotPrefix:dot,panelX:750,panelY:20,devPanelOpen:true}));
    localStorage.setItem('skribblAutoGuesserWordCache_v1',JSON.stringify({version:'2',bundleVersion,words:['cat','dog','elk','red fox',...Array.from({length:3001},(_,i)=>'paddingword'+i)]}));
    const game=document.createElement('section');game.id='game-wrapper';game.style.cssText='width:650px;margin:20px;background:#f4f4f4;padding:10px';
    game.innerHTML='<div id="game-players"><div class="player-name">bugatti (You)</div></div><div id="currentWord"></div><div id="game-chat" class="chat"><div class="chat-content" style="height:300px;overflow:auto"></div><form><input type="text" placeholder="Type your guess here..."><button type="submit">Send</button></form></div>';
    game.querySelector('#currentWord').textContent=hint;document.body.append(game);
    window.submitted=[];window.outcome='hold';
    window.appendChat=(text,author='')=>{const row=document.createElement('p'),b=document.createElement('b'),span=document.createElement('span');b.textContent=author?author+': ':text;span.textContent=author?text:'';row.append(b,span);game.querySelector('.chat-content').append(row);return row;};
    game.querySelector('form').addEventListener('submit',event=>{event.preventDefault();const input=event.target.querySelector('input'),text=input.value;if(!text)return;submitted.push(text);input.value='';if(outcome==='accept')appendChat(text,'bugatti');else if(outcome==='spam')appendChat("Spam detected! You're sending messages too quickly.");});
  },{dot,delay,hint,bundleVersion});
  await page.addScriptTag({content:await fs.readFile('guess-delivery.js','utf8')});
  await page.addScriptTag({content:await fs.readFile('word-search.js','utf8')});
  await page.addScriptTag({content:await fs.readFile('content.js','utf8')});
  await expect(page.locator('#sag-status')).toHaveText('Ready');
}
async function snapshot(page){await page.locator('#sag-dev-snap').click();return JSON.parse(await page.locator('#sag-dev-snap-out').textContent());}

test('automatic guesses wait for own chat confirmation and retry a spam-rejected word',async({page},info)=>{
  await setup(page);await page.locator('#sag-start').click();await expect.poll(()=>page.evaluate(()=>submitted)).toEqual(['cat']);
  let state=await snapshot(page);expect(state.sentThisRound).toEqual([]);expect(state.lastGuess).toBe('');expect(state.pendingGuess).toBe('cat');
  await page.evaluate(()=>appendChat('cat','another'));state=await snapshot(page);expect(state.pendingGuess).toBe('cat');expect(state.sentThisRound).toEqual([]);
  await page.evaluate(()=>appendChat("Spam detected! You're sending messages too quickly.",'another'));
  expect((await snapshot(page)).pendingGuess).toBe('cat');
  await page.evaluate(()=>appendChat("Spam detected! You're sending messages too quickly."));
  await expect(page.locator('#sag-status')).toContainText('spam');state=await snapshot(page);expect(state.sentThisRound).toEqual([]);expect(state.retryGuess).toBe('cat');expect(state.pendingGuess).toBeNull();
  await page.locator('#skribbl-auto-guesser-panel').screenshot({path:info.outputPath('spam-retry.png')});
  await expect.poll(()=>page.evaluate(()=>submitted),{timeout:6500}).toEqual(['cat','cat']);
  state=await snapshot(page);expect(state.pendingGuess).toBe('cat');expect(state.lastGuess).toBe('');
  await page.evaluate(()=>appendChat('cat','bugatti'));await expect(page.locator('#sag-last-guess')).toHaveText('cat');
  await expect.poll(()=>page.evaluate(()=>submitted.length)).toBe(3);expect((await page.evaluate(()=>submitted))[2]).toBe('dog');
  state=await snapshot(page);expect(state.sentThisRound).toEqual(['cat']);expect(state.pendingGuess).toBe('dog');
  await page.locator('#skribbl-auto-guesser-panel').screenshot({path:info.outputPath('confirmed-guesser.png')});await page.locator('#sag-stop').click();
});

test('manual multiword guesses confirm only after a fresh own row, even with chat pruning',async({page})=>{
  await setup(page,{hint:'___ ___'});
  // Search keyboard and candidate clicks use the same delivery state.
  await page.locator('#sag-search-input').fill('red fox');await page.locator('#sag-search-input').press('Enter');
  await expect.poll(()=>page.evaluate(()=>submitted)).toEqual(['red fox']);expect((await snapshot(page)).sentThisRound).toEqual([]);
  await page.evaluate(()=>appendChat('red fox','other'));expect((await snapshot(page)).pendingGuess).toBe('red fox');
  await page.evaluate(()=>{const chat=document.querySelector('.chat-content');chat.replaceChildren();appendChat('red fox','bugatti');});
  await expect(page.locator('#sag-last-guess')).toHaveText('red fox');const state=await snapshot(page);expect(state.sentThisRound).toEqual(['red fox']);expect(state.pendingGuess).toBeNull();
});

test('a rejected dot close-hit resend stays pending until the plain word is confirmed',async({page})=>{
  await setup(page,{dot:true});await page.locator('#sag-start').click();await expect.poll(()=>page.evaluate(()=>submitted)).toEqual(['.cat']);
  await page.evaluate(()=>appendChat('.cat is close!'));await expect.poll(()=>page.evaluate(()=>submitted)).toEqual(['.cat','cat']);
  await page.evaluate(()=>appendChat("Spam detected! You're sending messages too quickly."));expect((await snapshot(page)).retryGuess).toBe('cat');
  await expect.poll(()=>page.evaluate(()=>submitted.length),{timeout:6500}).toBe(3);expect((await page.evaluate(()=>submitted))[2]).toBe('cat');
  await page.evaluate(()=>appendChat('bugatti guessed the word!'));await expect(page.locator('#sag-last-guess')).toHaveText('cat');expect((await snapshot(page)).pendingGuess).toBeNull();expect((await snapshot(page)).running).toBe(false);
});

test('unconfirmed sends, Stop and a new round never mark an unsent word as delivered',async({page})=>{
  await setup(page);await page.locator('#sag-start').click();await expect.poll(()=>page.evaluate(()=>submitted)).toEqual(['cat']);
  await expect.poll(async()=>{const s=await snapshot(page);return s.retryGuess;},{timeout:4000}).toBe('cat');expect((await snapshot(page)).sentThisRound).toEqual([]);
  await page.locator('#sag-stop').click();const before=await page.evaluate(()=>submitted.length);
  await page.evaluate(()=>appendChat('cat is close!'));expect((await snapshot(page)).running).toBe(false);
  await page.evaluate(()=>appendChat('Other is drawing now!'));await page.locator('#sag-dev-snap').click();const state=await snapshot(page);expect(state.pendingGuess).toBeNull();expect(state.retryGuess).toBeNull();expect(state.sentThisRound).toEqual([]);expect(await page.evaluate(()=>submitted.length)).toBe(before);
});

test('a transition preceding an old echo in the same batch cannot confirm the next round',async({page})=>{
  await setup(page);await page.locator('#sag-start').click();await expect.poll(()=>page.evaluate(()=>submitted)).toEqual(['cat']);
  await page.locator('#sag-stop').click();
  await page.evaluate(()=>{appendChat('Other is drawing now!');appendChat('cat','bugatti');});
  const state=await snapshot(page);expect(state.pendingGuess).toBeNull();expect(state.sentThisRound).toEqual([]);expect(state.lastGuess).toBe('');
});

test('Stop prevents spam recovery from restarting a rejected guess',async({page})=>{
  await setup(page);await page.clock.install();await page.locator('#sag-start').click();await page.clock.runFor(100);
  expect(await page.evaluate(()=>submitted)).toEqual(['cat']);
  await page.evaluate(()=>appendChat("Spam detected! You're sending messages too quickly."));
  await page.clock.runFor(4200);expect(await page.evaluate(()=>submitted)).toEqual(['cat','cat']);
  await page.evaluate(()=>appendChat("Spam detected! You're sending messages too quickly."));
  expect((await snapshot(page)).running).toBe(false);expect((await snapshot(page)).retryGuess).toBe('cat');
  await page.locator('#sag-stop').click();await page.clock.runFor(14000);
  expect(await page.evaluate(()=>submitted)).toEqual(['cat','cat']);expect((await snapshot(page)).sentThisRound).toEqual([]);
  await page.locator('#sag-start').click();await page.clock.runFor(100);expect(await page.evaluate(()=>submitted)).toEqual(['cat','cat','cat']);
});

test('manual clicks unlock at the displayed cooldown and still wait for chat confirmation',async({page},info)=>{
  await setup(page);await page.clock.install();const cat=page.locator('#sag-candidate-top').getByRole('button',{name:'cat',exact:true});
  await cat.click();expect(await page.evaluate(()=>submitted)).toEqual(['cat']);await page.evaluate(()=>appendChat("Spam detected! You're sending messages too quickly."));await expect(cat).toBeEnabled();
  await page.clock.runFor(3100);await expect(page.locator('#sag-cooldown')).toHaveText('1s');await cat.click();expect(await page.evaluate(()=>submitted)).toEqual(['cat']);await expect(page.locator('#sag-status')).toContainText('1s remaining');
  await page.clock.runFor(1000);await expect(page.locator('#sag-cooldown')).toHaveText('0s');await cat.click();expect(await page.evaluate(()=>submitted)).toEqual(['cat','cat']);
  await page.locator('#sag-candidate-top').getByRole('button',{name:'dog',exact:true}).click();expect(await page.evaluate(()=>submitted)).toEqual(['cat','cat']);expect((await snapshot(page)).sentThisRound).toEqual([]);
  await page.evaluate(()=>appendChat('cat','bugatti'));await expect(page.locator('#sag-last-guess')).toHaveText('cat');expect((await snapshot(page)).sentThisRound).toEqual(['cat']);expect((await snapshot(page)).running).toBe(false);
  await page.locator('#skribbl-auto-guesser-panel').screenshot({path:info.outputPath('manual-after-cooldown.png')});
});

test('Stop after repeated spam preserves manual candidates and clicks work after cooldown without Start',async({page},info)=>{
  await setup(page);await page.clock.install();const cat=page.locator('#sag-candidate-top').getByRole('button',{name:'cat',exact:true});
  await page.locator('#sag-search-input').fill('ca');
  await cat.click();await page.evaluate(()=>appendChat("Spam detected! You're sending messages too quickly."));await page.clock.runFor(4100);await cat.click();
  await page.evaluate(()=>appendChat("Spam detected! You're sending messages too quickly."));expect((await snapshot(page)).spamDetectedCount).toBe(2);await page.locator('#sag-stop').click();await expect(cat).toBeVisible();await expect(cat).toBeEnabled();
  await expect(page.locator('#sag-candidate-top').getByRole('button',{name:'dog',exact:true})).toHaveCount(0);
  await page.clock.runFor(8100);await expect(page.locator('#sag-cooldown')).toHaveText('0s');expect((await snapshot(page)).spamDetectedCount).toBe(2);expect(await page.evaluate(()=>submitted)).toEqual(['cat','cat']);
  await cat.click();expect(await page.evaluate(()=>submitted)).toEqual(['cat','cat','cat']);expect((await snapshot(page)).pendingGuess).toBe('cat');
  await page.evaluate(()=>appendChat('cat','bugatti'));await expect(page.locator('#sag-last-guess')).toHaveText('cat');await page.clock.runFor(14000);expect(await page.evaluate(()=>submitted)).toEqual(['cat','cat','cat']);expect((await snapshot(page)).running).toBe(false);
  await page.locator('#skribbl-auto-guesser-panel').screenshot({path:info.outputPath('stopped-manual-retry.png')});
});

test('search Enter and number shortcuts keep working manually after the repeated-spam pause',async({page})=>{
  await setup(page,{hint:'___ ___'});await page.clock.install();const search=page.locator('#sag-search-input');await search.fill('red fox');
  for(const wait of [4100,8100,12100]){await search.press('Enter');await page.evaluate(()=>appendChat("Spam detected! You're sending messages too quickly."));await page.locator('#sag-stop').click();await page.clock.runFor(wait);}
  await expect(page.locator('#sag-candidate-top').getByRole('button',{name:'red fox',exact:true})).toBeEnabled();await search.press('1');expect(await page.evaluate(()=>submitted)).toEqual(['red fox','red fox','red fox','red fox']);
  await page.evaluate(()=>appendChat('red fox','bugatti'));await expect(page.locator('#sag-last-guess')).toHaveText('red fox');expect((await snapshot(page)).sentThisRound).toEqual(['red fox']);
});

test('the automatic retry cap does not permanently disable an explicit manual retry',async({page})=>{
  await setup(page);await page.clock.install();const cat=page.locator('#sag-candidate-top').getByRole('button',{name:'cat',exact:true});
  for(let i=0;i<5;i++){await cat.click();await page.clock.runFor(3800);expect((await snapshot(page)).pendingGuess).toBeNull();}
  expect(await page.evaluate(()=>submitted.length)).toBe(5);await cat.click();expect(await page.evaluate(()=>submitted.length)).toBe(6);expect((await snapshot(page)).sentThisRound).toEqual([]);
  await page.evaluate(()=>appendChat('cat','bugatti'));await expect(page.locator('#sag-last-guess')).toHaveText('cat');
});

test('old spam recovery cannot erase the newer wait from an unconfirmed manual attempt',async({page})=>{
  await setup(page);await page.clock.install();const cat=page.locator('#sag-candidate-top').getByRole('button',{name:'cat',exact:true});
  await cat.click();await page.evaluate(()=>appendChat("Spam detected! You're sending messages too quickly."));await page.clock.runFor(6300);await cat.click();
  await page.clock.runFor(2900);expect((await snapshot(page)).spamDetectedCount).toBe(0);await expect(page.locator('#sag-cooldown')).toHaveText('1s');
  await cat.click();expect(await page.evaluate(()=>submitted)).toEqual(['cat','cat']);await page.clock.runFor(900);await cat.click();expect(await page.evaluate(()=>submitted)).toEqual(['cat','cat','cat']);
  await page.evaluate(()=>appendChat('cat','bugatti'));await expect(page.locator('#sag-last-guess')).toHaveText('cat');expect((await snapshot(page)).running).toBe(false);
});
