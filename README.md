# Extract .m3u8 Stream URLs with GitHub Actions
(*works on websites which don't need login/authentication)

This tool automates the process of extracting `.m3u8` URLs from live stream pages. It uses Puppeteer in a GitHub Actions workflow to fetch URLs directly from a given page. Use extracted URLs with your preffered HLS Player(eg. VLC).

### Run Scrape Workflow Manually

> You can trigger the [Scrape Live Stream URL workflow](../../actions/workflows/scrape-live-stream.yml) manually from the Actions page.

### Screenshots
![{05D6F833-1FEB-47F6-99E1-DC0F72F9980F}](https://github.com/user-attachments/assets/85f67166-7f32-4623-9d8e-5d7889156b6b)

![{A2BCFB04-123E-45F4-A211-53C1A8ECD4CD}](https://github.com/user-attachments/assets/d29488fc-9197-4dd7-85d3-d5e567d1e8c1)





### How to Use

1. Run the Workflow Manually:
   - Click on "Run workflow."
   - Input the URL you want to scrape when prompted (e.g., `https://free2air_example.com/live`).
   - Click "Run workflow" to start the scraping process.
2. View Results:
   - After a few minutes, the workflow will complete.
   - You can view the extracted URLs under the workflow run's logs or in the `puppeteer_output.txt` file.
  
##
### Technologies Used
Puppeteer:

Puppeteer is a Node.js library that controls Chromium, often for web scraping and automation. Here, it opens a headless browser (no visible interface) to monitor network requests.

Capturing .m3u8 Links:

The script loads a webpage in Puppeteer, intercepts network requests, and logs any URLs ending in .m3u8. Excecutes in GitHub Actions.

GitHub Actions Workflow:

It runs in GitHub's cloud environment using Node.js, allowing users to trigger the action, specify a URL, and capture .m3u8 links from the site.

#### Important Notes
This tool is provided for educational purposes. Always ensure that you trying websites which don't use any login/authentication.
  



