// Representative shaded wheel: large colored wedges plus metallic highlights.
// This is a generated test fixture, not the user's uploaded screenshot.
const wedgeColors=['#ffe400','#00cc00','#00b2ff','#a300ba','#df69a7'];
const wedges=Array.from({length:10},(_,i)=>{
  const start=(i*36-108)*Math.PI/180,end=start+Math.PI/5;
  const point=a=>[256+183*Math.cos(a),256+183*Math.sin(a)].join(' ');
  return `<path d="M256 256L${point(start)}A183 183 0 0 1 ${point(end)}Z" fill="url(#wedge${i%5})"/>`;
}).join('');
const wheel=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
<defs>
${wedgeColors.map((color,i)=>`<radialGradient id="wedge${i}"><stop stop-color="${color}"/><stop offset=".85" stop-color="${color}"/><stop offset="1" stop-color="${color}" stop-opacity=".8"/></radialGradient>`).join('')}
<linearGradient id="gold" x2=".3" y2="1"><stop stop-color="#ffe400"/><stop offset=".3" stop-color="#ff7100"/><stop offset=".5" stop-color="#ffe400"/><stop offset=".75" stop-color="#cc774d"/><stop offset="1" stop-color="#e8a200"/></linearGradient>
<radialGradient id="button"><stop stop-color="#c23800"/><stop offset="1" stop-color="#740b07"/></radialGradient>
</defs>
<rect width="512" height="512" rx="55" fill="#00569e"/>
<circle cx="256" cy="256" r="214" fill="url(#gold)" stroke="#63300d" stroke-width="4"/>
<circle cx="256" cy="256" r="191" fill="#740b07"/>
${wedges}
<circle cx="256" cy="256" r="96" fill="url(#gold)"/>
<circle cx="256" cy="256" r="78" fill="url(#button)" stroke="#63300d" stroke-width="4"/>
<path d="M229 240H210V254H229V270H210M242 272V240H260V254H242M270 240V272M282 272V240L302 272V240" fill="none" stroke="#ffe400" stroke-width="7"/>
${Array.from({length:12},(_,i)=>{const a=i*Math.PI/6;return `<circle cx="${256+203*Math.cos(a)}" cy="${256+203*Math.sin(a)}" r="7" fill="#fff"/>`;}).join('')}
</svg>`);
module.exports={wheel,wedgeColors};
