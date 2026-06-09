# Trending Video Factory Pipeline

Daily cron that generates and publishes **5 trending Shorts** to **YouTube + TikTok** via MoneyPrinterTurbo.

## Files

- **Main script:** `/root/youtube-bot/trending_video_factory.py` (~530 lines)
- **Cron job ID:** `e8f72e557fca` (07:30 UTC)
- **Aurora cron ID:** `1c4c9122afc7` (07:00 UTC)
- **Output dir:** `/root/youtube-bot/trending-videos/`
- **Log:** `/root/youtube-bot/trending-videos/run.log`

## Architecture

```
Cron trigger (07:00 + 07:30 UTC, LLM-driven)
  -> Agent web_searches today's trending topics (5 diverse categories)
  -> Submits all 5 MPT tasks simultaneously
  -> Polls all 5 until complete
  -> Uploads each to its own CDN presigned URL
  -> Publishes to YouTube + TikTok staggered 2h apart
```

## Key Design Decisions

### No "How To" Content
The user explicitly rejected tutorial-style videos. All topics must be trending information, facts, news, or entertainment.

### Parallel Generation
All MPT tasks run independently. Submit all 5 at once, poll every 30s. ~8-12 min total for 5 videos.

### Stagger Schedule (5 Videos)
- Video 1: publishNow (~08:00)
- Video 2: scheduledFor +2h (10:00)
- Video 3: scheduledFor +4h (12:00)
- Video 4: scheduledFor +6h (14:00)
- Video 5: scheduledFor +8h (16:00)

### Cross-Platform
Publish to YouTube (aurorasadventureacademy) AND TikTok (aiworkers_ai) simultaneously via one Zernio post call.

### Progress Monitoring
The script polls MPT every 10 seconds. Observed progress:
- 5% -> LLM generating script (~0-15s)
- 40% -> TTS done, starting downloads (~15s)
- 50% -> Downloading Pexels stock videos (~45s - 3min)
- 75% -> Rendering subtitles (~3min - 4:30min)
- 100% -> Done (~5min total for 39s 9:16 video)

### MPT Server
Already running at `http://127.0.0.1:8080`. Start if needed:
```bash
cd /root/MoneyPrinterTurbo && uv run python main.py
```

### Zernio API Integration
- Key from ~/.hermes/.env
- YouTube account ID: `6a20cf602b2567671abd8a9a`
- Always include `Accept: application/json` header on POST requests
- Direct REST API to bypass MCP rate limits

## Full script at:
/root/youtube-bot/trending_video_factory.py
