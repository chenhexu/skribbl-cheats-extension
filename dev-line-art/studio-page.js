'use strict';
const studio = SAGDrawerStudio.mount(document.getElementById('studio'));
if (globalThis.chrome?.runtime?.id) {
  const id = new URLSearchParams(location.search).get('session');
  if (id) SAGDrawerStudio.send({action:'studioSession',id}).then(r=>studio.loadSession(r.session)).catch(e=>{document.querySelector('.footer').textContent=e.message;});
}
