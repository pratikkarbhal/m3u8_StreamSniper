import time
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.desired_capabilities import DesiredCapabilities

# Setup Chrome options for headless mode
options = Options()
options.add_argument("--headless")
options.add_argument("--disable-gpu")
options.add_argument("--no-sandbox")
options.add_argument("--disable-dev-shm-usage")

# Enable CDP logging
caps = DesiredCapabilities.CHROME
caps["goog:loggingPrefs"] = {"performance": "ALL"}

# Start browser
driver = webdriver.Chrome(options=options, desired_capabilities=caps)

# Store found links
found_links = []

# Loop through episodes
for ep in range(1, 101):
    url = f"https://anigo.to/watch/kochikame-qd99#ep={ep}"
    print(f"🔍 Checking Episode {ep}: {url}")
    driver.get(url)
    time.sleep(10)  # Wait for video to load

    logs = driver.get_log("performance")
    for entry in logs:
        message = entry["message"]
        if ".m3u8" in message:
            start = message.find("https")
            end = message.find(".m3u8") + 5
            stream_url = message[start:end]
            if stream_url not in found_links:
                found_links.append(stream_url)
                print(f"✅ Found .m3u8 URL for ep {ep}: {stream_url}")
            break

driver.quit()

# Final output
print("\n🎉 All Extracted .m3u8 Links:")
for link in found_links:
    print(link)
