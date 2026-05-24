/* ============================================================
 * CareerHub Service Worker
 * 部署：把这个文件和 careerhub_v1.html 放在同一目录、同一域名下
 * 注意：必须通过 https 或 http://localhost 才能注册成功
 * ============================================================ */

const CACHE = 'careerhub-v1.1';

// 安装阶段：跳过等待
self.addEventListener('install', () => {
  self.skipWaiting();
});

// 激活阶段：清理旧缓存
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

/**
 * Fetch 拦截策略：
 *  - 跳过：API 类（CloudBase / Server酱 / /api/）— 永远走网络
 *  - HTML（导航）：network-first，离线回退 cache
 *  - CDN 第三方库（jsdelivr 等）：cache-first，命中即用
 *  - 同源静态资源：stale-while-revalidate
 *  - 其他：放行
 */
const CDN_HOSTS = new Set([
  'cdn.jsdelivr.net',
  'unpkg.com',
  'cdnjs.cloudflare.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
]);

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch { return; }

  // 跳过 API（不缓存）
  if (
    url.hostname.includes('tcb-api') ||
    url.hostname.includes('cloudbase') ||
    url.hostname.includes('sctapi.ftqq.com') ||
    url.pathname.startsWith('/api/')
  ) {
    return;
  }

  // HTML 导航：network-first
  if (req.mode === 'navigate' || req.destination === 'document') {
    event.respondWith(networkFirst(req));
    return;
  }

  // CDN：cache-first
  if (CDN_HOSTS.has(url.hostname)) {
    event.respondWith(cacheFirst(req));
    return;
  }

  // 同源静态：stale-while-revalidate
  if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(req));
  }
});

async function networkFirst(req) {
  try {
    const fresh = await fetch(req);
    const cache = await caches.open(CACHE);
    cache.put(req, fresh.clone());
    return fresh;
  } catch {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req);
    return cached || new Response(
      '<html><body style="font-family:system-ui;padding:40px;text-align:center"><h1>📡 离线模式</h1><p>请检查网络后重试</p></body></html>',
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(req);
  if (cached) return cached;
  try {
    const fresh = await fetch(req);
    if (fresh.ok) cache.put(req, fresh.clone());
    return fresh;
  } catch (e) {
    return cached || Response.error();
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(req);
  const network = fetch(req).then(r => {
    if (r && r.ok) cache.put(req, r.clone());
    return r;
  }).catch(() => cached);
  return cached || network;
}

// 收到客户端 "SKIP_WAITING" 消息时立即激活（用于"有新版本，立即刷新"）
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});
