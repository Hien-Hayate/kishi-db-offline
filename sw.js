const VERSION='banjo-kishi-shell-stage19-4-v1';
const SHELL=['./','./index.html','./style.css','./core.js','./app.js','./manifest.webmanifest','./icon.svg','./icon-192.png','./icon-512.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(VERSION).then(cache=>cache.addAll(SHELL.map(path=>new Request(new URL(path,self.registration.scope),{cache:'reload'}))))));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  for(const name of await caches.keys())if(name.startsWith('banjo-kishi-shell-')&&name!==VERSION)await caches.delete(name);
  await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
  const u=new URL(event.request.url);
  if(event.request.method!=='GET'||u.origin!==self.location.origin||!u.href.startsWith(self.registration.scope))return;
  event.respondWith((async()=>{const cache=await caches.open(VERSION),hit=await cache.match(event.request,{ignoreSearch:true});if(hit)return hit;
    if(event.request.mode==='navigate')return cache.match('./index.html');return fetch(event.request);
  })());
});
self.addEventListener('message',event=>{if(event.data==='CHECK_SHELL')event.waitUntil((async()=>{
  const cache=await caches.open(VERSION),ready=(await Promise.all(SHELL.map(p=>cache.match(p)))).every(Boolean);
  event.ports[0]?.postMessage({ready,version:VERSION});
})());});
