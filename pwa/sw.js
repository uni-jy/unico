// M1 占位 service worker — 仅注册，不缓存。M2 起加壳层缓存与 prefetch。
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => { /* passthrough */ });
