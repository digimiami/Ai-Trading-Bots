# 📊 Enhanced Tracking URL Data Collection

## Currently Collected Data ✅

- IP address
- User agent
- Referrer
- Geographic: Country, Region, City, Timezone
- Device: Type, Browser, OS, Screen dimensions
- Language
- Session ID
- User ID (if logged in)
- Timestamp

---

## Recommended Additional Data to Collect 🚀

### 1. **Conversion Tracking** (HIGH PRIORITY)
Track if the click led to a conversion:
- `converted` (BOOLEAN) - Did they complete a goal?
- `conversion_type` (TEXT) - signup, purchase, form_submit, etc.
- `converted_at` (TIMESTAMP) - When conversion happened
- `time_to_conversion_seconds` (INTEGER) - Time from click to conversion

### 2. **Viewport & Display Details**
More precise display information:
- `viewport_width` (INTEGER) - Browser viewport width
- `viewport_height` (INTEGER) - Browser viewport height
- `device_pixel_ratio` (DECIMAL) - Retina/high-DPI detection
- `color_depth` (INTEGER) - Screen color depth (bits)
- `touch_support` (BOOLEAN) - Does device support touch?

### 3. **Navigation & Behavior**
Track user journey:
- `landing_page_url` (TEXT) - First page they visited
- `exit_page_url` (TEXT) - Last page before leaving
- `pages_viewed` (INTEGER) - Number of pages in session
- `session_duration_seconds` (INTEGER) - Total session time
- `bounce` (BOOLEAN) - Single page view = bounce

### 4. **Network & Connection**
Connection quality:
- `connection_type` (TEXT) - 4g, wifi, ethernet, etc. (if available)
- `downlink_speed` (DECIMAL) - Network speed (if available)

### 5. **Traffic Source Details**
Better source attribution:
- `utm_source` (TEXT) - Store separately for easier querying
- `utm_medium` (TEXT)
- `utm_campaign` (TEXT)
- `utm_content` (TEXT)
- `utm_term` (TEXT)
- `gclid` (TEXT) - Google Click ID (for Google Ads)
- `fbclid` (TEXT) - Facebook Click ID (for Facebook Ads)

### 6. **User Behavior Flags**
Quick behavioral indicators:
- `is_returning_visitor` (BOOLEAN) - Seen this IP/session before?
- `is_mobile_traffic` (BOOLEAN) - Quick mobile flag
- `is_bot` (BOOLEAN) - Bot detection (optional)

### 7. **Click Context** (If available)
- `click_position_x` (INTEGER) - X coordinate of click (for ads)
- `click_position_y` (INTEGER) - Y coordinate of click
- `click_timestamp` (BIGINT) - Precise click timestamp (milliseconds)

### 8. **A/B Testing & Variants**
- `variant_id` (TEXT) - A/B test variant identifier
- `experiment_id` (TEXT) - Experiment name/ID

---

## Implementation Priority

### Phase 1 (High Value, Easy to Implement) ⭐⭐⭐
1. Conversion tracking (converted, conversion_type, converted_at)
2. Viewport dimensions (viewport_width, viewport_height)
3. UTM parameters (store separately for easier querying)
4. Landing page URL
5. Session duration
6. Bounce detection

### Phase 2 (Medium Value, Moderate Effort) ⭐⭐
1. Device pixel ratio
2. Touch support
3. Return visitor detection
4. Pages viewed count
5. Connection type (if available)

### Phase 3 (Lower Priority, Advanced) ⭐
1. Click position coordinates
2. Color depth
3. A/B test variants
4. Exit page URL
5. Downlink speed

---

## Usage Examples

### Track Conversions
```sql
-- Update click when user signs up
UPDATE tracking_url_clicks 
SET converted = true, 
    conversion_type = 'signup',
    converted_at = NOW(),
    time_to_conversion_seconds = EXTRACT(EPOCH FROM (NOW() - clicked_at))
WHERE session_id = 'session_123' 
AND converted IS NULL;
```

### Analyze Campaign Performance
```sql
-- Campaign ROI by source
SELECT 
  utm_source,
  utm_campaign,
  COUNT(*) as clicks,
  COUNT(CASE WHEN converted THEN 1 END) as conversions,
  ROUND(100.0 * COUNT(CASE WHEN converted THEN 1 END) / COUNT(*), 2) as conversion_rate,
  AVG(time_to_conversion_seconds) as avg_time_to_convert
FROM tracking_url_clicks
WHERE clicked_at >= NOW() - INTERVAL '30 days'
GROUP BY utm_source, utm_campaign
ORDER BY conversions DESC;
```

### Mobile vs Desktop Performance
```sql
-- Compare mobile vs desktop conversions
SELECT 
  device_type,
  COUNT(*) as clicks,
  COUNT(CASE WHEN converted THEN 1 END) as conversions,
  AVG(session_duration_seconds) as avg_session_duration
FROM tracking_url_clicks
GROUP BY device_type;
```

