#!/usr/bin/env python3
# fetch_stream.py
# Uses Selenium + Chrome DevTools Protocol (performance logs) to capture .m3u8 URLs
# Reads TARGET_URL from env (keeps default), prints lines like "Found .m3u8 URL:" and writes results.

import os
import sys
import time
import json
import re
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager

DEFAULT_URL = "https://news.abplive.com/live-tv"

def extract_m3u8_from_text(text):
    if not text:
        return []
    return re.findall(r'https?://[^\'"\s>]+\.m3u8[^\'"\s>]*', text, flags=re.IGNORECASE)

def main():
    # Allow override via env or CLI arg
    target_url = os.getenv("TARGET_URL") or (sys.argv[1] if len(sys.argv) > 1 else DEFAULT_URL)

    if not target_url:
        print("\x1b[31mNo URL provided. Exiting script.\x1b[0m")
        sys.exit(1)

    print("\x1b[36m🌀 Starting Selenium (CDP network capture)...\x1b[0m")
    print("\x1b[34mNavigating to page:\x1b[0m", target_url)

    options = Options()
    # headless new is recommended for modern Chrome + Selenium
    options.add_argument("--headless=new")
    options.add_argument("--disable-gpu")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    # enable performance logs
    options.set_capability("goog:loggingPrefs", {"performance": "ALL"})

    # Use webdriver-manager to fetch the matching chromedriver automatically
    driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)

    try:
        # Enable Network domain (so we can call getResponseBody later)
        try:
            driver.execute_cdp_cmd("Network.enable", {})
        except Exception:
            pass

        driver.get(target_url)

        # small wait to let initial resources load
        time.sleep(1)

        found = []
        processed = set()
        start = time.time()
        MAX_WAIT = 30  # seconds

        while time.time() - start < MAX_WAIT:
            # Read performance logs (CDP events)
            logs = driver.get_log("performance")
            for entry in logs:
                # avoid reprocessing the same log
                key = entry.get("message")
                if not key or key in processed:
                    continue
                processed.add(key)

                try:
                    msg = json.loads(entry["message"])["message"]
                except Exception:
                    continue

                method = msg.get("method", "")
                params = msg.get("params", {}) or {}

                # 1) Network.requestWillBeSent -> request URL
                if method == "Network.requestWillBeSent":
                    req = params.get("request", {}) or {}
                    url = req.get("url", "")
                    if ".m3u8" in url.lower():
                        if url not in found:
                            found.append(url)
                            print("\x1b[32mFound .m3u8 URL:\x1b[0m", url)

                # 2) Network.responseReceived -> response metadata (and optionally fetch body)
                if method == "Network.responseReceived":
                    resp = params.get("response", {}) or {}
                    url = resp.get("url", "") or ""
                    mime = (resp.get("mimeType") or "").lower()

                    # direct response URL contain .m3u8
                    if ".m3u8" in url.lower():
                        if url not in found:
                            found.append(url)
                            print("\x1b[32mFound .m3u8 URL:\x1b[0m", url)

                    # For textual responses (json/js/html) try to read body and search for m3u8 links
                    try_body = False
                    if ("json" in mime) or ("text" in mime) or ("javascript" in mime) or url.lower().endswith(('.json', '.js', '.html', '.txt')):
                        try_body = True

                    if try_body:
                        request_id = params.get("requestId")
                        if request_id:
                            try:
                                body_info = driver.execute_cdp_cmd("Network.getResponseBody", {"requestId": request_id})
                                body_text = body_info.get("body", "") if isinstance(body_info, dict) else ""
                                if body_text and ".m3u8" in body_text:
                                    matches = extract_m3u8_from_text(body_text)
                                    for m in matches:
                                        if m not in found:
                                            found.append(m)
                                            print("\x1b[32mFound .m3u8 URL:\x1b[0m", m)
                            except Exception:
                                # sometimes getResponseBody fails (resource not available) - ignore
                                pass

            if found:
                break
            time.sleep(0.5)

        # Final output
        if found:
            print(f"\x1b[32m✅ Total .m3u8 URLs found: {len(found)}\x1b[0m")
        else:
            print("\x1b[33m⚠️ No .m3u8 URL found.\x1b[0m")

        try:
            driver.quit()
        except Exception:
            pass

if __name__ == "__main__":
    main()
