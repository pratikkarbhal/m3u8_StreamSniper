// scrape-script.js
const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const targetUrl = process.env.TARGET_URL;
  if (!targetUrl) {
    console.error("\x1b[31mNo URL provided. Exiting script.\x1b[0m");
    process.exit(1);
  }

  console.log("\x1b[34mStarting Playwright...\x1b[0m");

  // Launch Chromium; args help autoplay in CI
  const browser = await chromium.launch({
    headless: true,
    args: ['--autoplay-policy=no-user-gesture-required']
  });

  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    userAgent:
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });

  const page = await context.newPage();

  // --- Robust collection & de-dupe ---
  const found = new Set();
  const outputLines = [];

  function record(url) {
    if (!url) return;
    if (!/\.m3u8(\?|#|$)/i.test(url)) return;
    if (found.has(url)) return;
    found.add(url);
    const line = `\x1b[32mFound .m3u8 URL:\x1b[0m ${url}`;
    console.log(line);
    outputLines.push(url);
    // Save immediately & exit fast on first find
    try { fs.writeFileSync('playwright_output.txt', Array.from(found).join('\n')); } catch {}
    finish(0);
  }

  let finished = false;
  async function finish(code) {
    if (finished) return;
    finished = true;
    try {
      if (outputLines.length === 0) {
        console.log("\x1b[33m⚠️ No .m3u8 URL found.\x1b[0m");
        fs.writeFileSync('playwright_output.txt', 'No .m3u8 URL found.');
      }
    } catch {}
    try { await context.close(); } catch {}
    try { await browser.close(); } catch {}
    process.exit(code);
  }

  // --- 1) Network responses across the whole context ---
  context.on('response', async (response) => {
    try {
      const url = response.url();
      record(url);
    } catch {}
  });

  // --- 2) Explicitly route *.m3u8 (catches early) ---
  await context.route('**/*.m3u8*', async (route) => {
    try { record(route.request().url()); } catch {}
    await route.continue();
  });

  // --- 3) Inject hooks BEFORE any page scripts run (covers iframes too) ---
  await context.addInitScript(() => {
    try {
      const emit = (tag, url) => {
        try {
          // Tagged console line; outer script listens and records
          console.log(`${tag}:${url}`);
        } catch {}
      };

      // Hook fetch
      const _fetch = window.fetch;
      window.fetch = async function (...args) {
        const u = (typeof args[0] === 'string') ? args[0] : (args[0] && args[0].url);
        if (u && /\.m3u8(\?|#|$)/i.test(u)) emit('M3U8_FETCH', u);
        return _fetch.apply(this, args);
      };

      // Hook XHR
      const _open = XMLHttpRequest.prototype.open;
      XMLHttpRequest.prototype.open = function (method, url, ...rest) {
        if (url && /\.m3u8(\?|#|$)/i.test(url)) emit('M3U8_XHR', url);
        return _open.call(this, method, url, ...rest);
      };

      // Hook <video>.src setter
      const desc = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'src');
      if (desc && desc.set) {
        Object.defineProperty(HTMLMediaElement.prototype, 'src', {
          set(v) {
            if (typeof v === 'string' && /\.m3u8(\?|#|$)/i.test(v)) emit('M3U8_MEDIA_SRC', v);
            return desc.set.call(this, v);
          },
          get: desc.get,
          configurable: true
        });
      }

      // Hook Hls.js loadSource (if/when page defines Hls)
      const g = window;
      Object.defineProperty(g, 'Hls', {
        configurable: true,
        set(cls) {
          try {
            const Wrapped = class extends cls {
              loadSource(url) {
                if (url && /\.m3u8(\?|#|$)/i.test(url)) emit('M3U8_HLS_LOAD', url);
                return super.loadSource(url);
              }
            };
            Object.defineProperty(g, '__HlsWrapped', { value: Wrapped, configurable: true });
            return Reflect.set(g, 'Hls', Wrapped);
          } catch {
            return Reflect.set(g, 'Hls', cls);
          }
        },
        get() {
          return g.__HlsWrapped ?? undefined;
        }
      });
    } catch {}
  });

  // Listen for tag messages from the page (and its iframes)
  page.on('console', (msg) => {
    try {
      const text = msg.text();
      if (!text) return;
      if (text.startsWith('M3U8_')) {
        const idx = text.indexOf(':');
        if (idx > 0) {
          const url = text.slice(idx + 1).trim();
          record(url);
        }
      }
    } catch {}
  });

  // --- Navigate & try to trigger playback quickly ---
  console.log("\x1b[34mNavigating to page:\x1b[0m", targetUrl);
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

  // Try common play actions
  try {
    await page.waitForTimeout(1500);
    // Attempt to click obvious play buttons
    const candidates = [
      'button[aria-label*="play" i]',
      'button[title*="play" i]',
      '.vjs-big-play-button',
      '.jw-icon-playback',
      '.plyr__control--overlaid',
      'button[class*="play" i]'
    ];
    for (const sel of candidates) {
      const el = await page.$(sel);
      if (el) { await el.click({ force: true }).catch(() => {}); }
    }

    // Try programmatic play on any <video>
    await page.evaluate(() => {
      const vids = Array.from(document.querySelectorAll('video'));
      for (const v of vids) {
        try { v.muted = true; v.play().catch(() => {}); } catch {}
      }
    });
  } catch {}

  // Hard stop after ~35s (like your old script)
  const MAX_MS = 35000;
  const start = Date.now();
  while (!finished && Date.now() - start < MAX_MS) {
    await page.waitForTimeout(250);
  }
  if (!finished) finish(found.size ? 0 : 1);
})();
