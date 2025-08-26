// capture-m3u8.js
const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const targetUrl = process.env.TARGET_URL || process.argv[2];
  if (!targetUrl) {
    console.error("\x1b[31mNo URL provided. Exiting script.\x1b[0m");
    process.exit(1);
  }

  console.log("\x1b[36m🌀 Starting Playwright...\x1b[0m");

  const browser = await chromium.launch({
    headless: true,
    args: ['--autoplay-policy=no-user-gesture-required']
  });

  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    userAgent:
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) ' +
      'Chrome/120.0.0.0 Safari/537.36'
  });

  const page = await context.newPage();

  // Helper to record (de-dupe) and immediately persist
  const found = new Set();
  function persistAndExit(url) {
    if (!url) return;
    if (!/\.m3u8(\?|#|$)/i.test(url)) return;
    if (found.has(url)) return;
    found.add(url);
    console.log("\x1b[32mFound .m3u8 URL:\x1b[0m", url);
    try { fs.writeFileSync('playwright_output.txt', Array.from(found).join('\n')); } catch (e) {}
    // exit quickly
    setImmediate(async () => {
      try { await context.close(); } catch {}
      try { await browser.close(); } catch {}
      process.exit(0);
    });
  }

  // Finalizer if nothing found
  let finished = false;
  async function finishNoResult() {
    if (finished) return;
    finished = true;
    console.log("\x1b[33m⚠️ No .m3u8 URL found.\x1b[0m");
    try { fs.writeFileSync('playwright_output.txt', 'No .m3u8 URL found.'); } catch (e) {}
    try { await context.close(); } catch {}
    try { await browser.close(); } catch {}
    process.exit(1);
  }

  // --- 1) Inject runtime hooks BEFORE any page scripts run (covers iframes too) ---
  await context.addInitScript(() => {
    (function () {
      const emit = (tag, url) => {
        try { console.log(`${tag}:${url}`); } catch (e) {}
      };

      // Hook fetch
      try {
        const _fetch = window.fetch;
        window.fetch = function (...args) {
          try {
            const u = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url);
            if (u && /\.m3u8(\?|#|$)/i.test(u)) emit('M3U8_FETCH', u);
          } catch {}
          return _fetch.apply(this, args);
        };
      } catch (e) {}

      // Hook XHR open
      try {
        const _open = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function (method, url, ...rest) {
          try { if (url && /\.m3u8(\?|#|$)/i.test(url)) emit('M3U8_XHR', url); } catch {}
          return _open.call(this, method, url, ...rest);
        };
      } catch (e) {}

      // Hook media src setter
      try {
        const desc = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'src');
        if (desc && desc.set) {
          Object.defineProperty(HTMLMediaElement.prototype, 'src', {
            set(v) {
              try { if (typeof v === 'string' && /\.m3u8(\?|#|$)/i.test(v)) emit('M3U8_MEDIA_SRC', v); } catch {}
              return desc.set.call(this, v);
            },
            get: desc.get,
            configurable: true
          });
        }
      } catch (e) {}

      // Patch Hls.js when it's defined
      try {
        const patchHls = () => {
          try {
            if (window.Hls && window.Hls.prototype && !window.Hls.__m3u8_patched) {
              const orig = window.Hls.prototype.loadSource;
              window.Hls.prototype.loadSource = function (url) {
                try { if (url && /\.m3u8(\?|#|$)/i.test(url)) emit('M3U8_HLS_LOAD', url); } catch {}
                return orig.apply(this, arguments);
              };
              window.Hls.__m3u8_patched = true;
            }
          } catch (e) {}
        };
        patchHls();
        setInterval(patchHls, 1000);
      } catch (e) {}
    })();
  });

  // --- 2) Listen for console messages emitted by the injected hooks ---
  page.on('console', (msg) => {
    try {
      const txt = msg.text();
      if (!txt) return;
      if (txt.startsWith('M3U8_')) {
        const idx = txt.indexOf(':');
        if (idx > 0) {
          const url = txt.slice(idx + 1).trim();
          persistAndExit(url);
        }
      }
    } catch (e) {}
  });

  // --- 3) Capture requests & request bodies ---
  context.on('request', (request) => {
    try {
      const url = request.url();
      if (url && /\.m3u8(\?|#|$)/i.test(url)) persistAndExit(url);
      const post = request.postData();
      if (post && post.includes('.m3u8')) {
        const matches = post.match(/https?:\/\/[^'"\s>]+\.m3u8[^'"\s>]*/gi) || [];
        matches.forEach(m => persistAndExit(m));
      }
    } catch (e) {}
  });

  // --- 4) Capture responses: url/header/body (careful with size) ---
  context.on('response', async (response) => {
    try {
      const url = response.url();
      if (url && /\.m3u8(\?|#|$)/i.test(url)) { persistAndExit(url); return; }

      const headers = response.headers() || {};
      const ct = (headers['content-type'] || headers['Content-Type'] || '').toLowerCase();
      // If header explicitly indicates HLS-like content
      if (ct && /(mpegurl|application\/x-mpegurl|vnd\.apple\.mpegurl|vnd\.apple\.m3u8)/i.test(ct)) {
        persistAndExit(url);
        return;
      }

      // For JSON / text / HTML / JS responses, read the body and search
      if (/json|text|javascript|xml|html/.test(ct) || url.match(/\.(json|js|html|txt)$/i)) {
        let txt = '';
        try { txt = await response.text(); } catch (e) { txt = ''; }
        if (txt && txt.includes('.m3u8')) {
          const matches = txt.match(/https?:\/\/[^'"\s>]+\.m3u8[^'"\s>]*/gi) || [];
          matches.forEach(m => persistAndExit(m));
        }
      }

      // Check redirect location header
      const location = headers['location'] || headers['Location'];
      if (location && /\.m3u8(\?|#|$)/i.test(location)) persistAndExit(location);
    } catch (e) {}
  });

  // --- 5) WebSocket frames (often used for signaling) ---
  page.on('websocket', ws => {
    try {
      ws.on('framereceived', frame => {
        try {
          const payload = frame.payload;
          if (typeof payload === 'string' && payload.includes('.m3u8')) {
            const matches = payload.match(/https?:\/\/[^'"\s>]+\.m3u8[^'"\s>]*/gi) || [];
            matches.forEach(m => persistAndExit(m));
          }
        } catch (e) {}
      });
    } catch (e) {}
  });

  // --- Navigate quickly, try to trigger the player ---
  console.log("\x1b[34mNavigating to page:\x1b[0m", targetUrl);
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

  // small pause to let page init scripts run
  await page.waitForTimeout(800);

  // Try clicking obvious play buttons (fast)
  const playSelectors = [
    'button[aria-label*="play" i]',
    'button[title*="play" i]',
    '.vjs-big-play-button',
    '.jw-icon-playback',
    '.plyr__control--overlaid',
    'button[class*="play" i]',
  ];
  for (const sel of playSelectors) {
    try {
      const el = await page.$(sel);
      if (el) { await el.click({ force: true }).catch(() => {}); }
    } catch (e) {}
  }

  // Try programmatic play on <video>
  try {
    await page.evaluate(() => {
      try {
        const vids = Array.from(document.querySelectorAll('video'));
        for (const v of vids) {
          try { v.muted = true; v.play().catch(() => {}); } catch {}
        }
      } catch {}
    });
  } catch (e) {}

  // --- 6) DOM scan: video/src, source tags, data-* attributes, inline scripts ---
  try {
    const domUrls = await page.evaluate(() => {
      const urls = new Set();
      const add = (u) => {
        try { if (!u) return; const a = new URL(u, location.href).href; urls.add(a); } catch {}
      };

      // video/src/source
      document.querySelectorAll('video').forEach(v => {
        if (v.src) add(v.src);
        v.querySelectorAll('source').forEach(s => { if (s.src) add(s.src); });
      });
      document.querySelectorAll('source').forEach(s => { if (s.src) add(s.src); });

      // common data attributes
      document.querySelectorAll('[data-src],[data-hls],[data-video],[data-m3u8]').forEach(el => {
        ['data-src','data-hls','data-video','data-m3u8'].forEach(attr => {
          const val = el.getAttribute(attr);
          if (val) add(val);
        });
      });

      // inline scripts (search for absolute .m3u8)
      document.querySelectorAll('script').forEach(s => {
        const t = s.textContent || '';
        if (t && t.includes('.m3u8')) {
          const re = /https?:\/\/[^'"\s>]+\.m3u8[^'"\s>]*/gi;
          let m;
          while ((m = re.exec(t)) !== null) urls.add(m[0]);
        }
      });

      return Array.from(urls);
    });

    if (domUrls && domUrls.length) domUrls.forEach(u => persistAndExit(u));
  } catch (e) {}

  // --- 7) Wait up to ~35s (poll). If nothing found, exit with "No .m3u8" ---
  const MAX_MS = 35000;
  const start = Date.now();
  while (Date.now() - start < MAX_MS) {
    if (found.size > 0) return; // already exited via persistAndExit
    await page.waitForTimeout(250);
  }

  // nothing found in time
  await finishNoResult();
})();
