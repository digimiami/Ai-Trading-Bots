import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Simple IP geolocation using ipapi.co (free tier)
async function getGeoLocation(ip: string): Promise<{
  country?: string;
  region?: string;
  city?: string;
  timezone?: string;
}> {
  try {
    // Skip private/local IPs
    if (ip.startsWith('127.') || ip.startsWith('192.168.') || ip.startsWith('10.') || ip === '::1') {
      return {};
    }

    const response = await fetch(`https://ipapi.co/${ip}/json/`, {
      headers: {
        'User-Agent': 'Mozilla/5.0'
      }
    });
    
    if (!response.ok) {
      return {};
    }

    const data = await response.json();
    return {
      country: data.country_name || data.country_code,
      region: data.region || data.region_code,
      city: data.city,
      timezone: data.timezone
    };
  } catch (error) {
    console.error('Error fetching geo location:', error);
    return {};
  }
}

// Extract device info from user agent
function parseUserAgent(userAgent: string): {
  device_type: string;
  browser: string;
  browser_version: string;
  os: string;
  os_version: string;
} {
  const ua = userAgent.toLowerCase();
  
  // Device type
  let device_type = 'desktop';
  if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
    device_type = 'mobile';
  } else if (ua.includes('tablet') || ua.includes('ipad')) {
    device_type = 'tablet';
  }

  // Browser
  let browser = 'Unknown';
  let browser_version = '';
  if (ua.includes('chrome') && !ua.includes('edg')) {
    browser = 'Chrome';
    const match = ua.match(/chrome\/([\d.]+)/);
    browser_version = match ? match[1] : '';
  } else if (ua.includes('firefox')) {
    browser = 'Firefox';
    const match = ua.match(/firefox\/([\d.]+)/);
    browser_version = match ? match[1] : '';
  } else if (ua.includes('safari') && !ua.includes('chrome')) {
    browser = 'Safari';
    const match = ua.match(/version\/([\d.]+)/);
    browser_version = match ? match[1] : '';
  } else if (ua.includes('edg')) {
    browser = 'Edge';
    const match = ua.match(/edg\/([\d.]+)/);
    browser_version = match ? match[1] : '';
  }

  // OS
  let os = 'Unknown';
  let os_version = '';
  if (ua.includes('windows')) {
    os = 'Windows';
    if (ua.includes('windows nt 10')) os_version = '10';
    else if (ua.includes('windows nt 6.3')) os_version = '8.1';
    else if (ua.includes('windows nt 6.2')) os_version = '8';
    else if (ua.includes('windows nt 6.1')) os_version = '7';
  } else if (ua.includes('mac os x') || ua.includes('macintosh')) {
    os = 'macOS';
    const match = ua.match(/mac os x ([\d_]+)/);
    os_version = match ? match[1].replace(/_/g, '.') : '';
  } else if (ua.includes('linux')) {
    os = 'Linux';
  } else if (ua.includes('android')) {
    os = 'Android';
    const match = ua.match(/android ([\d.]+)/);
    os_version = match ? match[1] : '';
  } else if (ua.includes('iphone') || ua.includes('ipad')) {
    os = 'iOS';
    const match = ua.match(/os ([\d_]+)/);
    os_version = match ? match[1].replace(/_/g, '.') : '';
  }

  return {
    device_type,
    browser,
    browser_version,
    os,
    os_version
  };
}

// Get client IP from headers
function getClientIP(headers: Headers): string {
  // Check various headers for real IP (in case of proxies/CDN)
  const forwardedFor = headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  
  const realIP = headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }
  
  const cfConnectingIP = headers.get('cf-connecting-ip'); // Cloudflare
  if (cfConnectingIP) {
    return cfConnectingIP;
  }
  
  return 'unknown';
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const shortCode = url.pathname.split('/').pop();

    if (!shortCode) {
      return new Response('Invalid tracking URL', { status: 400, headers: corsHeaders });
    }

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch tracking URL from database
    const { data: trackingUrl, error: urlError } = await supabaseClient
      .from('tracking_urls')
      .select('*')
      .eq('short_code', shortCode)
      .single();

    if (urlError || !trackingUrl) {
      return new Response('Tracking URL not found', { status: 404, headers: corsHeaders });
    }

    if (!trackingUrl.is_active) {
      return new Response('Tracking URL is inactive', { status: 403, headers: corsHeaders });
    }

    // Check if expired
    if (trackingUrl.expires_at && new Date(trackingUrl.expires_at) < new Date()) {
      return new Response('Tracking URL has expired', { status: 403, headers: corsHeaders });
    }

    // Extract click data
    const ip = getClientIP(req.headers);
    const userAgent = req.headers.get('user-agent') || '';
    const referrer = req.headers.get('referer') || url.searchParams.get('ref') || null;
    
    // Get session ID from query params or generate one
    const sessionId = url.searchParams.get('session_id') || 
                     `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Parse user agent
    const deviceInfo = parseUserAgent(userAgent);

    // Get geographic location (async, but don't wait for it)
    const geoData = ip !== 'unknown' ? await getGeoLocation(ip) : {};

    // Check if this is a unique visit (same session_id + IP in last 24h)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recentClicks } = await supabaseClient
      .from('tracking_url_clicks')
      .select('id')
      .eq('tracking_url_id', trackingUrl.id)
      .eq('session_id', sessionId)
      .gte('clicked_at', oneDayAgo)
      .limit(1);

    const isUniqueVisit = !recentClicks || recentClicks.length === 0;

    // Record the click
    const { error: clickError } = await supabaseClient
      .from('tracking_url_clicks')
      .insert({
        tracking_url_id: trackingUrl.id,
        ip_address: ip !== 'unknown' ? ip : null,
        user_agent: userAgent,
        referrer: referrer,
        country: geoData.country,
        region: geoData.region,
        city: geoData.city,
        timezone: geoData.timezone,
        device_type: deviceInfo.device_type,
        browser: deviceInfo.browser,
        browser_version: deviceInfo.browser_version,
        os: deviceInfo.os,
        os_version: deviceInfo.os_version,
        is_unique_visit: isUniqueVisit,
        session_id: sessionId
      });

    if (clickError) {
      console.error('Error recording click:', clickError);
      // Don't fail the redirect, just log the error
    }

    // Build destination URL with UTM parameters
    const destinationUrl = new URL(trackingUrl.destination_url);
    
    // Add UTM parameters
    if (trackingUrl.source) destinationUrl.searchParams.set('utm_source', trackingUrl.source);
    if (trackingUrl.medium) destinationUrl.searchParams.set('utm_medium', trackingUrl.medium);
    if (trackingUrl.campaign_name) destinationUrl.searchParams.set('utm_campaign', trackingUrl.campaign_name);
    if (trackingUrl.content) destinationUrl.searchParams.set('utm_content', trackingUrl.content);
    if (trackingUrl.term) destinationUrl.searchParams.set('utm_term', trackingUrl.term);
    
    // Add custom parameters
    if (trackingUrl.custom_params && typeof trackingUrl.custom_params === 'object') {
      Object.entries(trackingUrl.custom_params).forEach(([key, value]) => {
        if (value) destinationUrl.searchParams.set(key, String(value));
      });
    }

    // Preserve original query params from the tracking URL
    url.searchParams.forEach((value, key) => {
      if (!destinationUrl.searchParams.has(key)) {
        destinationUrl.searchParams.set(key, value);
      }
    });

    // Redirect to destination URL
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        'Location': destinationUrl.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });

  } catch (error) {
    console.error('Tracking redirect error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

