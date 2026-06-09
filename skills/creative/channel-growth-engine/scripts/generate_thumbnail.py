#!/usr/bin/env python3
"""Generate high-CTR thumbnails for YouTube Shorts using PIL."""

from PIL import Image, ImageDraw, ImageFont, ImageFilter
import time, os, textwrap

STYLES = {
    "dark_tech": {"bg": (10, 10, 30), "accent": (0, 150, 255), "glow": (0, 100, 255)},
    "science":   {"bg": (5, 40, 80), "accent": (50, 200, 255), "glow": (0, 150, 200)},
    "nature":    {"bg": (20, 50, 20), "accent": (100, 255, 50), "glow": (50, 200, 0)},
    "viral":     {"bg": (80, 10, 10), "accent": (255, 200, 0), "glow": (255, 150, 0)},
    "space":     {"bg": (15, 5, 40), "accent": (150, 50, 255), "glow": (100, 0, 200)},
    "finance":   {"bg": (10, 40, 20), "accent": (0, 255, 100), "glow": (0, 200, 50)},
}

def generate_thumbnail(topic, main_text=None, style="dark_tech", output_dir="/tmp"):
    """Generate a YouTube Shorts thumbnail (1280x720)."""
    s = STYLES.get(style, STYLES["dark_tech"])
    bg_color = s["bg"]
    accent = s["accent"]
    glow_color = s["glow"]
    
    img = Image.new("RGB", (1280, 720), bg_color)
    draw = ImageDraw.Draw(img)
    
    # Gradient overlay (dark at bottom)
    for i in range(720):
        alpha = int(40 * (1 - i/720))
        overlay = Image.new("RGBA", (1280, 1), (0, 0, 0, alpha))
        img.paste(overlay, (0, i), overlay)
    
    # Glow circle in center
    center = (640, 360)
    for r in range(250, 30, -15):
        a = int(20 * (1 - r/250))
        draw.ellipse(
            [center[0]-r, center[1]-r, center[0]+r, center[1]+r],
            fill=(*glow_color, a) if len(glow_color)==3 else glow_color
        )
    
    # Load fonts
    try:
        font_big = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 80)
        font_sub = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 36)
        font_tag = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 28)
    except:
        font_big = ImageFont.load_default()
        font_sub = ImageFont.load_default()
        font_tag = ImageFont.load_default()
    
    text = (main_text or topic).upper()
    
    # Draw outline
    for dx, dy in [(-3,-3), (3,-3), (-3,3), (3,3)]:
        draw.text((640+dx, 280+dy), text, fill="black", font=font_big, anchor="mm")
    
    # Main text
    draw.text((640, 280), text, fill="white", font=font_big, anchor="mm")
    
    # Subtitle
    draw.text((640, 400), topic, fill=(200, 200, 200), font=font_sub, anchor="mm")
    
    # Tag badge
    tag = style.upper().replace("_", " ")
    draw.rounded_rectangle([540, 470, 740, 510], radius=8, fill=(*accent, 200) if len(accent)==3 else accent)
    draw.text((640, 490), f"#{tag}", fill="white", font=font_tag, anchor="mm")
    
    path = f"{output_dir}/thumb_{int(time.time())}.png"
    img.save(path)
    return path

if __name__ == "__main__":
    import sys
    topic = sys.argv[1] if len(sys.argv) > 1 else "Amazing Fact"
    style = sys.argv[2] if len(sys.argv) > 2 else "dark_tech"
    path = generate_thumbnail(topic, style=style)
    print(f"✅ Thumbnail saved: {path}")
