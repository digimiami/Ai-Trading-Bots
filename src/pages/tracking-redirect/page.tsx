import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

export default function TrackingRedirectPage() {
  const { shortCode } = useParams<{ shortCode: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!shortCode) {
      setError('Invalid tracking code');
      setLoading(false);
      return;
    }

    handleRedirect(shortCode);
  }, [shortCode]);

  const handleRedirect = async (code: string) => {
    try {
      // Fetch tracking URL - try exact match first, then case-insensitive
      // This handles O/0, I/1 confusion
      let { data: trackingUrl, error: urlError } = await supabase
        .from('tracking_urls')
        .select('*')
        .eq('short_code', code)
        .single();

      // If not found, try case-insensitive search
      if (urlError && (urlError.code === 'PGRST116' || urlError.message?.includes('No rows'))) {
        const { data: trackingUrls, error: searchError } = await supabase
          .from('tracking_urls')
          .select('*');

        if (!searchError && trackingUrls) {
          // Find case-insensitive match
          trackingUrl = trackingUrls.find(
            (url: any) => url.short_code.toLowerCase() === code.toLowerCase()
          ) || null;
          urlError = trackingUrl ? null : { code: 'PGRST116', message: 'No rows found' };
        }
      }

      if (urlError) {
        console.error('Error fetching tracking URL:', urlError);
        // Check if it's a "not found" error or something else
        if (urlError.code === 'PGRST116' || urlError.message?.includes('No rows')) {
          setError(`Tracking URL not found for code: ${code}`);
        } else {
          setError(`Error loading tracking URL: ${urlError.message}`);
        }
        setLoading(false);
        return;
      }

      if (!trackingUrl) {
        console.error('Tracking URL not found:', code);
        setError(`Tracking URL not found for code: ${code}`);
        setLoading(false);
        return;
      }

      if (!trackingUrl.is_active) {
        setError('This tracking URL is inactive');
        setLoading(false);
        return;
      }

      // Check if expired
      if (trackingUrl.expires_at && new Date(trackingUrl.expires_at) < new Date()) {
        setError('This tracking URL has expired');
        setLoading(false);
        return;
      }

      // Get user if logged in
      const { data: { user } } = await supabase.auth.getUser();

      // Get session ID or create one
      let sessionId = sessionStorage.getItem(`tracking_session_${code}`);
      if (!sessionId) {
        sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        sessionStorage.setItem(`tracking_session_${code}`, sessionId);
      }

      // Extract data for tracking
      const urlParams = new URLSearchParams(window.location.search);
      const referrer = document.referrer || urlParams.get('ref') || null;

      // Get screen dimensions
      const screenWidth = window.screen.width;
      const screenHeight = window.screen.height;
      const language = navigator.language || (navigator as any).userLanguage;

      // Parse user agent
      const userAgent = navigator.userAgent;
      const deviceInfo = parseUserAgent(userAgent);

      // Get viewport dimensions (more accurate than screen)
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const devicePixelRatio = window.devicePixelRatio || 1;
      const colorDepth = screen.colorDepth || 24;
      const touchSupport = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      
      // Determine if mobile traffic
      const isMobileTraffic = deviceInfo.device_type === 'mobile' || viewportWidth < 768;

      // Extract UTM parameters from tracking URL config
      const utmSource = trackingUrl.source || urlParams.get('utm_source');
      const utmMedium = trackingUrl.medium || urlParams.get('utm_medium');
      const utmCampaign = trackingUrl.campaign_name || urlParams.get('utm_campaign');
      const utmContent = trackingUrl.content || urlParams.get('utm_content');
      const utmTerm = trackingUrl.term || urlParams.get('utm_term');

      // Track the click with enhanced data
      const { error: clickError } = await supabase
        .from('tracking_url_clicks')
        .insert({
          tracking_url_id: trackingUrl.id,
          user_agent: userAgent,
          referrer: referrer,
          device_type: deviceInfo.device_type,
          browser: deviceInfo.browser,
          browser_version: deviceInfo.browser_version,
          os: deviceInfo.os,
          os_version: deviceInfo.os_version,
          screen_width: screenWidth,
          screen_height: screenHeight,
          viewport_width: viewportWidth,
          viewport_height: viewportHeight,
          device_pixel_ratio: devicePixelRatio,
          color_depth: colorDepth,
          touch_support: touchSupport,
          language: language,
          utm_source: utmSource,
          utm_medium: utmMedium,
          utm_campaign: utmCampaign,
          utm_content: utmContent,
          utm_term: utmTerm,
          is_mobile_traffic: isMobileTraffic,
          landing_page_url: window.location.href,
          is_unique_visit: true, // Will be checked on backend
          session_id: sessionId,
          user_id: user?.id || null
        });

      if (clickError) {
        console.error('Error tracking click:', clickError);
        // Continue with redirect even if tracking fails
      }

      // Build destination URL with UTM parameters
      // Ensure destination_url is a valid absolute URL
      let destinationUrlString = trackingUrl.destination_url;
      if (!destinationUrlString.startsWith('http://') && !destinationUrlString.startsWith('https://')) {
        // If relative URL, prepend current origin
        destinationUrlString = window.location.origin + (destinationUrlString.startsWith('/') ? '' : '/') + destinationUrlString;
      }
      
      const destinationUrl = new URL(destinationUrlString);
      
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

      // Preserve original query params
      urlParams.forEach((value, key) => {
        if (!destinationUrl.searchParams.has(key)) {
          destinationUrl.searchParams.set(key, value);
        }
      });

      // Redirect immediately - use replace to avoid back button issues
      // Set loading to false to prevent error state
      setLoading(false);
      window.location.replace(destinationUrl.toString());

    } catch (err: any) {
      console.error('Redirect error:', err);
      setError(err.message || 'Failed to redirect');
      setLoading(false);
    }
  };

  const parseUserAgent = (userAgent: string) => {
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
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <i className="ri-loader-4-line animate-spin text-4xl text-blue-600 mb-4"></i>
          <p className="text-gray-600">Redirecting to destination...</p>
          <p className="text-sm text-gray-500 mt-2">Please wait...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md p-6">
          <i className="ri-error-warning-line text-4xl text-red-600 mb-4"></i>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Tracking URL Error</h1>
          <p className="text-gray-600 mb-4">{error}</p>
          <a href="/" className="text-blue-600 hover:text-blue-800 underline">
            Return to Home
          </a>
        </div>
      </div>
    );
  }

  return null;
}

