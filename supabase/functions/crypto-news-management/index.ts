import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Check if user is admin
    const { data: userData, error: userError } = await supabaseClient
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (userError || userData?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Parse request body
    let body: any = {}
    let action: string | null = null
    let params: any = {}
    
    try {
      if (req.method === 'POST' || req.method === 'PUT') {
        const bodyText = await req.text()
        if (bodyText) {
          body = JSON.parse(bodyText)
          action = body.action
          params = { ...body }
          delete params.action
        }
      } else if (req.method === 'GET') {
        const url = new URL(req.url)
        action = url.searchParams.get('action')
        params = Object.fromEntries(url.searchParams.entries())
      }
    } catch (e) {
      return new Response(JSON.stringify({ 
        error: 'Invalid request body',
        details: e.message 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (!action) {
      return new Response(JSON.stringify({ error: 'Action parameter required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    switch (action) {
      case 'generateArticle': {
        const { keywords, title, category = 'general' } = params

        if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
          return new Response(JSON.stringify({
            error: 'Keywords array is required'
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        // Get DeepSeek API key from environment or use provided fallback
        const DEEPSEEK_API_KEY = Deno.env.get('DEEPSEEK_API_KEY') || 'sk-1140f2af061a4ff8a2caea2e81b449bd'
        
        console.log('🔑 DeepSeek API Key check:', {
          hasEnvKey: !!Deno.env.get('DEEPSEEK_API_KEY'),
          hasFallback: !!DEEPSEEK_API_KEY,
          keyLength: DEEPSEEK_API_KEY?.length || 0
        })
        
        if (!DEEPSEEK_API_KEY) {
          return new Response(JSON.stringify({
            error: 'DeepSeek API key not configured. Please set DEEPSEEK_API_KEY in Edge Function secrets.'
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        // Build prompt for article generation
        const keywordsStr = keywords.join(', ')
        const prompt = `Write a comprehensive, SEO-optimized cryptocurrency news article.

Title: ${title || `Crypto News: ${keywordsStr}`}

Keywords to focus on: ${keywordsStr}
Category: ${category}

Requirements:
1. Write a professional, engaging article (800-1500 words)
2. Include the keywords naturally throughout the article
3. Write in a journalistic style suitable for a crypto news website
4. Include relevant statistics, trends, and analysis
5. Make it SEO-friendly with proper headings and structure
6. Include an engaging introduction and conclusion
7. Use markdown formatting for headings, lists, and emphasis

Return the article content in markdown format.`;

        try {
          console.log('📝 Generating article with DeepSeek:', {
            keywords: keywordsStr,
            title: title || 'Auto-generated',
            category: category
          })

          // Call DeepSeek API
          const deepseekResponse = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
            },
            body: JSON.stringify({
              model: 'deepseek-chat',
              messages: [
                {
                  role: 'system',
                  content: 'You are an expert cryptocurrency journalist and SEO content writer. Write engaging, informative, and SEO-optimized articles about cryptocurrency and blockchain technology.'
                },
                {
                  role: 'user',
                  content: prompt
                }
              ],
              temperature: 0.7,
              max_tokens: 4000
            })
          })

          console.log('📡 DeepSeek API response status:', deepseekResponse.status)

          if (!deepseekResponse.ok) {
            const errorText = await deepseekResponse.text()
            console.error('DeepSeek API error:', errorText)
            return new Response(JSON.stringify({
              error: 'Failed to generate article',
              details: errorText
            }), {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
          }

          const deepseekData = await deepseekResponse.json()
          const generatedContent = deepseekData.choices?.[0]?.message?.content || ''

          if (!generatedContent) {
            return new Response(JSON.stringify({
              error: 'No content generated from DeepSeek API'
            }), {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
          }

          // Extract title and content
          const articleTitle = title || `Crypto News: ${keywordsStr}`
          const content = generatedContent

          // Generate excerpt (first 200 characters)
          const excerpt = content.substring(0, 200).replace(/\n/g, ' ').trim() + '...'

          // Calculate reading time (200 words per minute)
          const wordCount = content.split(/\s+/).length
          const readingTime = Math.max(1, Math.ceil(wordCount / 200))

          return new Response(JSON.stringify({
            success: true,
            article: {
              title: articleTitle,
              content: content,
              excerpt: excerpt,
              keywords: keywords,
              category: category,
              reading_time: readingTime
            }
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        } catch (error: any) {
          console.error('Error generating article:', error)
          return new Response(JSON.stringify({
            error: 'Failed to generate article',
            details: error?.message || String(error)
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
      }

      case 'getArticles': {
        const { status, limit = 50, offset = 0 } = params

        let query = supabaseClient
          .from('crypto_news_articles')
          .select('*')
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1)

        if (status) {
          query = query.eq('status', status)
        }

        const { data: articles, error: articlesError } = await query

        if (articlesError) throw articlesError

        return new Response(JSON.stringify({ articles: articles || [] }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      case 'getArticle': {
        const { id, slug } = params

        if (!id && !slug) {
          return new Response(JSON.stringify({
            error: 'Article ID or slug is required'
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        let query = supabaseClient
          .from('crypto_news_articles')
          .select('*')
          .single()

        if (id) {
          query = query.eq('id', id)
        } else {
          query = query.eq('slug', slug)
        }

        const { data: article, error: articleError } = await query

        if (articleError) throw articleError

        return new Response(JSON.stringify({ article }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      case 'createArticle': {
        const {
          title,
          content,
          excerpt,
          keywords,
          category,
          status = 'draft',
          meta_title,
          meta_description,
          meta_keywords,
          og_title,
          og_description,
          og_image_url,
          twitter_card,
          twitter_title,
          twitter_description,
          canonical_url,
          featured_image_url,
          tags
        } = params

        if (!title || !content) {
          return new Response(JSON.stringify({
            error: 'Title and content are required'
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        // Generate slug from title
        const slug = title.toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')

        // Check if slug exists, append number if needed
        let finalSlug = slug
        let counter = 1
        while (true) {
          const { data: existing } = await supabaseClient
            .from('crypto_news_articles')
            .select('id')
            .eq('slug', finalSlug)
            .single()

          if (!existing) break
          finalSlug = `${slug}-${counter}`
          counter++
        }

        // Calculate reading time
        const wordCount = content.split(/\s+/).length
        const readingTime = Math.max(1, Math.ceil(wordCount / 200))

        const { data: article, error: createError } = await supabaseClient
          .from('crypto_news_articles')
          .insert({
            title,
            slug: finalSlug,
            content,
            excerpt: excerpt || content.substring(0, 200).replace(/\n/g, ' ').trim() + '...',
            keywords: keywords || [],
            category: category || 'general',
            status,
            author_id: user.id,
            meta_title: meta_title || title,
            meta_description: meta_description || excerpt || content.substring(0, 160).replace(/\n/g, ' ').trim(),
            meta_keywords: meta_keywords || keywords || [],
            og_title: og_title || title,
            og_description: og_description || excerpt || content.substring(0, 200).replace(/\n/g, ' ').trim(),
            og_image_url,
            twitter_card: twitter_card || 'summary_large_image',
            twitter_title: twitter_title || title,
            twitter_description: twitter_description || excerpt || content.substring(0, 200).replace(/\n/g, ' ').trim(),
            canonical_url,
            featured_image_url,
            tags: tags || [],
            reading_time: readingTime,
            published_at: status === 'published' ? new Date().toISOString() : null
          })
          .select()
          .single()

        if (createError) throw createError

        return new Response(JSON.stringify({
          success: true,
          article
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      case 'updateArticle': {
        const {
          id,
          title,
          content,
          excerpt,
          keywords,
          category,
          status,
          meta_title,
          meta_description,
          meta_keywords,
          og_title,
          og_description,
          og_image_url,
          twitter_card,
          twitter_title,
          twitter_description,
          canonical_url,
          featured_image_url,
          tags
        } = params

        if (!id) {
          return new Response(JSON.stringify({
            error: 'Article ID is required'
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        const updateData: any = {}

        if (title) {
          updateData.title = title
          // Regenerate slug if title changed
          const slug = title.toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
          updateData.slug = slug
        }
        if (content !== undefined) {
          updateData.content = content
          // Recalculate reading time
          const wordCount = content.split(/\s+/).length
          updateData.reading_time = Math.max(1, Math.ceil(wordCount / 200))
        }
        if (excerpt !== undefined) updateData.excerpt = excerpt
        if (keywords !== undefined) updateData.keywords = keywords
        if (category !== undefined) updateData.category = category
        if (status !== undefined) {
          updateData.status = status
          if (status === 'published' && !updateData.published_at) {
            updateData.published_at = new Date().toISOString()
          }
        }
        if (meta_title !== undefined) updateData.meta_title = meta_title
        if (meta_description !== undefined) updateData.meta_description = meta_description
        if (meta_keywords !== undefined) updateData.meta_keywords = meta_keywords
        if (og_title !== undefined) updateData.og_title = og_title
        if (og_description !== undefined) updateData.og_description = og_description
        if (og_image_url !== undefined) updateData.og_image_url = og_image_url
        if (twitter_card !== undefined) updateData.twitter_card = twitter_card
        if (twitter_title !== undefined) updateData.twitter_title = twitter_title
        if (twitter_description !== undefined) updateData.twitter_description = twitter_description
        if (canonical_url !== undefined) updateData.canonical_url = canonical_url
        if (featured_image_url !== undefined) updateData.featured_image_url = featured_image_url
        if (tags !== undefined) updateData.tags = tags

        const { data: article, error: updateError } = await supabaseClient
          .from('crypto_news_articles')
          .update(updateData)
          .eq('id', id)
          .select()
          .single()

        if (updateError) throw updateError

        return new Response(JSON.stringify({
          success: true,
          article
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      case 'deleteArticle': {
        const { id } = params

        if (!id) {
          return new Response(JSON.stringify({
            error: 'Article ID is required'
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        const { error: deleteError } = await supabaseClient
          .from('crypto_news_articles')
          .delete()
          .eq('id', id)

        if (deleteError) throw deleteError

        return new Response(JSON.stringify({
          success: true,
          message: 'Article deleted successfully'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      case 'publishArticle': {
        const { id } = params

        if (!id) {
          return new Response(JSON.stringify({
            error: 'Article ID is required'
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        const { data: article, error: updateError } = await supabaseClient
          .from('crypto_news_articles')
          .update({
            status: 'published',
            published_at: new Date().toISOString()
          })
          .eq('id', id)
          .select()
          .single()

        if (updateError) throw updateError

        return new Response(JSON.stringify({
          success: true,
          article
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }

  } catch (error) {
    console.error('Crypto news management error:', error)
    return new Response(JSON.stringify({ 
      error: error?.message || 'Internal server error',
      details: String(error)
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

