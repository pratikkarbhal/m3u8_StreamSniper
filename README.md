# Extract .m3u8 Stream URLs with Selenium + GitHub Actions  
(*Works on websites which don't need login/authentication*)  

This tool automates the process of extracting `.m3u8` URLs from live stream pages.  
It uses **Selenium + Chrome DevTools Protocol (CDP)** in a GitHub Actions workflow to capture stream URLs directly from the given page.  
You can then play these extracted URLs with your preferred HLS Player (e.g., VLC).  

---

## 🚀 Run Scrape Workflow Manually  

(After forking the repo) You can trigger the **Scrape Live Stream URL** workflow manually from the **Actions** page in your GitHub repository.

---

## 📸 Screenshots  

![Workflow Run Example](assets/workflow_run.png)  
![Extracted Output Example](assets/output_example.png)  

---

## 🛠️ How to Use  
1. Fork this repository
   
2. **Run the Workflow Manually**  
   - Go to the **Actions** tab of your repo.  
   - Select **Scrape Live Stream URL** workflow.  
   - Click on **Run workflow**.  
   - By default, the script uses:  
     ```
     https://news.abplive.com/live-tv
     ```  
     If you want to target another URL, set the `TARGET_URL` environment variable when running.  

3. **View Results**  
   - After ~30 seconds, the workflow will complete.  
   - Extracted URLs will appear:  
     - In the workflow logs (`Found .m3u8 URL:` messages).  


---

## ⚙️ Technologies Used  

- **Selenium (Python)**  
  - Controls a headless Chrome browser.  
  - Uses **Chrome DevTools Protocol (CDP)** to listen to network traffic and responses.  

- **Chrome DevTools Protocol (CDP)**  
  - Captures `.m3u8` requests from both **network requests** and **response bodies**.  
  - Provides fast and accurate detection of streaming URLs.  

- **GitHub Actions Workflow**  
  - Runs in GitHub’s cloud environment.  
  - Automatically installs dependencies (`selenium`, `webdriver-manager`, etc.).  
  - Allows users to trigger scraping with one click.  

---

## ⚠️ Important Notes  

- This tool is provided for **educational purposes**.  
- Works only on websites that **do not require login/authentication**.  
- Always ensure you comply with the site’s terms of service before scraping.  

---
