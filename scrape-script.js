const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const targetUrl = process.env.TARGET_URL;

  if (!targetUrl) {
    console.error("\x1b[31mNo URL provided. Exiting script.\x1b[0m");
    process.exit(1);
  }

  console.log("\x1b[34mStarting Playwright...\x1b[0m");

  // Launch Chromium (Playwright manages installation)
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const m3u8Urls = [];

  // Capture all network responses
  page.on('response', async (response) => {
    const url = response.url();
    if (url.endsWith('.m3u8')) {
      m3u8Urls.push(url);
      console.log("\x1b[32mFound .m3u8 URL:\x1b[0m", url);
    }
  });

  try {
    console.log("\x1b[34mNavigating to page:\x1b[0m", targetUrl);
    await page.goto(targetUrl, { waitUntil: 'networkidle' });
    await page.waitForTimeout(10000); // wait for requests
  } catch (error) {
    console.error("\x1b[31mError navigating to page:\x1b[0m", error);
  }

  console.log("\x1b[34mAll network responses:\x1b[0m", m3u8Urls);

  if (m3u8Urls.length) {
    console.log("\x1b[32m✅ Total .m3u8 URLs found: ${m3u8Urls.length}\x1b[0m");
    fs.writeFileSync("playwright_output.txt", m3u8Urls.join('\n'));
  } else {
    console.log("\x1b[33m⚠️ No .m3u8 URL found.\x1b[0m");
    fs.writeFileSync("playwright_output.txt", "No .m3u8 URL found.");
  }

  await browser.close();
})();
