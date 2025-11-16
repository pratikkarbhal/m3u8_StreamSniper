#!/usr/bin/env python3
# fetch_stream_optimized.py
# Optimized Selenium + CDP .m3u8 capture for CI (GitHub Actions)
# - set TARGET_URL env or pass as argv
# - optional env CHROMEDRIVER_PATH to skip driver download
# - configurable MAX_WAIT_SECONDS and STARTUP_TIMEOUT via env

import os
import sys
import time
import json
import re
import shutil
import subprocess
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options

try:
    # webdriver_manager is optional fallback
    from webdriver_manager.chrome import ChromeDriverManager
    _HAS_WDM = True
except Exception:
    _HAS_WDM = False

DEFAULT_URL = "https://news.abplive.com/live-tv"
M3U8_RE = re.compile(r'https?://[^\'"\s>]+\.m3u8[^\'"\s>]*', flags=re.IGNORECASE)

def now():
    return time.strftime("%H:%M:%S")

def extract_m3u8_from_text(text):
    if not text:
        return []
    return M3U8_RE.findall(text)

def find_chromedriver_from_env_or_path():
    # 1) explicit env override
    env_path = os.getenv("CHROMEDRIVER_PATH")
    if env_path and shutil.which(env_path):
        return env_path
    # 2) check PATH for chromedriver
    path = shutil.which("chromedriver")
    if path:
        return path
    # 3) webdriver_manager fallback
    if _HAS_WDM:
        try:
            # cache_valid_range reduces repeated network activity in wdm
            return ChromeDriverManager(cache_valid_range=365).install()
        except Exception:
            return None
    return None

def get_chrome_version():
    # best-effort detection of installed chrome/chromium version
    for cmd in (["google-chrome","--version"], ["chrome","--version"], ["chromium","--version"], ["google-chrome-stable","--version"]):
        exe = shutil.which(cmd[0])
        if exe:
            try:
                out = subprocess.check_output([exe, "--version"], stderr=subprocess.STDOUT)
                return out.decode(errors="ignore").strip()
            except Exception:
                continue
    return None

def make_driver(chromedriver_path):
    options = Options()
    # Use new headless mode, container friendly flags
    options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")
    options.add_argument("--disable-extensions")
    options.add_argument("--disable-background-networking")
    options.add_argument("--no-first-run")
    options.add_argument("--disable-translate")
    options.add_argument("--disable-features=VizDisplayCompositor")
    # prefer automation flags
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option("useAutomationExtension", False)
    # ask Chrome to send performance logs
    options.set_capability("goog:loggingPrefs", {"performance": "ALL"})
    # create service
    if chromedriver_path:
        service = Service(chromedriver_path)
    else:
        service = Service()  # let Selenium pick default
    driver = webdriver.Chrome(service=service, options=options)
    # small timeout defaults
    driver.set_page_load_timeout(int(os.getenv("STARTUP_TIMEOUT", "30")))
    return driver

