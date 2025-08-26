import time
from seleniumwire import webdriver  # selenium-wire lets us capture requests
from selenium.webdriver.chrome.options import Options

# Change this URL if you want dynamic input later
TARGET_URL = "https://news.abplive.com/live-tv"

def main():
    print("🚀 Starting Selenium with Network Capture...")

    options = Options()
    options.add_argument("--headless=new")  # headless mode
    options.add_argument("--disable-gpu")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")

    driver = webdriver.Chrome(options=options)

    print(f"🌍 Navigating to {TARGET_URL}")
    driver.get(TARGET_URL)

    found_url = None
    timeout = time.time() + 30  # wait max 30s

    while time.time() < timeout:
        for request in driver.requests:
            if request.response and ".m3u8" in request.url:
                found_url = request.url
                break
        if found_url:
            break
        time.sleep(1)

    if found_url:
        print(f"✅ Found M3U8 URL: {found_url}")
    else:
        print("⚠️ No .m3u8 URL found.")

    driver.quit()

if __name__ == "__main__":
    main()
