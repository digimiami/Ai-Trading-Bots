import { lazy, ComponentType } from 'react';

/**
 * Creates a lazy-loaded component with retry logic for failed chunk loads
 * This helps handle 404 errors when chunks fail to load
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  retries = 3,
  delay = 1000
): React.LazyExoticComponent<T> {
  return lazy(async () => {
    let lastError: Error | null = null;
    
    for (let i = 0; i < retries; i++) {
      try {
        const module = await importFn();
        return module;
      } catch (error) {
        lastError = error as Error;
        console.warn(`Failed to load chunk (attempt ${i + 1}/${retries}):`, error);
        
        // Only retry if it's a network/chunk loading error
        if (
          error instanceof TypeError ||
          (error as Error).message?.includes('Failed to fetch') ||
          (error as Error).message?.includes('dynamically imported module')
        ) {
          if (i < retries - 1) {
            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
            continue;
          }
        }
        
        // If it's not a retryable error or we've exhausted retries, throw
        throw error;
      }
    }
    
    // If we get here, all retries failed
    throw lastError || new Error('Failed to load module after retries');
  });
}
