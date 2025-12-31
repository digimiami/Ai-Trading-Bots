
import { supabase } from '../lib/supabase';

export function useTracking() {
  const trackEvent = async (eventType: 'signup' | 'payment' | 'page_view') => {
    try {
      const { data: scripts, error } = await supabase
        .from('tracking_scripts')
        .select('script_content')
        .eq('event_type', eventType)
        .eq('is_active', true);

      if (error) {
        console.error(`Error fetching tracking scripts for ${eventType}:`, error);
        return;
      }

      if (!scripts || scripts.length === 0) {
        console.log(`No active tracking scripts found for ${eventType}`);
        return;
      }

      console.log(`🚀 Executing ${scripts.length} tracking scripts for ${eventType}`);

      scripts.forEach((script) => {
        try {
          // Method 1: Inject as a script tag
          const div = document.createElement('div');
          div.innerHTML = script.script_content;
          
          // Execute any script tags inside the content
          const scriptsInContent = div.querySelectorAll('script');
          scriptsInContent.forEach((oldScript) => {
            const newScript = document.createElement('script');
            Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
            newScript.appendChild(document.createTextNode(oldScript.innerHTML));
            oldScript.parentNode?.replaceChild(newScript, oldScript);
          });

          // Append the content to the body (hidden)
          div.style.display = 'none';
          document.body.appendChild(div);
          
          // Cleanup after execution (optional, scripts remain in memory)
          setTimeout(() => {
            document.body.removeChild(div);
          }, 5000);

        } catch (execError) {
          console.error(`Error executing tracking script:`, execError);
        }
      });
    } catch (err) {
      console.error(`Tracking system error for ${eventType}:`, err);
    }
  };

  return { trackEvent };
}

