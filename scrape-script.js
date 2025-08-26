const { chromium } = require("playwright");

(async () => {
  console.log("Starting Playwright...");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const url = process.argv[2] || "https://news.abplive.com/live-tv";
  console.log("Navigating to page:", url);

  let m3u8Found = null;

  // ✅ Catch responses in real-time instead of after navigation
  page.on("response", async (response) => {
    try {
      const reqUrl = response.url();
      if (reqUrl.includes(".m3u8")) {
        console.log("\x1b[32m✅ Found m3u8 URL:\x1b[0m", reqUrl);
        m3u8Found = reqUrl;

        // Save immediately and exit quickly
        const fs = require("fs");
        fs.writeFileSync("output.m3u8", reqUrl);
        await browser.close();
        process.exit(0);
      }
    } catch (err) {
      // Ignore small errors
    }
  });

  await page.goto(url, { waitUntil: "domcontentloaded" });

  // ⏱ Don’t wait forever — give 30 sec max like old script
  await page.waitForTimeout(30000);

  if (!m3u8Found) {
    console.log("\x1b[33m⚠️ No .m3u8 URL found.\x1b[0m");
    await browser.close();
    process.exit(1);
  }
})();
