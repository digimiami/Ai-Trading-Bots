# Batch Pipeline Transcript — June 9, 2026

Real 3-video batch run that completed successfully. Use this as a reference for the daily cron.

## Topics Selected
1. AI Agents took over the internet (AI/tech)
2. Quantum computers change everything (science)
3. Space-time may not exist (physics/philosophy)

## Timeline

| Time | Event |
|---|---|
| 07:06 | ✅ MPT server verified running on :8080 |
| 07:07 | All 3 tasks submitted simultaneously |
| 07:07-07:21 | All 3 at state=4 (working), progress stuck at 50% |
| 07:21 | Final videos appeared (11MB, 25MB, 37MB) |
| 07:21-07:28 | CDN uploads (11MB took ~2min, 25MB took ~5min) |

**Total time: ~24 min for 3 videos from submit to CDN-ready.**

## CDN Presigned URL Pattern
```python
# Each presigned URL is UNIQUE per file — do NOT reuse
result = api("POST", "media/presign", {
    "filename": "unique_name_for_each_video.mp4",
    "contentType": "video/mp4"
})
upload_url = result["uploadUrl"]
public_url = result["publicUrl"]
```

**⚠️ CRITICAL:** Uploading a different file to the same URL overwrites it. Always get separate URLs per video.

## Cross-Platform Publishing
```json
{
  "content": "caption with #hashtags",
  "mediaItems": [{"type": "video", "url": "https://media.zernio.com/..."}],
  "platforms": [
    {"platform": "youtube", "accountId": "6a20cf602b2567671abd8a9a",
     "platformSpecificData": {
       "title": "Video Title", "visibility": "public",
       "tags": ["Shorts", "tag1"], "made_for_kids": false,
       "contains_synthetic_media": true
     }},
    {"platform": "tiktok", "accountId": "6a2559222b2567671a0f439d"}
  ],
  "publishNow": false,
  "scheduledFor": "2026-06-09T10:00:00Z"
}
```

## Stagger Pattern (3 Videos)
- Video 1: publishNow → 07:28
- Video 2: scheduledFor 10:00 (+2h 32min)
- Video 3: scheduledFor 12:00 (+2h more)

## Results
- Video 1 (AI Agents): ✅ Live YouTube + TikTok (processing)
- Video 2 (Quantum): ✅ Scheduled for 10:00 UTC
- Video 3 (Space-Time): ✅ Scheduled for 12:00 UTC
