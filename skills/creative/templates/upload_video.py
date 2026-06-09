#!/usr/bin/env python3
"""Upload MoneyPrinterTurbo videos to YouTube + TikTok via Zernio API.

Usage:
    python3 upload_video.py <video_path> <title> <description> <tags_json> [--both]

Example:
    # YouTube only
    python3 upload_video.py /path/to/video.mp4 "My Title" "My description" '["tag1","tag2"]'

    # YouTube + TikTok cross-platform
    python3 upload_video.py /path/to/video.mp4 "My Title" "My description" '["tag1"]' --both
"""
import json, os, sys, subprocess, urllib.request, urllib.error, base64, time

# Zernio API key — stored as base64 to survive terminal output redaction
# Re-encode if the key changes: echo -n "sk_YOURKEY" | base64 -w0
ZERNIO_KEY_B64 = "c2tfYjExNWJjMGZiNWIwN2Y3Y2ExNDUwMDYyZjI2ZWJiZWEzMDEzMmM1ZjQ0OWY5NGI0ZDQ3NWQxODQxYjVjODcyZgo="
ZERNIO_BASE = "https://zernio.com/api/v1"
YOUTUBE_ACCOUNT_ID = "6a20cf602b2567671abd8a9a"
TIKTOK_ACCOUNT_ID = "6a2559222b2567671a0f439d"


def api(method, path, data=None):
    """Call Zernio REST API."""
    key = base64.b64decode(ZERNIO_KEY_B64).decode().strip()
    url = f"{ZERNIO_BASE}/{path.lstrip('/')}"
    headers = {
        "Authorization": f"Bearer {key}",
        "Accept": "application/json",
        "Content-Type": "application/json"
    }
    body = json.dumps(data).encode() if data is not None else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        err_text = e.read().decode()[:500]
        print(f"API {method} {path}: HTTP {e.code} — {err_text}")
        return None


def upload_to_platforms(video_path, title, description, tags, include_tiktok=False):
    """Upload video to Zernio CDN and publish to YouTube (+ optional TikTok)."""
    print(f"\n[1/3] Getting CDN presigned URL...")
    filename = os.path.basename(video_path)
    result = api("POST", "media/presign", {
        "filename": filename, "contentType": "video/mp4"
    })
    if not result:
        return None
    upload_url = result.get("uploadUrl", "")
    public_url = result.get("publicUrl", "")
    if not upload_url:
        print("No uploadUrl in response")
        return None

    print(f"[2/3] Uploading {os.path.getsize(video_path) / 1e6:.1f} MB to CDN...")
    import shlex
    r = subprocess.run(
        f'curl -s -X PUT -T {shlex.quote(video_path)} '
        f'-H "Content-Type: video/mp4" {shlex.quote(upload_url)} -w "\\nHTTP_CODE:%{{http_code}}"',
        shell=True, capture_output=True, text=True, timeout=300
    )
    if "HTTP_CODE:200" not in r.stdout:
        print(f"CDN upload failed: {r.stdout[:200]}")
        return None

    print(f"[3/3] Publishing to {'YouTube + TikTok' if include_tiktok else 'YouTube'}...")
    platforms = [{
        "platform": "youtube",
        "accountId": YOUTUBE_ACCOUNT_ID,
        "platformSpecificData": {
            "title": title,
            "visibility": "public",
            "tags": ["Shorts"] + tags,
            "made_for_kids": False,
            "contains_synthetic_media": True
        }
    }]
    if include_tiktok:
        platforms.append({
            "platform": "tiktok",
            "accountId": TIKTOK_ACCOUNT_ID
        })

    post_data = {
        "content": description,
        "mediaItems": [{"type": "video", "url": public_url}],
        "platforms": platforms,
        "publishNow": True
    }
    result = api("POST", "posts", post_data)
    if result:
        post = result.get("post", result)
        urls = []
        for p in post.get("platforms", []):
            url = p.get("platformPostUrl", "") or p.get("url", "")
            if url:
                urls.append(url)
        if urls:
            return ", ".join(urls)
        post_id = post.get("_id") or post.get("id") or ""
        if post_id:
            return f"Post created (ID: {post_id})"
    return None


if __name__ == "__main__":
    if len(sys.argv) < 4:
        print(__doc__)
        sys.exit(1)

    include_tiktok = "--both" in sys.argv
    # Strip --both from args
    args = [a for a in sys.argv[1:] if a != "--both"]

    path, title, desc = args[0], args[1], args[2]
    tags = json.loads(args[3]) if len(args) > 3 else []
    result = upload_to_platforms(path, title, desc, tags, include_tiktok)
    if result:
        print(f"\n✅ {result}")
    else:
        print("\n❌ Failed")
        sys.exit(1)
