---
name: channel-growth-engine
description: "YouTube + TikTok channel growth automation — SEO titles, trending hashtags, AI thumbnails, cross-posting, comment-to-DM automations, analytics review, and weekly growth reports. Designed for faceless Shorts channels."
tags: [growth, youtube, tiktok, seo, engagement, automation, thumbnails, analytics]
---

# Channel Growth Engine 📈

Automated growth system for faceless Shorts channels on YouTube + TikTok. Analyzes performance, optimizes SEO, engages viewers, and reports weekly.

## Architecture

```
┌─────────────────────────────────────────────┐
│              CHANNEL GROWTH ENGINE           │
├─────────────────────────────────────────────┤
│ 1. ANALYZE   → Zernio analytics / API       │
│ 2. OPTIMIZE  → SEO titles + hashtags + AI   │
│                thumbnail generation          │
│ 3. ENGAGE    → Comment-to-DM automations     │
│                + welcome sequences           │
│ 4. CROSSPOST → YouTube ↔ TikTok ↔ (future)  │
│ 5. REPORT    → Weekly growth digest          │
└─────────────────────────────────────────────┘
```

---

## 1. ANALYZE — Video Performance

### Check Top Performing Videos

```python
# Via Zernio analytics MCP
mcp_zernio_analytics_get_analytics(
    account_id="6a20cf602b2567671abd8a9a",  # YouTube
    from_date="2026-06-01",
    limit=10,
    sort_by="engagement"
)
```

### TikTok Account Insights

```python
mcp_zernio_analytics_get_tik_tok_account_insights(
    account_id="6a2559222b2567671a0f439d",
    metric_type="total_value"
)
```

### What to look for:
- **High engagement rate** (>10%) → replicate format/style
- **High retention** (>70%) → good hook, keep similar openings
- **Low CTR** (<5%) → thumbnail or title is weak
- **TikTok: high completion rate** → video length is right

---

## 2. OPTIMIZE — SEO Titles + Hashtags + Thumbnails

### Trending Hashtags (Web Search)

```python
def get_trending_hashtags(niche="AI"):
    """Search for today's trending hashtags in the niche."""
    from hermes_tools import web_search
    results = web_search(f"trending hashtags {niche} June 2026 TikTok YouTube Shorts")
    # Parse and return top 10
    return ["#AITrends", "#FutureTech", "#MindBlown", ...]
```

### SEO Title Generator

Rules for faceless Shorts titles:
- **Hook in first 3 words** — "You Won't Believe..." "Scientists Just Found..." "This Changes Everything..."
- **Question format** — "Is AI Taking Over?" "What Happens When..."
- **Numbered lists** — "3 Mind-Blowing Facts About..."
- **Power words** — Secret, Shocking, Insane, Unbelievable, Genius
- **Max 60 chars** — Shorts titles get cut off after ~60 chars on mobile

### AI Thumbnail Generator

Since we don't have a dedicated thumbnail API, generate them with Python/PIL:

```python
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import requests
from io import BytesIO

def generate_thumbnail(topic, style="dark_tech", text="SHOCKING TRUTH"):
    """Generate a high-CTR thumbnail with text overlay."""
    # Background color based on style
    colors = {
        "dark_tech": (10, 10, 30),     # deep blue-black
        "science": (5, 40, 80),         # dark blue
        "nature": (30, 60, 20),         # dark green
        "viral": (80, 10, 10),          # dark red
    }
    bg = colors.get(style, (20, 20, 20))
    
    img = Image.new("RGB", (1280, 720), bg)
    draw = ImageDraw.Draw(img)
    
    # Add gradient overlay
    for i in range(720):
        alpha = int(50 * (1 - i/720))
        overlay = Image.new("RGBA", (1280, 1), (255, 255, 255, alpha))
        img.paste(overlay, (0, i), overlay)
    
    # Add glow effect behind text
    glow = Image.new("RGBA", (1280, 720), (0, 0, 0, 0))
    draw_glow = ImageDraw.Draw(glow)
    # center glow circle
    center = (640, 360)
    for r in range(200, 50, -10):
        alpha = int(30 * (1 - r/200))
        draw_glow.ellipse(
            [center[0]-r, center[1]-r, center[0]+r, center[1]+r],
            fill=(255, 200, 50, alpha)
        )
    img = Image.alpha_composite(img.convert("RGBA"), glow).convert("RGB")
    draw = ImageDraw.Draw(img)
    
    # Text
    try:
        font_big = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 72)
        font_small = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 36)
    except:
        font_big = ImageFont.load_default()
        font_small = ImageFont.load_default()
    
    # Outline effect
    for dx, dy in [(-2,-2), (2,-2), (-2,2), (2,2)]:
        draw.text((640+dx, 300+dy), text, fill="black", font=font_big, anchor="mm")
    
    draw.text((640, 300), text, fill="white", font=font_big, anchor="mm")
    draw.text((640, 420), topic, fill="#cccccc", font=font_small, anchor="mm")
    
    path = f"/tmp/thumbnail_{int(time.time())}.png"
    img.save(path)
    return path
```

---

## 3. ENGAGE — Comment Automations + Welcome Sequences

### Comment-to-DM Automation

This is the **highest impact** growth tool available TODAY via Zernio:

