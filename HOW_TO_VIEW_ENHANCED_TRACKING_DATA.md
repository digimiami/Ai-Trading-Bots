# 📊 How to View Enhanced Tracking Data

## Where to See the Enhanced Tracking Data

### 1. In the Admin Panel

1. **Navigate to Admin Panel**:
   - Go to `https://pablobots.com/admin`
   - Click on the **"Tracking URLs"** tab

2. **View Tracking URLs List**:
   - You'll see a table with all your tracking URLs
   - Each row shows: Name, Destination, Tracking URL, Campaign, Clicks, Status

3. **Click on a Tracking URL Row**:
   - Click anywhere on a tracking URL row (not the action buttons)
   - This opens the **Click Analytics** panel below the table

4. **View Enhanced Analytics**:

   **Metrics Dashboard** (top section):
   - ✅ **Total Clicks** - Total number of clicks
   - ✅ **Unique IPs** - Number of unique IP addresses
   - ✅ **Countries** - Number of different countries
   - 🆕 **Conversions** - Number of converted clicks
   - 🆕 **Bounces** - Number of single-page visits
   - 🆕 **Avg Session** - Average session duration in seconds

   **Detailed Click Table** (bottom section):
   - Date/Time
   - Country
   - City
   - Device Type
   - Browser
   - Operating System
   - 🆕 **UTM Source** - Campaign source
   - 🆕 **UTM Campaign** - Campaign name
   - 🆕 **Converted** - Shows conversion status with green badge
   - 🆕 **Pages** - Number of pages viewed
   - 🆕 **Duration** - Session duration in seconds
   - IP Address

### 2. Enhanced Data Fields Available

Once you run the migration (`ENHANCE_TRACKING_URLS_DATA_COLLECTION.sql`), the following enhanced fields will be collected:

- **Viewport dimensions** (viewport_width, viewport_height)
- **Device pixel ratio** (device_pixel_ratio)
- **Color depth** (color_depth)
- **Touch support** (touch_support)
- **UTM parameters** (utm_source, utm_medium, utm_campaign, utm_content, utm_term)
- **Conversion data** (converted, conversion_type, converted_at, time_to_conversion_seconds)
- **Behavioral data** (pages_viewed, session_duration_seconds, bounce, landing_page_url)
- **Mobile traffic flag** (is_mobile_traffic)

### 3. Current Display vs Enhanced Display

**Currently Displayed** (with current code):
- Basic metrics (clicks, IPs, countries, device types)
- Standard click table (date, location, device, browser, OS, IP)
- ✅ **NEW**: UTM Source and Campaign columns
- ✅ **NEW**: Conversion status column
- ✅ **NEW**: Pages viewed column
- ✅ **NEW**: Session duration column
- ✅ **NEW**: Enhanced metrics (conversions, bounces, avg session)

**Will Display** (after migration and new clicks):
- All of the above, plus data for new fields will populate as new clicks come in

### 4. Important Notes

⚠️ **Run the Migration First**:
- Execute `ENHANCE_TRACKING_URLS_DATA_COLLECTION.sql` in Supabase SQL Editor
- This adds the new columns to the database

⚠️ **Existing Clicks Won't Have Enhanced Data**:
- Only new clicks after the migration will have the enhanced fields populated
- Existing clicks will show `-` or empty for new fields

✅ **The Analytics Query Already Supports All Fields**:
- The query uses `select('*')` which automatically includes all columns
- No code changes needed - just run the migration

### 5. Refresh Button

- Click the **"Refresh"** button (🔄) next to "Create Tracking URL" to reload the data
- This updates the tracking URLs list and analytics

