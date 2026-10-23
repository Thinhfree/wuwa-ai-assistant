/* WuWa v2.0.1 — network first for code, offline shell fallback. */
const CACHE='wuwa-ai-shell-v2.0.1';
const APP_FILES=['./','./index.html','./styles.css','./app.js','./logic.mjs','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(APP_FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('wuwa-ai-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    try {const r=await fetch(event.request,{cache:'no-store'});
      if(r.ok)cache.put(event.request,r.clone()).catch(()=>{});
      return r;
    } catch {return (await cache.match(event.request))||Response.error();}
  })());
});
