import time
from selenium import webdriver
from selenium.webdriver.chrome.options import Options

def fetch_m3u8(url):
    options = Options()
    options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.set_capability("goog:loggingPrefs", {"performance": "ALL"})

    driver = webdriver.Chrome(options=options)
    driver.get(url)

    time.sleep(10)  # wait for network calls

    logs = driver.get_log("performance")
    m3u8_urls = []
    for entry in logs:
        try:
            message = entry["message"]
            if ".m3u8" in message:
                start = message.find("http")
                end = message.find(".m3u8") + 5
                m3u8_url = message[start:end]
                if m3u8_url not in m3u8_urls:
                    m3u8_urls.append(m3u8_url)
        except Exception:
            continue

    driver.quit()
    return m3u8_urls

if __name__ == "__main__":
    test_url = "https://news.abplive.com/live-tv"
    urls = fetch_m3u8(test_url)
    if urls:
        print("✅ Found m3u8 URLs:")
        for u in urls:
            print(u)
    else:
        print("⚠️ No m3u8 URL found.")
