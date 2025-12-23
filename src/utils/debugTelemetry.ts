/**
 * Debug Telemetry Utility
 * 
 * This utility handles debug/telemetry calls to a local analytics service.
 * These calls are disabled in production or when the service is not available.
 */

const DEBUG_TELEMETRY_ENABLED = 
  import.meta.env.DEV && 
  import.meta.env.VITE_ENABLE_DEBUG_TELEMETRY === 'true';

const TELEMETRY_ENDPOINT = 'http://127.0.0.1:7242/ingest';

/**
 * Send debug telemetry data (only in development if enabled)
 * This will silently fail if the service is not available
 */
export function sendDebugTelemetry(
  endpointId: string,
  data: {
    location: string;
    message: string;
    data?: any;
    timestamp?: number;
    sessionId?: string;
    runId?: string;
    hypothesisId?: string;
  }
): void {
  // Only send if explicitly enabled in development
  if (!DEBUG_TELEMETRY_ENABLED) {
    return;
  }

  // Silently fail if service is not available
  if (typeof window === 'undefined') {
    return;
  }

  const payload = {
    location: data.location,
    message: data.message,
    data: data.data || {},
    timestamp: data.timestamp || Date.now(),
    sessionId: data.sessionId || 'debug-session',
    runId: data.runId || 'default',
    hypothesisId: data.hypothesisId || 'default',
  };

  fetch(`${TELEMETRY_ENDPOINT}/${endpointId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => {
    // Silently ignore errors - service may not be running
  });
}

