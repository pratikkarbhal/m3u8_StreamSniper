const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  const targetUrl = process.env.TARGET_URL;

  if (!targetUrl) {
    console.error("\x1b[31mNo URL provided. Exiting script.\x1b[0m");  // Red text for error
    process.exit(1);
  }

  console.log("\x1b[34mStarting Puppeteer...\x1b[0m"); // Blue text for startup info

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox"
    ]
  });

  const page = await browser.newPage();

  // Enable request interception
  await page.setRequestInterception(true);
  page.on('request', (request) => {
    request.continue();
  });

  const m3u8Urls = [];

  // Log network responses
  page.on('response', async (response) => {
    const url = response.url();
    if (url.endsWith('.m3u8')) {
      m3u8Urls.push(url);
      console.log("\x1b[32mFound .m3u8 URL:\x1b[0m", url); // Green text for found URL
    }
  });

  try {
    console.log("\x1b[34mNavigating to page:\x1b[0m", targetUrl);
    await page.goto(targetUrl, { waitUntil: 'networkidle2' });

    // Delay to allow network requests
    await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10s
  } catch (error) {
    console.error("\x1b[31mError navigating to page:\x1b[0m", error);  // Red text for errors
  }

  console.log("\x1b[34mAll network responses:\x1b[0m", m3u8Urls);

  // Save results to file
  if (m3u8Urls.length) {
    console.log(`\x1b[32m✅ Total .m3u8 URLs found: ${m3u8Urls.length}\x1b[0m`);
    fs.writeFileSync('puppeteer_output.txt', m3u8Urls.join('\n'));
  } else {
    console.log("\x1b[33m⚠️ No .m3u8 URL found.\x1b[0m");  // Yellow warning for no results
    fs.writeFileSync('puppeteer_output.txt', 'No .m3u8 URL found.');
  }

  await browser.close();
})();
