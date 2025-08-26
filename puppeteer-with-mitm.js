// puppeteer-with-mitm.js
const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  const targetUrl = process.env.TARGET_URL || process.argv[2];
  if (!targetUrl) {
    console.error("\x1b[31mNo URL provided. Exiting script.\x1b[0m");
    process.exit(1);
  }

  console.log("\x1b[36m🌀 Starting Puppeteer (proxy -> mitmproxy) ...\x1b[0m");

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--autoplay-policy=no-user-gesture-required",
      "--proxy-server=127.0.0.1:8080",
      "--ignore-certificate-errors" // allow mitmproxy TLS interception
    ]
  });

  const page = await browser.newPage();

  try {
    console.log("\x1b[34mNavigating to page:\x1b[0m", targetUrl);
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

    // quick attempt to click common play buttons
    const playSelectors = [
      'button[aria-label*="play" i]',
      'button[title*="play" i]',
      '.vjs-big-play-button',
      '.jw-icon-playback',
      '.plyr__control--overlaid',
      'button[class*="play" i]'
    ];
    for (const sel of playSelectors) {
      const el = await page.$(sel);
      if (el) {
        try { await el.click({ force: true }); } catch {}
      }
    }

    // try programmatic play on any <video>
    await page.evaluate(() => {
      try {
        const vids = Array.from(document.querySelectorAll('video'));
        for (const v of vids) {
          try { v.muted = true; v.play().catch(() => {}); } catch {}
        }
      } catch {}
    });

    // Give the player time to request streams (30s max)
    await page.waitForTimeout(30000);
  } catch (err) {
    console.error("\x1b[31mError during navigation/play:\x1b[0m", err.message || err);
  }

  // Read mitmproxy output file
  let found = [];
  try {
    const txt = fs.readFileSync('captured_m3u8.txt', 'utf8');
    found = txt.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  } catch (e) {
    // file may not exist
  }

  if (found.length) {
    for (const url of found) {
      console.log("\x1b[32mFound .m3u8 URL:\x1b[0m", url);
    }
    fs.writeFileSync('puppeteer_output.txt', found.join('\n'));
  } else {
    console.log("\x1b[33m⚠️ No .m3u8 URL found.\x1b[0m");
    fs.writeFileSync('puppeteer_output.txt', 'No .m3u8 URL found.');
  }

  await browser.close();
})();