```python
mcp_zernio_comment_automations_create_comment_automation(
    profile_id="69fdd9345bdb4cdb2139f370",
    account_id="69fdda4792b3d8e85f9bd63f",  # Facebook/Dulce Diaz Realtor
    name="Engagement Boost - Follow Prompt",
    keywords=[],  # empty = trigger on ALL comments
    match_mode="contains",
    dm_message="Thanks for engaging! 🚀 Follow for daily content that will blow your mind →",
    buttons=[
        {"type": "url", "text": "🔔 Subscribe", "url": "https://youtube.com/@aurorasadventureacademy"},
        {"type": "url", "text": "📱 TikTok", "url": "https://tiktok.com/@aiworkers_ai"}
    ],
    trigger="comment",
    link_tracking=True,
    click_tag="growth_engaged"
)
```

### Setup on Instagram/Facebook posts

```python
# Per-post automation (best for new uploads)
mcp_zernio_comment_automations_create_comment_automation(
    profile_id="...",
    account_id="...",
    platform_post_id="<ig_post_id_or_fb_post_id>",
    name=f"Post Engagement - {video_title[:30]}",
    dm_message="Glad you liked this! 🔥 We post daily — follow for more!",
    buttons=[{"type": "url", "text": "🎬 Watch More", "url": "https://youtube.com/@aurorasadventureacademy"}],
    trigger="comment",
    link_tracking=True
)
```

### Engagement Hooks to Include in Video Descriptions

Add these CTAs in your Shorts descriptions:
```
👇 Comment "🔥" if you agree!
Follow for more daily content 🚀
Which one blew your mind? 1, 2, or 3?
Tag someone who needs to see this!
```

---

## 4. CROSSPOST — Multi-Platform Publishing

Already handled by the daily cron via Zernio (each post targets both YouTube + TikTok).

### Future: Add Instagram Reels + Facebook
When you connect Instagram/Facebook accounts, update the platforms array:

```python
platforms=[
    {"platform": "youtube", "accountId": "6a20cf602b2567671abd8a9a", ...},
    {"platform": "tiktok", "accountId": "6a2559222b2567671a0f439d"},
    {"platform": "instagram", "accountId": "<instagram_account_id>"},
    {"platform": "facebook", "accountId": "69fdda4792b3d8e85f9bd63f"},
]
```

---

## 5. REPORT — Weekly Growth Digest

### Command: Run Weekly Report

```python
def weekly_growth_report(platform="youtube"):
    """Generate a growth report for the past 7 days."""
    
    if platform == "youtube":
        data = mcp_zernio_analytics_get_analytics(
            account_id="6a20cf602b2567671abd8a9a",
            from_date="7_days_ago",
            sort_by="engagement"
        )
    elif platform == "tiktok":
        data = mcp_zernio_analytics_get_tik_tok_account_insights(
            account_id="6a2559222b2567671a0f439d"
        )
    
    # Format report
    report = f"""
📈 WEEKLY GROWTH REPORT — Aurora's Adventure Academy
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎥 Top Video: {top_title}
   Views: {views} | Likes: {likes} | Engagement: {engagement_rate}%

📊 Channel Stats:
   • Subscribers: {subs} (Δ{delta_subs})
   • Total Views: {total_views}
   • Avg Views/Video: {avg_views}

🏆 Best Performing:
   1. {video1_title} — {video1_views} views
   2. {video2_title} — {video2_views} views
   3. {video3_title} — {video3_views} views

💡 Recommendations:
   • {rec1}
   • {rec2}
   • {rec3}

🎯 Next Week Focus:
   • {focus}
"""
    return report
```

---

## Growth Checklist (Weekly)

- [ ] Run Zernio analytics on YouTube + TikTok
- [ ] Identify top 3 performing videos — analyze WHY they worked
- [ ] Web search trending topics + hashtags for next batch
- [ ] Check comment automation logs — are they triggering?
- [ ] Review subscriber/follower growth rate
- [ ] Generate new AI thumbnails for underperforming videos
- [ ] Cross-post best performer to platforms not yet covered
- [ ] Send weekly growth report

---

## Quick-Start: Set Up Comment Automations NOW

```bash
# 1. Get your profile ID
mcp_zernio_profiles_list

# 2. Get your Facebook/Instagram account ID
mcp_zernio_accounts_get platform="facebook"

# 3. Create an account-wide automation (fires on EVERY comment)
mcp_zernio_comment_automations_create_comment_automation \
    profile_id="<your_profile_id>" \
    account_id="<your_account_id>" \
    name="Growth Engine - Auto Follow" \
    dm_message="Thanks for engaging! 🚀 Follow for daily mind-blowing content!" \
    trigger="comment"

# 4. Verify it's active
mcp_zernio_comment_automations_list_comment_automations \
    profile_id="<your_profile_id>"
```

---

## Pitfalls

1. **YouTube rate limits** — 429 errors on publish. Always stagger by 32+ min or use scheduledFor
2. **TikTok processing delay** — TikToks take 1-5 min to go live after publishing
3. **Comment automation limits** — Meta caps DMs to non-followers. Best results come from having followers first
4. **Thumbnail generation on CPU** — PIL is fast but complex text rendering can be slow
5. **Analytics lag** — YouTube data has 2-3 day delay. TikTok is near real-time
6. **Over-auto DMing** — too many DMs can get your account flagged. Keep it conversational, not spammy
7. **Content quality > quantity** — 5 great videos > 10 mediocre ones. Don't sacrifice quality for volume

---

## Zernio Account IDs Reference

| Platform | Username | Account ID |
|---|---|---|
| YouTube | aurorasadventureacademy | `6a20cf602b2567671abd8a9a` |
| TikTok | aiworkers_ai | `6a2559222b2567671a0f439d` |
| Facebook | Dulce Diaz Realtor | `69fdda4792b3d8e85f9bd63f` |
| Pinterest | dulcediaz0146 | `69fddc0f92b3d8e85f9bea9e` |