def main():
    target_url = os.getenv("TARGET_URL") or (sys.argv[1] if len(sys.argv) > 1 else DEFAULT_URL)
    if not target_url:
        print("\x1b[31mNo URL provided. Exiting.\x1b[0m")
        sys.exit(1)

    MAX_WAIT = float(os.getenv("MAX_WAIT_SECONDS", "15"))  # total polling window
    POLL_INTERVAL = float(os.getenv("POLL_INTERVAL", "0.6"))
    STARTUP_TIMEOUT = int(os.getenv("STARTUP_TIMEOUT", "30"))

    print(f"{now()} 🌀 Starting optimized Selenium CDP capture")
    print(f"{now()} Target URL: {target_url}")

    chromedriver_path = find_chromedriver_from_env_or_path()
    if chromedriver_path:
        print(f"{now()} Using chromedriver: {chromedriver_path}")
    else:
        print(f"{now()} No chromedriver found in PATH or env. webdriver_manager available: {_HAS_WDM}")

    chrome_ver = get_chrome_version()
    if chrome_ver:
        print(f"{now()} Detected Chrome version: {chrome_ver}")

    driver = None
    start_total = time.time()
    try:
        driver = make_driver(chromedriver_path)
        t1 = time.time()
        print(f"{now()} Selenium launched in {t1 - start_total:.2f}s")

        # enable Network domain (CDP)
        try:
            driver.execute_cdp_cmd("Network.enable", {})
        except Exception:
            # Some Selenium/Chrome versions may not require or support this; continue
            pass

        # navigate with a reasonable wait
        try:
            nav_start = time.time()
            driver.get(target_url)
            nav_end = time.time()
            print(f"{now()} Page.get finished in {nav_end - nav_start:.2f}s")
        except Exception as e:
            print(f"{now()} Warning: page.get raised: {e}")

        # small initial sleep to let players init (but avoid long sleeps)
        time.sleep(1.0)

        found = set()
        processed = set()
        start = time.time()

        # We only parse the two CDP methods we care about to avoid heavy parsing
        while time.time() - start < MAX_WAIT:
            logs = []
            try:
                logs = driver.get_log("performance")
            except Exception:
                # if performance log fails, don't crash; try again
                pass

            for entry in logs:
                raw = entry.get("message")
                if not raw or raw in processed:
                    continue
                processed.add(raw)

                try:
                    msg = json.loads(raw)["message"]
                except Exception:
                    continue

                method = msg.get("method", "")
                params = msg.get("params", {}) or {}

                # handle requests (fast)
                if method == "Network.requestWillBeSent":
                    url = params.get("request", {}).get("url", "") or ""
                    if ".m3u8" in url.lower() and url not in found:
                        found.add(url)
                        print(f"{now()} \x1b[32mFound .m3u8 URL (request):\x1b[0m {url}")

                # handle responses
                elif method == "Network.responseReceived":
                    resp = params.get("response", {}) or {}
                    url = resp.get("url", "") or ""
                    mime = (resp.get("mimeType") or "").lower()

                    # quick wins: url contains .m3u8
                    if ".m3u8" in url.lower() and url not in found:
                        found.add(url)
                        print(f"{now()} \x1b[32mFound .m3u8 URL (response):\x1b[0m {url}")
                        # continue - no body needed

                    # only fetch body for likely small textual responses OR if url suggests m3u8 inside body
                    should_fetch_body = False
                    if url and any(url.lower().endswith(x) for x in ('.json', '.js', '.txt', '.html')):
                        should_fetch_body = True
                    if "json" in mime or "javascript" in mime or "text" in mime or "html" in mime:
                        should_fetch_body = True
                    # if response header indicates small size, it's safeish (note: not all servers give this)
                    if resp.get("encodedDataLength", 0) and resp.get("encodedDataLength", 0) > 200_000:
                        should_fetch_body = False

                    if should_fetch_body:
                        request_id = params.get("requestId")
                        if request_id:
                            try:
                                body_info = driver.execute_cdp_cmd("Network.getResponseBody", {"requestId": request_id})
                                body_text = body_info.get("body", "") if isinstance(body_info, dict) else ""
                                if body_text and ".m3u8" in body_text:
                                    for m in extract_m3u8_from_text(body_text):
                                        if m not in found:
                                            found.add(m)
                                            print(f"{now()} \x1b[32mFound .m3u8 URL (in body):\x1b[0m {m}")
                            except Exception:
                                # ignore missing body or failures
                                pass

            if found:
                # early exit when found at least one URL
                break

            time.sleep(POLL_INTERVAL)

        # Final output
        if found:
            print(f"{now()} \x1b[32m✅ Total .m3u8 URLs found: {len(found)}\x1b[0m")
            for u in sorted(found):
                print(u)
            sys.exit(0)
        else:
            print(f"{now()} \x1b[33m⚠️ No .m3u8 URL found within {MAX_WAIT}s.\x1b[0m")
            sys.exit(2)

    finally:
        try:
            if driver:
                driver.quit()
                print(f"{now()} Selenium driver quit")
        except Exception:
            pass

if __name__ == "__main__":
    main()
