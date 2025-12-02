import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
  'Access-Control-Max-Age': '86400',
}

// Function to get featured image URL from multiple sources with fallbacks
// Generates unique images based on keywords to avoid all articles having the same image
function getFeaturedImageUrl(keywords: string, category: string = 'general'): string {
  // Clean and prepare search terms - use full keywords string for uniqueness
  const searchTerm = keywords.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim() || category || 'cryptocurrency'
  
  // Create a unique seed based on the entire keywords string
  // This ensures different keyword combinations produce different images
  const seed = searchTerm.split('').reduce((acc, char, index) => {
    return acc + (char.charCodeAt(0) * (index + 1))
  }, 0)
  
  // Use Picsum Photos with a unique seed that combines keywords and category
  // Same keywords will always get the same image, but different keywords get different images
  // Adding timestamp component would make it random, but we want consistency for same keywords
  const uniqueSeed = `crypto-${seed}-${category.toLowerCase()}-${searchTerm.substring(0, 10).replace(/\s+/g, '-')}`
  
  return `https://picsum.photos/seed/${uniqueSeed}/1200/630`
}

// Function to find and link related articles based on keywords and tags
async function findAndLinkRelatedArticles(
  supabaseClient: any,
  articleId: string,
  keywords: string[],
  tags: string[],
  category: string,
  maxRelated: number = 5
): Promise<void> {
  try {
    // Normalize keywords and tags for matching
    const normalizedKeywords = keywords.map(k => k.toLowerCase().trim())
    const normalizedTags = tags.map(t => t.toLowerCase().trim())
    const allSearchTerms = [...normalizedKeywords, ...normalizedTags, category.toLowerCase()]
    
    // Find related articles by matching keywords, tags, or category
    const { data: allArticles, error: fetchError } = await supabaseClient
      .from('crypto_news_articles')
      .select('id, keywords, tags, category, title, slug, published_at')
      .neq('id', articleId) // Exclude current article
      .eq('status', 'published') // Only link to published articles
      .order('published_at', { ascending: false, nullsFirst: false })
      .limit(100) // Get a larger pool to score from

    if (fetchError || !allArticles) {
      console.warn('Error fetching articles for linking:', fetchError)
      return
    }

    // Score articles based on keyword/tag matches
    const scoredArticles = allArticles.map((article: any) => {
      const articleKeywords = (article.keywords || []).map((k: string) => k.toLowerCase().trim())
      const articleTags = (article.tags || []).map((t: string) => t.toLowerCase().trim())
      const articleCategory = (article.category || '').toLowerCase()
      
      let score = 0
      
      // Exact keyword matches (higher weight)
      normalizedKeywords.forEach(keyword => {
        if (articleKeywords.includes(keyword)) score += 3
        if (articleTags.includes(keyword)) score += 2
      })
      
      // Tag matches
      normalizedTags.forEach(tag => {
        if (articleTags.includes(tag)) score += 2
        if (articleKeywords.includes(tag)) score += 1
      })
      
      // Category match
      if (articleCategory === category.toLowerCase()) {
        score += 1
      }
      
      // Partial keyword matches (lower weight)
      normalizedKeywords.forEach(keyword => {
        articleKeywords.forEach((ak: string) => {
          if (ak.includes(keyword) || keyword.includes(ak)) score += 0.5
        })
      })
      
      return { ...article, score }
    })
    
    // Sort by score and get top matches
    const relatedArticles = scoredArticles
      .filter((a: any) => a.score > 0)
      .sort((a: any, b: any) => b.score - a.score)
      .slice(0, maxRelated)
      .map((a: any) => ({
        id: a.id,
        title: a.title,
        slug: a.slug,
        score: a.score
      }))

    if (relatedArticles.length === 0) {
      console.log(`No related articles found for article ${articleId}`)
      return
    }

    // Update current article with related articles
    const { error: updateError } = await supabaseClient
      .from('crypto_news_articles')
      .update({ 
        related_articles: relatedArticles.map((a: any) => a.id)
      })
      .eq('id', articleId)

    if (updateError) {
      console.error('Error updating related articles:', updateError)
      return
    }

    // Also update the related articles to link back to this one (bidirectional linking)
    for (const relatedArticle of relatedArticles) {
      const { data: existingArticle } = await supabaseClient
        .from('crypto_news_articles')
        .select('related_articles')
        .eq('id', relatedArticle.id)
        .single()

      const existingRelated = existingArticle?.related_articles || []
      const updatedRelated = Array.isArray(existingRelated) 
        ? [...new Set([...existingRelated, articleId])] // Add current article, remove duplicates
        : [articleId]

      // Limit to maxRelated to prevent too many links
      if (updatedRelated.length > maxRelated) {
        updatedRelated.splice(maxRelated)
      }

      await supabaseClient
        .from('crypto_news_articles')
        .update({ related_articles: updatedRelated })
        .eq('id', relatedArticle.id)
    }

    console.log(`✅ Linked ${relatedArticles.length} related articles to article ${articleId}`)
  } catch (error: any) {
    console.error('Error in findAndLinkRelatedArticles:', error)
  }
}

