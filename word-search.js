/* Local lexical/category matching plus optional pretrained semantic scores. */
(function(root) {
  'use strict';
  const normalize = value => String(value || '').normalize('NFKC').toLowerCase().trim().replace(/\s+/g, ' ');
  const irregular = { fishes:'fish', fish:'fish', mice:'mouse', geese:'goose', children:'child', people:'person', men:'man', women:'woman', teeth:'tooth', feet:'foot', knives:'knife', wolves:'wolf', leaves:'leaf', sheep:'sheep', cookies:'cookie', brownies:'brownie', movies:'movie', pies:'pie', ties:'tie', zombies:'zombie', buses:'bus', potatoes:'potato', tomatoes:'tomato', heroes:'hero', mantises:'mantis', lice:'louse', antennae:'antenna', larvae:'larva', calves:'calf', hooves:'hoof', rhinoceroses:'rhinoceros' };
  function singular(value) {
    return normalize(value).split(' ').map(word => irregular[word] || (/ies$/.test(word) && word.length>4 ? word.slice(0,-3)+'y' : /(?:ches|shes|xes|zes|sses)$/.test(word) ? word.slice(0,-2) : /s$/.test(word) && !/(?:ss|us|is)$/.test(word) && word.length>3 ? word.slice(0,-1) : word)).join(' ');
  }
  // Human-authored relationships, not model output. Whole terms only: no "cat" in "cathedral".
  const definitions = [
    ['Colors','color|colors|colour|colours|hue|hues','red|orange|yellow|green|blue|purple|pink|brown|black|white|gray|grey|cyan|magenta|violet|indigo|turquoise|beige|maroon|gold|silver|bronze|teal|navy|lavender|peach'],
    ['Food','food|foods|meal|meals|snack|snacks|edible','apple|apricot|avocado|bacon|bagel|baguette|banana|barbecue|bean|beef|beet|berry|biscuit|bread|broccoli|brownie|burger|burrito|butter|cabbage|cake|candy|carrot|cashew|cauliflower|celery|cereal|cheese|cherry|chicken|chili|chocolate|coconut|cookie|corn|cotton candy|crab|cracker|croissant|cucumber|cupcake|curry|donut|doughnut|dumpling|egg|eggplant|fish|flour|french fries|fried chicken|garlic|ginger|grape|grapefruit|ham|hamburger|honey|hot dog|ice cream|jam|jelly|kebab|ketchup|kiwi|lasagna|lemon|lettuce|lime|lobster|mango|marshmallow|meat|meatball|melon|milk|muffin|mushroom|mustard|nachos|noodle|nut|olive|omelette|onion|orange|pancake|pasta|peach|peanut|pear|pea|pepper|pie|pineapple|pizza|plum|popcorn|pork|potato|pretzel|pumpkin|radish|raspberry|rice|salad|salmon|salt|sandwich|sausage|seafood|shrimp|soup|spaghetti|spinach|steak|strawberry|sugar|sushi|taco|toast|tomato|tuna|turkey|waffle|watermelon|yogurt|zucchini'],
    ['Fruit','fruit|fruits','apple|apricot|avocado|banana|berry|cherry|coconut|grape|grapefruit|kiwi|lemon|lime|mango|melon|orange|peach|pear|pineapple|plum|raspberry|strawberry|watermelon'],
    ['Vegetables','vegetable|vegetables|veggies','bean|beet|broccoli|cabbage|carrot|cauliflower|celery|corn|cucumber|eggplant|garlic|lettuce|mushroom|onion|pea|pepper|potato|pumpkin|radish|spinach|tomato|zucchini'],
    ['Animals','animal|animals|creature|creatures|wildlife','alligator|ant|ape|bat|bear|bee|bird|buffalo|butterfly|camel|cat|caterpillar|chicken|chimpanzee|cobra|cow|crab|crocodile|deer|dinosaur|dog|dolphin|donkey|duck|eagle|eel|elephant|fish|flamingo|fox|frog|giraffe|goat|goose|gorilla|hamster|hedgehog|hippo|hippopotamus|horse|jellyfish|kangaroo|kitten|koala|ladybug|lamb|leopard|lion|lizard|lobster|monkey|mosquito|mouse|octopus|otter|owl|panda|parrot|peacock|pelican|penguin|pig|pigeon|polar bear|puppy|rabbit|raccoon|rat|rhinoceros|scorpion|seahorse|seal|shark|sheep|shrimp|sloth|snail|snake|spider|squid|squirrel|starfish|swan|tiger|turtle|walrus|whale|wolf|worm|zebra'],
    ['Ocean life','ocean|sea|marine|ocean life|sea life|marine life|sea animal|sea animals','fish|dolphin|whale|shark|seal|walrus|octopus|squid|jellyfish|starfish|seahorse|crab|lobster|shrimp|eel|tuna|salmon|cod|trout|stingray|manta ray|clam|oyster|coral|seaweed|turtle'],
    ['Fish','fish|fishes','fish|shark|salmon|tuna|trout|cod|eel|seahorse|stingray|manta ray|goldfish|piranha|swordfish|clownfish|blowfish'],
    ['Vehicles','vehicle|vehicles|transport|transportation','airplane|plane|jet|car|bus|truck|train|bicycle|bike|motorcycle|helicopter|boat|ship|submarine|rocket|spaceship|tractor|ambulance|fire truck|police car|taxi|scooter|skateboard|sailboat|canoe|kayak|van|limousine|tank|race car|hot air balloon|unicycle|wheelchair'],
    ['Clothing','clothing|clothes|outfit|wear','shirt|t shirt|t-shirt|pants|trousers|jeans|dress|skirt|coat|jacket|sock|shoe|boot|hat|cap|scarf|glove|mitten|sweater|hoodie|tie|bow tie|belt|suit|tuxedo|bikini|swimsuit|pajamas|helmet|sandal|sneaker|underwear|bra|apron|vest'],
    ['Occupations','job|jobs|occupation|occupations|profession|professions','doctor|nurse|teacher|firefighter|policeman|police officer|mailman|postman|chef|cook|baker|farmer|pilot|astronaut|scientist|engineer|mechanic|plumber|electrician|carpenter|painter|artist|singer|actor|dentist|vet|veterinarian|lawyer|judge|soldier|waiter|waitress|butcher|barber|hairdresser|librarian|cashier|construction worker|builder'],
    ['Sports','sport|sports|athletics','soccer|football|basketball|baseball|tennis|volleyball|golf|hockey|ice hockey|rugby|cricket|badminton|bowling|boxing|wrestling|swimming|diving|surfing|skiing|snowboarding|skating|ice skating|running|cycling|gymnastics|archery|fencing|karate|judo|table tennis|ping pong|chess'],
    ['Household objects','household|household objects|furniture|home items','chair|table|desk|bed|sofa|couch|lamp|pillow|blanket|carpet|rug|curtain|mirror|shelf|bookshelf|wardrobe|cupboard|cabinet|door|window|toilet|sink|bathtub|shower|fridge|refrigerator|oven|stove|microwave|toaster|vacuum cleaner|washing machine|dishwasher|broom|mop|bucket|plate|bowl|cup|mug|fork|spoon|knife|clock'],
    ['Places','place|places|location|locations|building|buildings','school|hospital|library|restaurant|cinema|theater|museum|church|castle|palace|house|hotel|airport|station|train station|police station|fire station|post office|supermarket|bakery|bank|prison|zoo|park|playground|beach|desert|forest|jungle|mountain|island|city|town|village|farm|factory|office|stadium|bridge'],
    ['Nature','nature|landscape|scenery|outdoors','tree|flower|grass|bush|leaf|forest|jungle|mountain|hill|river|lake|ocean|sea|beach|island|desert|cactus|volcano|waterfall|cave|rock|stone|sand|snow|ice|rain|rainbow|cloud|sun|moon|star|lightning|tornado|hurricane|sunset|sunrise|valley|pond|mushroom'],
    ['Tools','tool|tools|equipment','hammer|screwdriver|wrench|spanner|pliers|drill|saw|chainsaw|axe|shovel|spade|rake|hoe|pickaxe|scissors|knife|chisel|tape measure|ruler|level|ladder|nail|screw|paintbrush|paint roller|wheelbarrow|toolbox|clamp'],
    ['Technology','technology|tech|electronics|electronic','computer|laptop|keyboard|mouse|monitor|screen|phone|smartphone|tablet|television|tv|radio|camera|printer|speaker|headphones|earphones|microphone|robot|drone|satellite|internet|wifi|wi-fi|usb|charger|battery|circuit|microchip|calculator|console|controller']
  ];
  const categories = definitions.map(([name,aliases,words]) => ({name, aliases:new Set(aliases.split('|').map(singular)), words:new Set(words.split('|').map(singular))}));
  const animalCategory=categories.find(c=>c.name==='Animals');
  // Specific families also feed the broad animal category, so adding a species
  // never requires maintaining two separate lists. These work without the model.
  const animalFamilies = [
    ['Mammals','mammal|mammals','aardvark|alpaca|anteater|antelope|ape|armadillo|baboon|badger|bat|bear|beaver|bison|boar|buffalo|bull|calf|camel|capybara|cat|cheetah|chihuahua|chimpanzee|chinchilla|cow|coyote|deer|dog|dolphin|donkey|elephant|elk|ferret|fox|gazelle|gerbil|giraffe|goat|gorilla|grizzly bear|guinea pig|hamster|hare|hedgehog|hippo|hippopotamus|horse|hyena|jaguar|kangaroo|killer whale|kitten|koala|lamb|lemur|leopard|lion|llama|lynx|manatee|meerkat|mole|mongoose|monkey|moose|mouse|mule|narwhal|ocelot|opossum|orangutan|otter|ox|panda|panther|pig|platypus|polar bear|porcupine|possum|pug|puma|puppy|rabbit|raccoon|rat|red panda|reindeer|rhino|rhinoceros|seal|sheep|skunk|sloth|squirrel|tiger|walrus|warthog|weasel|whale|wild boar|wildebeest|wolf|wombat|yak|zebra'],
    ['Insects','insect|insects|bug|bugs','ant|aphid|bee|beetle|bumblebee|butterfly|caterpillar|cicada|cockroach|cricket|dragonfly|earwig|fire ant|firefly|flea|fly|fruit fly|grasshopper|hornet|ladybird|ladybug|larva|locust|louse|mantis|moth|mosquito|praying mantis|silkworm|stag beetle|stick insect|termite|wasp|weevil'],
    ['Birds','bird|birds','albatross|bird|blackbird|blue jay|budgie|canary|cardinal|cassowary|chicken|cockatoo|crow|dodo|dove|duck|duckling|eagle|emu|falcon|flamingo|goose|hawk|hen|heron|hummingbird|kingfisher|kiwi|magpie|ostrich|owl|parakeet|parrot|peacock|pelican|penguin|pheasant|phoenix|pigeon|puffin|quail|raven|robin|rooster|seagull|sparrow|stork|swan|toucan|turkey|vulture|woodpecker'],
    ['Reptiles','reptile|reptiles','alligator|boa|chameleon|cobra|crocodile|gecko|iguana|komodo dragon|lizard|python|rattlesnake|sea turtle|snake|tortoise|turtle|viper'],
    ['Amphibians','amphibian|amphibians','axolotl|frog|newt|salamander|tadpole|toad'],
    ['Arachnids','arachnid|arachnids','black widow|scorpion|spider|tarantula|tick']
  ].map(([name,aliases,words])=>({name,aliases:new Set(aliases.split('|').map(singular)),words:new Set(words.split('|').map(singular))}));
  categories.push(...animalFamilies);
  for(const family of [...animalFamilies,...categories.filter(c=>['Ocean life','Fish'].includes(c.name))])for(const word of family.words){
    if(!['coral','seaweed'].includes(word))animalCategory.words.add(word);
  }
  const associatedDefinitions = {
    Animals: 'animal|antler|aquarium|beak|burrow|cage|claw|collar|fang|feather|fin|fur|gill|hoof|horn|kennel|leash|mane|nest|paw|pet|pet shop|pet store|safari|scale|shell|snout|stable|tail|talon|tentacle|trunk|tusk|udder|vet|veterinarian|web|whisker|wing|zoo|bear trap|bird cage|bird feeder|dog house|fish tank|mouse trap|mousetrap',
    Insects: 'antenna|anthill|beehive|bug net|cocoon|hive|honey|honeycomb|insect|insecticide|pollen|stinger|wing',
    Birds: 'beak|bird cage|bird feeder|birdhouse|egg|feather|nest|talon|wing',
    Fish: 'aquarium|bait|fin|fish tank|fishing rod|gill|hook|scale',
    Arachnids: 'cobweb|fang|silk|spider web|web'
  };
  const associated = new Map(Object.entries(associatedDefinitions).map(([name,words])=>[name,new Set(words.split('|').map(singular))]));
  for(const family of animalFamilies)for(const word of associated.get(family.name)||[])associated.get('Animals').add(word);
  // Space/hyphen-delimited phrase components only: bear trap relates to animals,
  // but arbitrary fragments such as "cat" in "cathedral" do not.
  function phraseMembers(word, members) {
    const parts=word.split(/[\s-]+/), found=new Set();
    if(parts.length<2)return [];
    for(let start=0;start<parts.length;start++)for(let end=start+1;end<=parts.length;end++){
      const term=parts.slice(start,end).join(' ');
      if(members.has(term))found.add(term);
    }
    return [...found];
  }
  const colorCategory=categories[0];
  const compoundHeads=new Set('berry|bird|board|bull|coat|eye|fish|head|heart|hole|house|light|neck|nose|pepper|print|rose|shirt|shoe|smith|star|stone|tail|tea|water|whale|wine|wood'.split('|'));
  function colorTerms(word) {
    const terms=new Set(normalize(word).split(/[\s-]+/).filter(term=>colorCategory.words.has(term)));
    // Restrict joined-word splitting to recognizable noun heads. "Redemption"
    // and "prediction" must not acquire a red/color relationship by accident.
    for(const color of colorCategory.words)if(word.startsWith(color) && compoundHeads.has(word.slice(color.length)))terms.add(color);
    return [...terms];
  }
  function spelling(a,b) {
    if(a===b)return 1;
    const length=Math.max(a.length,b.length);
    if(!length || Math.abs(a.length-b.length)>length*.4)return 0;
    let prev=Array.from({length:b.length+1},(_,i)=>i);
    for(let i=1;i<=a.length;i++){
      const row=[i];for(let j=1;j<=b.length;j++)row[j]=Math.min(row[j-1]+1,prev[j]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));prev=row;
    }
    return 1-prev[b.length]/length;
  }
  const alphabetic = (a,b) => a.word.localeCompare(b.word, 'en', {sensitivity:'base'}) || a.word.localeCompare(b.word);
  function rank(query, candidates, {related=false, closestFirst=true, semantic=[]}={}) {
    const q=normalize(query), stem=singular(q), scores=new Map(semantic.filter(s=>s && typeof s.word==='string' && Number.isFinite(s.score)).map(s=>[normalize(s.word),s.score]));
    if(!q)return candidates.map(word=>({word,score:0,reason:''}));
    if(!related){const matches=candidates.filter(word=>normalize(word).includes(q)).map(word=>({word,score:0,reason:''}));return closestFirst?matches:matches.sort(alphabetic);}
    const memberships=related?categories.filter(c=>c.aliases.has(stem)||c.words.has(stem)):[];
    const smallest=Math.min(...memberships.map(c=>c.words.size));
    // Prefer the specific family: fish -> marine life, rather than every animal/food.
    const queryCategories=memberships.filter(c=>c.aliases.has(stem)||c.words.size<=smallest*3);
    const result=[];
    for(const word of candidates){
      const w=normalize(word), ws=singular(w);
      let match=null;
      const offer=(score,reason,strong=false,semantic=null)=>{if(!match || score>match.score)match={word,score,reason,strong,semantic};};
      if(w===q)offer(1,'Exact match',true);
      if(w.includes(q))offer(w.startsWith(q)?.92:.88,w.startsWith(q)?'Starts with your search':'Contains your search');
      if(related){
        if(stem===ws && w!==q)offer(.99,'Singular/plural match',true);
        if(q.length>=4){const similarity=spelling(q,w);if(similarity>=.6)offer(similarity>=.8?.96+(similarity-.8)*.1:.55+similarity*.2,Math.round(similarity*100)+'% spelling similarity',similarity>=.8);}
        for(const c of queryCategories)if(c.words.has(ws)){
          const direct=c.aliases.has(stem);offer(direct?.98:.74+.04/(1+c.words.size/20),(direct?c.name+' category':'Related through '+c.name.toLowerCase()),direct);
        }
        for(const c of queryCategories){
          if(c===colorCategory)continue; // Color compounds have their own guarded splitter.
          if(associated.get(c.name)?.has(ws))offer(.78,'Associated with '+c.name.toLowerCase()+' (part or related item)');
          if(!c.words.has(ws)){
            const terms=phraseMembers(ws,c.words);
            if(terms.length)offer(.82,'Contains '+c.name.toLowerCase()+' term: '+terms.join(', '));
          }
        }
        if(queryCategories.includes(colorCategory)){
          const colors=colorTerms(ws).filter(color=>colorCategory.aliases.has(stem)||color===stem);
          if(colors.length && !colorCategory.words.has(ws))offer(.82,'Contains color term: '+colors.join(', '));
        }
        const cosine=scores.get(w);
        const categoryConflict=queryCategories.some(c=>c.aliases.has(stem)) && !queryCategories.some(c=>c.words.has(ws)) && categories.some(c=>c.words.has(ws));
        if(cosine>=(categoryConflict?.55:.4))offer(.4+Math.min(1,(cosine-.4)/.6)*.47,'Related meaning (local AI)',cosine>=.8,cosine);
      }
      if(match)result.push(match);
    }
    return result.sort(closestFirst?(a,b)=>b.score-a.score||alphabetic(a,b):alphabetic);
  }
  function indicator(match) {
    const hue=match.strong?120:Number.isFinite(match.semantic)?Math.max(0,Math.min(120,(match.semantic-.4)/.3*120)):Math.max(0,Math.min(100,(match.score-.4)/.54*100));
    return {border:`hsl(${hue} 65% 37%)`,background:`hsl(${hue} 60% 96%)`};
  }
  class Controller {
    constructor({request,onUpdate=()=>{},delay=200,maxCache=32}={}){this.request=request;this.onUpdate=onUpdate;this.delay=delay;this.maxCache=maxCache;this.cache=new Map();this.key='';this.token=0;this.status='';this.active=null;this.timer=null;}
    cancel(){clearTimeout(this.timer);this.timer=null;this.active?.abort();this.active=null;this.token++;}
    reset(){this.cancel();this.key='';this.status='';}
    search(query,candidates,options={}){
      const q=normalize(query), semantic=options.related && q.length>=2 && candidates.length;
      const key=JSON.stringify([options.context||'',!!options.related,q,candidates]);
      if(key!==this.key){
        this.cancel();this.key=key;this.status='';
        const cacheKey=JSON.stringify([q,candidates.map(normalize)]);
        this.scores=semantic?this.cache.get(cacheKey):null;
        if(semantic && !this.scores){
          this.status='Loading AI matches…';const token=this.token;
          this.timer=setTimeout(async()=>{
            this.timer=null;const controller=new AbortController();this.active=controller;
            try{
              const response=await this.request(q,candidates,controller.signal);
              if(token!==this.token || controller.signal.aborted)return;
              if(!Array.isArray(response.matches))throw new Error('Invalid word-search response');
              const eligible=new Set(candidates.map(normalize));
              this.scores=response.matches.filter(s=>s && typeof s.word==='string' && eligible.has(normalize(s.word)) && Number.isFinite(s.score));
              this.cache.set(cacheKey,this.scores);if(this.cache.size>this.maxCache)this.cache.delete(this.cache.keys().next().value);
              this.status='Local AI ready';
            }catch(error){if(token!==this.token || controller.signal.aborted)return;this.status='AI unavailable—showing text/category matches. '+error.message;}
            finally{if(token===this.token){this.active=null;this.onUpdate();}}
          },this.delay);
        }else if(semantic)this.status='Local AI ready · cached';
      }
      return rank(q,candidates,{...options,semantic:this.scores||[]});
    }
  }
  async function runtimeRequest(runtime,action,data,signal,{timeout=35000}={}){
    const disconnected=error=>/message channel closed|message port closed|receiving end does not exist|could not establish connection/i.test(error.message);
    for(let attempt=0;attempt<2;attempt++){
      signal.throwIfAborted();
      const id=crypto.randomUUID();
      const cancel=()=>{try{runtime.sendMessage({action:'aiCancel',id}).catch(()=>{});}catch{}};
      let timer,rejectWait;
      const stopped=new Promise((_,reject)=>rejectWait=reject);
      const abort=()=>{cancel();rejectWait(signal.reason);};
      signal.addEventListener('abort',abort,{once:true});
      timer=setTimeout(()=>{cancel();rejectWait(Error('Local AI request timed out. Try searching again.'));},timeout);
      try{
        const response=await Promise.race([runtime.sendMessage({action,id,...data}),stopped]);signal.throwIfAborted();
        if(!response)throw Error('AI message channel closed');
        if(!response.ok)throw Object.assign(Error(response.error||'Local AI did not respond'),{code:response.code});
        return response;
      }catch(error){
        signal.throwIfAborted();
        if(/extension context invalidated/i.test(error.message))throw Error('Refresh the Skribbl tab to reconnect the extension.');
        if(!disconnected(error))throw error;
        cancel();
        if(attempt)throw Object.assign(Error('AI connection was interrupted. Try searching again.'),{code:'AI_CONNECTION_LOST'});
      }finally{clearTimeout(timer);signal.removeEventListener('abort',abort);}
    }
  }
  const api={normalize,singular,spelling,rank,indicator,Controller,runtimeRequest};
  if(typeof module==='object' && module.exports)module.exports=api;
  root.SAGWordSearch=api;
})(typeof globalThis==='object'?globalThis:this);
