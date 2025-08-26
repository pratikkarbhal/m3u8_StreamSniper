import os
import time
import sys
from seleniumwire import webdriver
from selenium.webdriver.chrome.options import Options

def main():
    target_url = os.getenv("TARGET_URL")

    if not target_url:
        print("\033[31mNo URL provided. Exiting script.\033[0m")
        sys.exit(1)

    print("\033[34mStarting Selenium...\033[0m")

    options = Options()
    options.add_argument("--headless=new")
    options.add_argument("--disable-gpu")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")

    driver = webdriver.Chrome(options=options)

    print("\033[34mNavigating to page:\033[0m", target_url)
    driver.get(target_url)

    m3u8_urls = []
    timeout = time.time() + 30  # wait up to 30s
    while time.time() < timeout:
        for request in driver.requests:
            if request.response and ".m3u8" in request.url:
                if request.url not in m3u8_urls:
                    m3u8_urls.append(request.url)
                    print("\033[32mFound .m3u8 URL:\033[0m", request.url)
        if m3u8_urls:
            break
        time.sleep(1)

    if m3u8_urls:
        print(f"\033[32m✅ Total .m3u8 URLs found: {len(m3u8_urls)}\033[0m")
        with open("puppeteer_output.txt", "w") as f:
            f.write("\n".join(m3u8_urls))
    else:
        print("\033[33m⚠️ No .m3u8 URL found.\033[0m")
        with open("puppeteer_output.txt", "w") as f:
            f.write("No .m3u8 URL found.")

    driver.quit()

if __name__ == "__main__":
    main()
