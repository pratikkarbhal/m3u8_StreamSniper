# capture_m3u8.py
from mitmproxy import ctx, http
import re

m3u8_re = re.compile(r'https?://[^\s\'"<>]+\.m3u8[^\s\'"<>]*', re.IGNORECASE)
seen = set()

def _record(url):
    if not url:
        return
    if url in seen:
        return
    if not m3u8_re.search(url):
        return
    seen.add(url)
    try:
        with open("captured_m3u8.txt", "a") as f:
            f.write(url + "\n")
    except Exception as e:
        ctx.log.error("Failed write: " + str(e))
    ctx.log.info("FOUND_M3U8: " + url)

def response(flow: http.HTTPFlow):
    try:
        # check request URL
        req_url = flow.request.pretty_url
        if req_url and ".m3u8" in req_url.lower():
            _record(req_url)

        # check Location header (redirects)
        loc = flow.response.headers.get("location") or flow.response.headers.get("Location")
        if loc and ".m3u8" in loc.lower():
            _record(loc)

        # check response body (textual JSON/JS/html)
        content = b""
        try:
            content = flow.response.content or b""
        except:
            content = b""

        if content:
            try:
                text = content.decode("utf-8", "ignore")
            except:
                text = str(content)
            for match in m3u8_re.findall(text):
                _record(match)
    except Exception as e:
        ctx.log.error("response handler error: " + str(e))

def websocket_message(flow):
    try:
        # flow.messages exists in newer mitmproxy versions; iterate frames
        msgs = getattr(flow, "messages", None)
        if not msgs:
            return
        for m in msgs:
            try:
                payload = getattr(m, "content", None)
                if isinstance(payload, bytes):
                    payload = payload.decode("utf-8", "ignore")
                if payload and ".m3u8" in payload.lower():
                    for match in m3u8_re.findall(payload):
                        _record(match)
            except Exception:
                continue
    except Exception as e:
        ctx.log.error("ws handler error: " + str(e))
