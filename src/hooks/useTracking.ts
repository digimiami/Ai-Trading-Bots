
import { supabase } from '../lib/supabase';

export function useTracking() {
  const trackEvent = async (eventType: 'signup' | 'payment' | 'page_view') => {
    try {
      console.log(`🔍 Fetching tracking scripts for event: ${eventType}`);
      
      const { data: scripts, error } = await supabase
        .from('tracking_scripts')
        .select('id, name, script_content, event_type, is_active')
        .eq('event_type', eventType)
        .eq('is_active', true);

      if (error) {
        console.error(`❌ Error fetching tracking scripts for ${eventType}:`, error);
        console.error('Error details:', {
          message: error.message,
          code: error.code,
          hint: error.hint
        });
        return;
      }

      if (!scripts || scripts.length === 0) {
        console.log(`ℹ️ No active tracking scripts found for event type: ${eventType}`);
        console.log('💡 Tip: Create a tracking script in Admin Panel > Tracking Codes');
        return;
      }
      
      console.log(`✅ Found ${scripts.length} active tracking script(s) for ${eventType}:`, 
        scripts.map(s => ({ id: s.id, name: s.name }))
      );

      console.log(`🚀 Executing ${scripts.length} tracking scripts for ${eventType}`);

      scripts.forEach((script, index) => {
        try {
          console.log(`📝 Processing script ${index + 1}/${scripts.length} for ${eventType}`);
          
          // Create a temporary container to parse the HTML
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = script.script_content;
          
          // Find all script tags in the content
          const scriptTags = tempDiv.querySelectorAll('script');
          
          if (scriptTags.length > 0) {
            // Process each script tag
            scriptTags.forEach((oldScript) => {
              const newScript = document.createElement('script');
              
              // Copy all attributes
              Array.from(oldScript.attributes).forEach(attr => {
                newScript.setAttribute(attr.name, attr.value);
              });
              
              // Set script content
              if (oldScript.src) {
                newScript.src = oldScript.src;
              } else {
                newScript.textContent = oldScript.textContent;
              }
              
              // Append to head or body (prefer head for tracking scripts)
              document.head.appendChild(newScript);
              
              console.log(`✅ Injected script tag:`, {
                hasSrc: !!oldScript.src,
                src: oldScript.src || 'inline',
                attributes: Array.from(oldScript.attributes).map(a => `${a.name}="${a.value}"`).join(', ')
              });
            });
          } else {
            // No script tags found, try to execute as inline code
            // This handles cases where script_content is just JavaScript code
            try {
              const scriptContent = script.script_content.trim();
              if (scriptContent) {
                // Check if it looks like a script tag (might be missing <script> wrapper)
                if (scriptContent.includes('<script') || scriptContent.includes('</script>')) {
                  // It has script tags but querySelector didn't find them, try direct injection
                  const wrapper = document.createElement('div');
                  wrapper.innerHTML = scriptContent;
                  const scriptsInWrapper = wrapper.querySelectorAll('script');
                  
                  scriptsInWrapper.forEach((s) => {
                    const newScript = document.createElement('script');
                    Array.from(s.attributes).forEach(attr => {
                      newScript.setAttribute(attr.name, attr.value);
                    });
                    if (s.src) {
                      newScript.src = s.src;
                    } else {
                      newScript.textContent = s.textContent;
                    }
                    document.head.appendChild(newScript);
                    console.log(`✅ Injected script from wrapper`);
                  });
                } else {
                  // Pure JavaScript code, execute directly
                  const newScript = document.createElement('script');
                  newScript.textContent = scriptContent;
                  document.head.appendChild(newScript);
                  console.log(`✅ Executed inline JavaScript code`);
                }
              }
            } catch (inlineError) {
              console.error(`Error executing inline script:`, inlineError);
            }
          }
          
          // Also append any non-script content (like noscript tags, comments, etc.)
          const nonScriptContent = Array.from(tempDiv.childNodes).filter(node => {
            return node.nodeType !== 1 || (node as Element).tagName !== 'SCRIPT';
          });
          
          if (nonScriptContent.length > 0) {
            const contentDiv = document.createElement('div');
            contentDiv.style.display = 'none';
            nonScriptContent.forEach(node => {
              contentDiv.appendChild(node.cloneNode(true));
            });
            document.body.appendChild(contentDiv);
            
            // Cleanup after a delay
            setTimeout(() => {
              if (contentDiv.parentNode) {
                contentDiv.parentNode.removeChild(contentDiv);
              }
            }, 10000);
          }

        } catch (execError) {
          console.error(`❌ Error executing tracking script ${index + 1}:`, execError);
          console.error('Script content:', script.script_content.substring(0, 200));
        }
      });
      
      console.log(`✅ Finished executing tracking scripts for ${eventType}`);
    } catch (err) {
      console.error(`Tracking system error for ${eventType}:`, err);
    }
  };

  return { trackEvent };
}

