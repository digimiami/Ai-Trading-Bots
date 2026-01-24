import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

serve(async (req) => {
  // Handle CORS preflight requests FIRST
  if (req.method === 'OPTIONS') {
    try {
      return new Response(null, { 
        status: 204,
        headers: {
          ...corsHeaders,
          'Access-Control-Max-Age': '86400',
        }
      })
    } catch (error) {
      console.error(`❌ Error in OPTIONS handler:`, error);
      return new Response(null, { 
        status: 204,
        headers: corsHeaders
      })
    }
  }

  // Allow GET and POST methods
  if (req.method !== 'GET' && req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  try {
    // This is a read-only operation that doesn't expose actual API keys
    // We only return availability status, so authentication is optional
    // But try to get user if auth header is present (for logging)
    const authHeader = req.headers.get('Authorization');
    
    console.log('🔍 [check-ai-keys] Request received:');
    console.log(`   Method: ${req.method}`);
    console.log(`   URL: ${req.url}`);
    console.log(`   Authorization header present: ${!!authHeader}`);
    
    // Optional: Verify authentication if header is provided (for logging only)
    if (authHeader) {
      try {
        const supabaseClient = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_ANON_KEY') ?? '',
          { global: { headers: { Authorization: authHeader } } }
        )

        const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
        
        if (user) {
          console.log(`✅ Authenticated as user: ${user.id}`);
        } else if (authError) {
          console.log(`⚠️ Auth check failed (continuing anyway): ${authError.message}`);
        }
      } catch (authErr) {
        console.log('⚠️ Auth check error (continuing anyway):', authErr);
      }
    } else {
      console.log('ℹ️ No auth header - proceeding with public availability check');
    }

    // Check if AI API keys are configured in Edge Function secrets
    // We only return availability status, NOT the actual keys
    const openAIKey = Deno.env.get('OPENAI_API_KEY') || Deno.env.get('VITE_OPENAI_API_KEY') || '';
    const deepSeekKey = Deno.env.get('DEEPSEEK_API_KEY') || Deno.env.get('VITE_DEEPSEEK_API_KEY') || '';

    // Debug logging (values are masked for security)
    console.log('🔍 [check-ai-keys] Checking secrets:');
    console.log(`   OPENAI_API_KEY present: ${!!Deno.env.get('OPENAI_API_KEY')}`);
    console.log(`   VITE_OPENAI_API_KEY present: ${!!Deno.env.get('VITE_OPENAI_API_KEY')}`);
    console.log(`   DEEPSEEK_API_KEY present: ${!!Deno.env.get('DEEPSEEK_API_KEY')}`);
    console.log(`   VITE_DEEPSEEK_API_KEY present: ${!!Deno.env.get('VITE_DEEPSEEK_API_KEY')}`);
    console.log(`   OpenAI key length: ${openAIKey.length}`);
    console.log(`   DeepSeek key length: ${deepSeekKey.length}`);
    
    // List all env vars that start with DEEP or OPENAI (for debugging)
    const allEnvKeys = Object.keys(Deno.env.toObject());
    const aiRelatedKeys = allEnvKeys.filter(k => k.includes('DEEP') || k.includes('OPENAI') || k.includes('AI'));
    console.log(`   All AI-related env keys: ${aiRelatedKeys.join(', ')}`);

    const response = {
      openai: {
        available: !!openAIKey,
        configured: !!openAIKey
      },
      deepseek: {
        available: !!deepSeekKey,
        configured: !!deepSeekKey
      },
      debug: {
        openaiKeyLength: openAIKey.length,
        deepseekKeyLength: deepSeekKey.length,
        openaiKeyPresent: !!Deno.env.get('OPENAI_API_KEY'),
        deepseekKeyPresent: !!Deno.env.get('DEEPSEEK_API_KEY'),
        viteOpenaiKeyPresent: !!Deno.env.get('VITE_OPENAI_API_KEY'),
        viteDeepseekKeyPresent: !!Deno.env.get('VITE_DEEPSEEK_API_KEY')
      }
    };

    console.log('✅ [check-ai-keys] Response:', JSON.stringify(response, null, 2));

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error: any) {
    console.error('Error checking AI keys:', error)
    return new Response(JSON.stringify({ 
      error: error.message,
      openai: { available: false, configured: false },
      deepseek: { available: false, configured: false }
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

