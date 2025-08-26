import sys
import time
import re
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.desired_capabilities import DesiredCapabilities

def main():
    if len(sys.argv) < 2:
        print("❌ No URL provided.")
        sys.exit(1)

    url = sys.argv[1]
    print(f"🌐 Navigating to: {url}")

    caps = DesiredCapabilities.CHROME
    caps["goog:loggingPrefs"] = {"performance": "ALL"}

    options = Options()
    options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")

    driver = webdriver.Chrome(options=options, desired_capabilities=caps)
    driver.get(url)

    time.sleep(10)  # wait for streams to load

    logs = driver.get_log("performance")
    m3u8_url = None

    for entry in logs:
        msg = entry["message"]
        if ".m3u8" in msg:
            match = re.search(r"https.*?\.m3u8", msg)
            if match:
                m3u8_url = match.group(0)
                break

    driver.quit()

    if m3u8_url:
        print(f"✅ Found stream URL: {m3u8_url}")
    else:
        print("⚠️ No .m3u8 URL found.")

if __name__ == "__main__":
    main()
