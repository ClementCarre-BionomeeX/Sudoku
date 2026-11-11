import os, re
src = open('sudoku.html').read()
out = '/mnt/project-files/sudoku/app/'
os.makedirs(out, exist_ok=True)

title_end = src.index('</title>') + len('</title>')
title, rest = src[:title_end], src[title_end:]
head_extra = '''
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#5b3fd1">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Sudoku">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icon-192.png">
<link rel="apple-touch-icon" href="icon-180.png">
<style>
:root { padding-top: env(safe-area-inset-top, 0px); padding-bottom: env(safe-area-inset-bottom, 0px); }
html, body { margin: 0; } [hidden] { display: none !important; }
</style>
'''
sw_reg = '''
<script>
if ('serviceWorker' in navigator) window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
</script>
'''
# split head-ish part (title, metas, links, style) from body markup at the first <div class="wrap">
i = rest.index('<div class="wrap">')
head_part, body_part = rest[:i], rest[i:]
html = '<!doctype html>\n<html lang="fr">\n<head>\n' + title + head_extra + head_part + '</head>\n<body>\n' + body_part + sw_reg + '</body>\n</html>\n'
open(out + 'index.html', 'w').write(html)

open(out + 'manifest.webmanifest', 'w').write('''{
  "name": "Sudoku d'entraînement",
  "short_name": "Sudoku",
  "lang": "fr",
  "start_url": "./",
  "scope": "./",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#f3f4f8",
  "theme_color": "#5b3fd1",
  "icons": [
    { "src": "icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
''')

open(out + 'sw.js', 'w').write('''/* Service worker : met l'appli en cache pour qu'elle marche sans réseau. Change VERSION à chaque mise à jour. */
var VERSION = 'sudoku-v5';
var CORE = ['./', 'index.html', 'manifest.webmanifest', 'icon-180.png', 'icon-192.png', 'icon-512.png'];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(CORE); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(function (hit) {
    var net = fetch(e.request).then(function (res) {
      if (res && (res.ok || res.type === 'opaque')) { var copy = res.clone(); caches.open(VERSION).then(function (c) { c.put(e.request, copy); }); }
      return res;
    }).catch(function () { return hit; });
    return hit || net;
  }));
});
''')
print('ok', len(html))
