/**
 * Cookie Consent Utility Functions
 * 
 * Use these functions to check and manage cookie consent throughout the app.
 */

export type ConsentStatus = 'accepted' | 'declined' | null;

/**
 * Get the current cookie consent status
 */
export function getCookieConsent(): ConsentStatus {
  const consent = localStorage.getItem('cookie_consent');
  if (consent === 'accepted') return 'accepted';
  if (consent === 'declined') return 'declined';
  return null;
}

/**
 * Check if user has accepted cookies
 */
export function hasAcceptedCookies(): boolean {
  return getCookieConsent() === 'accepted';
}

/**
 * Check if user has declined cookies
 */
export function hasDeclinedCookies(): boolean {
  return getCookieConsent() === 'declined';
}

/**
 * Check if user has made a choice about cookies
 */
export function hasCookieConsent(): boolean {
  return getCookieConsent() !== null;
}

/**
 * Get the date when user made their cookie choice
 */
export function getCookieConsentDate(): Date | null {
  const dateStr = localStorage.getItem('cookie_consent_date');
  return dateStr ? new Date(dateStr) : null;
}

/**
 * Reset cookie consent (will show popup again)
 */
export function resetCookieConsent(): void {
  localStorage.removeItem('cookie_consent');
  localStorage.removeItem('cookie_consent_date');
}

/**
 * Track analytics event (only if user accepted cookies)
 * 
 * Example usage:
 * trackEvent('button_click', { button_name: 'start_trading' });
 */
export function trackEvent(eventName: string, eventData?: Record<string, any>): void {
  if (!hasAcceptedCookies()) {
    console.log('📊 Analytics disabled - user declined cookies');
    return;
  }

  // Add your Google Analytics tracking here
  // Example for Google Analytics 4:
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('event', eventName, eventData);
    console.log('📊 Analytics event tracked:', eventName, eventData);
  }
}

/**
 * Track page view (only if user accepted cookies)
 * 
 * Example usage:
 * trackPageView('/dashboard');
 */
export function trackPageView(pagePath: string): void {
  if (!hasAcceptedCookies()) {
    return;
  }

  // Add your Google Analytics tracking here
  // Example for Google Analytics 4:
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('config', 'YOUR_GA_MEASUREMENT_ID', {
      page_path: pagePath,
    });
    console.log('📊 Page view tracked:', pagePath);
  }
}

