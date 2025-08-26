import time
from seleniumwire import webdriver  # selenium-wire lets us capture network traffic
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager

TARGET_URL = "https://news.abplive.com/live-tv"

def main():
    print("🌀 Starting Selenium...")
    
    # Launch Chrome with selenium-wire to capture requests
    options = webdriver.ChromeOptions()
    options.add_argument("--headless=new")
    options.add_argument("--disable-gpu")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    
    driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)
    
    try:
        print(f"🌍 Navigating to: {TARGET_URL}")
        driver.get(TARGET_URL)

        # Give some time for requests to load
        time.sleep(10)

        m3u8_url = None
        for request in driver.requests:
            if request.response and ".m3u8" in request.url:
                m3u8_url = request.url
                break

        if m3u8_url:
            print(f"✅ Found stream URL: {m3u8_url}")
        else:
            print("⚠️ No .m3u8 URL found.")

    finally:
        driver.quit()

if __name__ == "__main__":
    main()