// Helper function to generate article for a keyword (used by auto-posting)
async function generateArticleForKeyword(
  supabaseClient: any,
  keywords: string[],
  category: string,
  autoPublish: boolean,
  authorId: string | null
): Promise<{ success: boolean; article?: any; error?: string }> {
  try {
    const DEEPSEEK_API_KEY = Deno.env.get('DEEPSEEK_API_KEY') || 'sk-1140f2af061a4ff8a2caea2e81b449bd'
    
    if (!DEEPSEEK_API_KEY) {
      return { success: false, error: 'DeepSeek API key not configured' }
    }

    const keywordsStr = keywords.join(', ')
    const prompt = `Write a comprehensive, SEO-optimized cryptocurrency news article.

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

Return the article content in markdown format.`

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

    if (!deepseekResponse.ok) {
      const errorText = await deepseekResponse.text()
      return { success: false, error: `DeepSeek API error: ${deepseekResponse.status}` }
    }

    const deepseekData = await deepseekResponse.json()
    const generatedContent = deepseekData.choices?.[0]?.message?.content || ''

    if (!generatedContent) {
      return { success: false, error: 'No content generated from DeepSeek API' }
    }

    // Extract title from content (first line or generate from keywords)
    const firstLine = generatedContent.split('\n')[0].replace(/^#+\s*/, '').trim()
    const articleTitle = firstLine.length > 10 ? firstLine : `Crypto News: ${keywordsStr}`
    const content = generatedContent
    const excerpt = content.substring(0, 200).replace(/\n/g, ' ').trim() + '...'
    const wordCount = content.split(/\s+/).length
    const readingTime = Math.max(1, Math.ceil(wordCount / 200))

    // Generate slug
    const slug = articleTitle.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 100)

    // Auto-generate comprehensive SEO meta tags
    const metaTitle = articleTitle.length > 60 ? articleTitle.substring(0, 57) + '...' : articleTitle
    const metaDescription = excerpt.length > 160 ? excerpt.substring(0, 157) + '...' : excerpt
    const metaKeywords = [...keywords, category, 'crypto', 'cryptocurrency', 'blockchain', 'trading', 'news']
      .map(k => k.toLowerCase())
      .filter((v, i, a) => a.indexOf(v) === i)
    
    // Open Graph tags
    const ogTitle = metaTitle
    const ogDescription = metaDescription
    // Generate featured image URL based on keywords and category
    const imageKeywords = keywords.slice(0, 3).join(',') || category || 'cryptocurrency'
    const featuredImageUrl = getFeaturedImageUrl(imageKeywords, category)
    const ogImageUrl = featuredImageUrl // Use same image for OG
    
    // Twitter Card tags
    const twitterCard = 'summary_large_image'
    const twitterTitle = metaTitle
    const twitterDescription = metaDescription
    
    // Canonical URL (will be set when article is published)
    const baseUrl = Deno.env.get('SITE_URL') || 'https://your-site.com'
    const canonicalUrl = `${baseUrl}/crypto-news/${slug}`
    
    // Auto-generate tags
    const autoTags = [
      ...keywords.map(k => k.toLowerCase()),
      category.toLowerCase(),
      'crypto',
      'cryptocurrency',
      'blockchain',
      'trading',
      'news',
      'analysis'
    ].filter((v, i, a) => a.indexOf(v) === i)

    // Create article with ALL SEO meta tags auto-filled
    const articleData: any = {
      title: articleTitle,
      slug: slug + '-' + Date.now(), // Ensure uniqueness
      content: content,
      excerpt: excerpt,
      keywords: keywords,
      category: category,
      reading_time: readingTime,
      // All SEO Meta Tags - Auto-filled
      meta_title: metaTitle,
      meta_description: metaDescription,
      meta_keywords: metaKeywords,
      // Open Graph Tags
      og_title: ogTitle,
      og_description: ogDescription,
      og_image_url: ogImageUrl,
      // Twitter Card Tags
      twitter_card: twitterCard,
      twitter_title: twitterTitle,
      twitter_description: twitterDescription,
      // Canonical URL
      canonical_url: canonicalUrl,
      // Featured Image (based on keywords)
      featured_image_url: featuredImageUrl,
      // Tags
      tags: autoTags,
      // Status
      status: autoPublish ? 'published' : 'draft',
      published_at: autoPublish ? new Date().toISOString() : null
    }

    if (authorId) {
      articleData.author_id = authorId
    }

    const { data: article, error: createError } = await supabaseClient
      .from('crypto_news_articles')
      .insert(articleData)
      .select()
      .single()

    if (createError) {
      return { success: false, error: createError.message }
    }

    // Auto-link related articles if article is published
    if (autoPublish && article) {
      await findAndLinkRelatedArticles(
        supabaseClient,
        article.id,
        keywords,
        autoTags,
        category
      )
    }

    return { success: true, article }
  } catch (error: any) {
    return { success: false, error: error.message || String(error) }
  }
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

    // Parse request to check action (clone request body for reuse)
    let body: any = {}
    let action: string | null = null
    let params: any = {}
    let bodyText: string | null = null
    
    try {
      if (req.method === 'POST' || req.method === 'PUT') {
        bodyText = await req.text()
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
      console.error('Error parsing request:', e)
      // Continue - might be a public action
    }

    // Public actions that don't require authentication
    const publicActions = ['getPublishedArticles', 'getPublishedArticle']
    const isPublicAction = action && publicActions.includes(action)

    // Skip auth check for public actions
    if (!isPublicAction) {
      // Check authentication for non-public actions
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
    }

    if (isPublicAction) {
      // Use service role for public access to published articles
      const { status, limit = 50, offset = 0, slug } = params

      if (action === 'getPublishedArticles') {
        const { data: articles, error: articlesError } = await supabaseClient
          .from('crypto_news_articles')
          .select('*')
          .eq('status', 'published')
          .order('published_at', { ascending: false, nullsFirst: false })
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1)

        if (articlesError) {
          console.error('Error fetching published articles:', articlesError)
          return new Response(JSON.stringify({ 
            error: 'Failed to fetch articles',
            details: articlesError.message 
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        return new Response(JSON.stringify({ articles: articles || [] }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      if (action === 'getPublishedArticle') {
        if (!slug) {
          return new Response(JSON.stringify({ error: 'Slug is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        const { data: article, error: articleError } = await supabaseClient
          .from('crypto_news_articles')
          .select('*')
          .eq('slug', slug)
          .eq('status', 'published')
          .single()

        if (articleError || !article) {
          return new Response(JSON.stringify({ 
            error: 'Article not found',
            details: articleError?.message 
          }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        return new Response(JSON.stringify({ article }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    }

    // All other actions require admin authentication
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

    // If action not found and not public, try to parse again (shouldn't happen but safety check)
    if (!action && !isPublicAction) {
      console.error('❌ No action provided in request')
      return new Response(JSON.stringify({ 
        error: 'Action parameter required',
        receivedBody: body,
        method: req.method
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log('📋 Processing action:', action, 'Params:', Object.keys(params || {}))

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
            console.error('❌ DeepSeek API error:', {
              status: deepseekResponse.status,
              statusText: deepseekResponse.statusText,
              errorText
            })
            return new Response(JSON.stringify({
              error: 'Failed to generate article from DeepSeek API',
              details: errorText,
              status: deepseekResponse.status
            }), {
              status: 500,
              headers: { 
                ...corsHeaders, 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
              }
            })
          }

          const deepseekData = await deepseekResponse.json()
          console.log('✅ DeepSeek API response received:', {
            hasChoices: !!deepseekData.choices,
            choicesLength: deepseekData.choices?.length || 0
          })

          const generatedContent = deepseekData.choices?.[0]?.message?.content || ''

          if (!generatedContent) {
            console.error('❌ No content in DeepSeek response:', deepseekData)
            return new Response(JSON.stringify({
              error: 'No content generated from DeepSeek API',
              details: 'DeepSeek API returned empty content. Response: ' + JSON.stringify(deepseekData).substring(0, 200)
            }), {
              status: 500,
              headers: { 
                ...corsHeaders, 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
              }
            })
          }

          console.log('✅ Generated content length:', generatedContent.length)

          // Extract title and content
          const articleTitle = title || `Crypto News: ${keywordsStr}`
          const content = generatedContent

          // Generate excerpt (first 200 characters)
          const excerpt = content.substring(0, 200).replace(/\n/g, ' ').trim() + '...'

          // Calculate reading time (200 words per minute)
          const wordCount = content.split(/\s+/).length
          const readingTime = Math.max(1, Math.ceil(wordCount / 200))

          // Auto-generate comprehensive SEO meta tags
          const metaTitle = (title || articleTitle).length > 60 
            ? (title || articleTitle).substring(0, 57) + '...' 
            : (title || articleTitle)
          const metaDescription = excerpt.length > 160 ? excerpt.substring(0, 157) + '...' : excerpt
          const metaKeywords = [...keywords, category, 'crypto', 'cryptocurrency', 'blockchain', 'trading', 'news']
            .map(k => k.toLowerCase())
            .filter((v, i, a) => a.indexOf(v) === i)
          
          // Open Graph tags
          const ogTitle = metaTitle
          const ogDescription = metaDescription
          // Generate featured image URL based on keywords and category
          const imageKeywords = keywords.slice(0, 3).join(',') || category || 'cryptocurrency'
          const featuredImageUrl = getFeaturedImageUrl(imageKeywords, category)
          const ogImageUrl = featuredImageUrl // Use same image for OG
          
          // Twitter Card tags
          const twitterCard = 'summary_large_image'
          const twitterTitle = metaTitle
          const twitterDescription = metaDescription
          
          // Canonical URL (will be set when article is published)
          const baseUrl = Deno.env.get('SITE_URL') || 'https://your-site.com'
          const slug = (title || articleTitle).toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .substring(0, 100)
          const canonicalUrl = `${baseUrl}/crypto-news/${slug}`
          
          // Generate tags from keywords and category
          const autoTags = [
            ...keywords.map(k => k.toLowerCase()),
            category.toLowerCase(),
            'crypto',
            'cryptocurrency',
            'blockchain',
            'trading',
            'news',
            'analysis'
          ].filter((v, i, a) => a.indexOf(v) === i) // Remove duplicates

          return new Response(JSON.stringify({
            success: true,
            article: {
              title: articleTitle,
              content: content,
              excerpt: excerpt,
              keywords: keywords,
              category: category,
              reading_time: readingTime,
              // All SEO Meta Tags - Auto-filled
              meta_title: metaTitle,
              meta_description: metaDescription,
              meta_keywords: metaKeywords,
              // Open Graph Tags
              og_title: ogTitle,
              og_description: ogDescription,
              og_image_url: ogImageUrl,
              // Twitter Card Tags
              twitter_card: twitterCard,
              twitter_title: twitterTitle,
              twitter_description: twitterDescription,
              // Canonical URL
              canonical_url: canonicalUrl,
              // Featured Image (based on keywords)
              featured_image_url: featuredImageUrl,
              // Tags
              tags: autoTags
            }
          }), {
            status: 200,
            headers: { 
              ...corsHeaders, 
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          })
        } catch (error: any) {
          console.error('❌ Error generating article:', error)
          console.error('❌ Error stack:', error?.stack)
          return new Response(JSON.stringify({
            error: 'Failed to generate article',
            details: error?.message || String(error),
            type: error?.name || 'UnknownError'
          }), {
            status: 500,
            headers: { 
              ...corsHeaders, 
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
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

        // Auto-link related articles if article is published
        if (article && status === 'published') {
          await findAndLinkRelatedArticles(
            supabaseClient,
            article.id,
            keywords || [],
            tags || [],
            category || 'general'
          )
        }

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

        // Auto-link related articles if article is published or just became published
        if (article && (status === 'published' || article.status === 'published')) {
          const articleKeywords = keywords !== undefined ? keywords : article.keywords || []
          const articleTags = tags !== undefined ? tags : article.tags || []
          const articleCategory = category !== undefined ? category : article.category || 'general'
          
          await findAndLinkRelatedArticles(
            supabaseClient,
            id,
            articleKeywords,
            articleTags,
            articleCategory
          )
        }

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

        // Auto-link related articles when publishing
        if (article) {
          const articleKeywords = article.keywords || []
          const articleTags = article.tags || []
          const articleCategory = article.category || 'general'
          
          await findAndLinkRelatedArticles(
            supabaseClient,
            id,
            articleKeywords,
            articleTags,
            articleCategory
          )
        }

        return new Response(JSON.stringify({
          success: true,
          article
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      case 'getKeywordLists': {
        const { data: keywordLists, error: keywordError } = await supabaseClient
          .from('auto_posting_keywords')
          .select('*')
          .order('created_at', { ascending: false })

        if (keywordError) throw keywordError

        return new Response(JSON.stringify({
          success: true,
          keywordLists: keywordLists || []
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      case 'createKeywordList': {
        const { name, keywords, category, enabled, frequency_hours, auto_publish, max_articles_per_run } = params

        if (!name || !keywords || !Array.isArray(keywords) || keywords.length === 0) {
          return new Response(JSON.stringify({
            error: 'Name and keywords array are required'
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        const { data: keywordList, error: createError } = await supabaseClient
          .from('auto_posting_keywords')
          .insert({
            name,
            keywords,
            category: category || 'general',
            enabled: enabled !== undefined ? enabled : true,
            frequency_hours: frequency_hours || 24,
            auto_publish: auto_publish !== undefined ? auto_publish : false,
            max_articles_per_run: max_articles_per_run || 1,
            created_by: user.id
          })
          .select()
          .single()

        if (createError) throw createError

        return new Response(JSON.stringify({
          success: true,
          keywordList
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      case 'updateKeywordList': {
        const { id, name, keywords, category, enabled, frequency_hours, auto_publish, max_articles_per_run } = params

        if (!id) {
          return new Response(JSON.stringify({
            error: 'Keyword list ID is required'
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        const updateData: any = {}
        if (name !== undefined) updateData.name = name
        if (keywords !== undefined) updateData.keywords = keywords
        if (category !== undefined) updateData.category = category
        if (enabled !== undefined) updateData.enabled = enabled
        if (frequency_hours !== undefined) updateData.frequency_hours = frequency_hours
        if (auto_publish !== undefined) updateData.auto_publish = auto_publish
        if (max_articles_per_run !== undefined) updateData.max_articles_per_run = max_articles_per_run

        const { data: keywordList, error: updateError } = await supabaseClient
          .from('auto_posting_keywords')
          .update(updateData)
          .eq('id', id)
          .select()
          .single()

        if (updateError) throw updateError

        return new Response(JSON.stringify({
          success: true,
          keywordList
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      case 'deleteKeywordList': {
        const { id } = params

        if (!id) {
          return new Response(JSON.stringify({
            error: 'Keyword list ID is required'
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        const { error: deleteError } = await supabaseClient
          .from('auto_posting_keywords')
          .delete()
          .eq('id', id)

        if (deleteError) throw deleteError

        return new Response(JSON.stringify({
          success: true,
          message: 'Keyword list deleted successfully'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      case 'runAutoPosting': {
        // This action can be called by scheduled functions (no auth required if called with service role)
        // Check if this is a scheduled call (has x-cron-secret header)
        const cronSecret = req.headers.get('x-cron-secret')
        const expectedSecret = Deno.env.get('CRON_SECRET')
        
        // If called with valid cron secret, use service role (already set)
        // Otherwise, require user authentication
        if (!(cronSecret && expectedSecret && cronSecret === expectedSecret) && !user) {
          return new Response(JSON.stringify({
            error: 'Unauthorized - requires authentication or valid cron secret'
          }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        // Get all enabled keyword lists that are due for generation
        const now = new Date()
        const { data: keywordLists, error: keywordError } = await supabaseClient
          .from('auto_posting_keywords')
          .select('*')
          .eq('enabled', true)

        if (keywordError) throw keywordError

        const results = []
        
        for (const keywordList of keywordLists || []) {
          // Check if it's time to generate articles
          const lastGenerated = keywordList.last_generated_at 
            ? new Date(keywordList.last_generated_at) 
            : null
          const hoursSinceLastGeneration = lastGenerated
            ? (now.getTime() - lastGenerated.getTime()) / (1000 * 60 * 60)
            : Infinity

          if (hoursSinceLastGeneration < keywordList.frequency_hours) {
            console.log(`⏭️ Skipping ${keywordList.name} - not due yet (${hoursSinceLastGeneration.toFixed(1)}h < ${keywordList.frequency_hours}h)`)
            continue
          }

          // Generate articles for this keyword list
          const articlesToGenerate = Math.min(
            keywordList.max_articles_per_run || 1,
            keywordList.keywords.length
          )

          for (let i = 0; i < articlesToGenerate; i++) {
            const keyword = keywordList.keywords[i % keywordList.keywords.length]
            
            try {
              // Generate article using existing generateArticle logic
              const generateResult = await generateArticleForKeyword(
                supabaseClient,
                [keyword],
                keywordList.category,
                keywordList.auto_publish,
                user?.id || null
              )

              if (generateResult.success) {
                results.push({
                  keywordList: keywordList.name,
                  keyword,
                  articleId: generateResult.article?.id,
                  status: 'success'
                })
              } else {
                results.push({
                  keywordList: keywordList.name,
                  keyword,
                  status: 'error',
                  error: generateResult.error
                })
              }
            } catch (error: any) {
              console.error(`❌ Error generating article for keyword ${keyword}:`, error)
              results.push({
                keywordList: keywordList.name,
                keyword,
                status: 'error',
                error: error.message
              })
            }
          }

          // Update last_generated_at
          await supabaseClient
            .from('auto_posting_keywords')
            .update({ last_generated_at: now.toISOString() })
            .eq('id', keywordList.id)
        }

        return new Response(JSON.stringify({
          success: true,
          results,
          message: `Processed ${results.length} articles`
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      default:
        console.error('❌ Invalid action received:', action, 'Available actions:', [
          'generateArticle', 'getArticles', 'getArticle', 'createArticle', 
          'updateArticle', 'deleteArticle', 'publishArticle',
          'getKeywordLists', 'createKeywordList', 'updateKeywordList', 
          'deleteKeywordList', 'runAutoPosting'
        ])
        return new Response(JSON.stringify({ 
          error: 'Invalid action',
          receivedAction: action,
          availableActions: [
            'generateArticle', 'getArticles', 'getArticle', 'createArticle', 
            'updateArticle', 'deleteArticle', 'publishArticle',
            'getKeywordLists', 'createKeywordList', 'updateKeywordList', 
            'deleteKeywordList', 'runAutoPosting'
          ]
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }

  } catch (error: any) {
    console.error('❌ Crypto news management error:', error)
    console.error('❌ Error stack:', error?.stack)
    console.error('❌ Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error)))
    
    // Ensure CORS headers are always included
    return new Response(JSON.stringify({ 
      error: error?.message || 'Internal server error',
      details: error?.details || String(error),
      stack: error?.stack
    }), {
      status: 500,
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE'
      }
    })
  }
})

