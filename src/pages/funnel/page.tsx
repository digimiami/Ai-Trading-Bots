import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { trackEvent } from '../../utils/cookieConsent'

interface FunnelPage {
  id: string
  funnel_id: string
  name: string
  slug: string
  page_type: string
  html_content: string
  meta_title?: string | null
  meta_description?: string | null
  custom_css?: string | null
  custom_js?: string | null
  redirect_url?: string | null
}

export default function FunnelPageViewer() {
  const { funnelSlug, pageSlug } = useParams<{ funnelSlug: string; pageSlug: string }>()
  const [page, setPage] = useState<FunnelPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (funnelSlug && pageSlug) {
      loadPage()
    }
  }, [funnelSlug, pageSlug])

  useEffect(() => {
    if (page) {
      // Track page view
      trackPageView()
      
      // Set meta tags
      if (page.meta_title) {
        document.title = page.meta_title
      }
      if (page.meta_description) {
        const metaDesc = document.querySelector('meta[name="description"]')
        if (metaDesc) {
          metaDesc.setAttribute('content', page.meta_description)
        } else {
          const meta = document.createElement('meta')
          meta.name = 'description'
          meta.content = page.meta_description
          document.head.appendChild(meta)
        }
      }
    }
  }, [page])

  const loadPage = async () => {
    try {
      setLoading(true)
      setError(null)

      // Get funnel
      const { data: funnelData, error: funnelError } = await supabase
        .from('funnels')
        .select('id')
        .eq('slug', funnelSlug)
        .eq('is_active', true)
        .single()

      if (funnelError || !funnelData) {
        throw new Error('Funnel not found')
      }

      // Get page
      const { data: pageData, error: pageError } = await supabase
        .from('funnel_pages')
        .select('*')
        .eq('funnel_id', funnelData.id)
        .eq('slug', pageSlug)
        .eq('is_active', true)
        .single()

      if (pageError || !pageData) {
        throw new Error('Page not found')
      }

      setPage(pageData)

      // Handle redirect if set
      if (pageData.redirect_url) {
        // Track redirect event
        trackEvent('funnel_redirect', {
          funnel_id: funnelData.id,
          page_id: pageData.id,
          redirect_url: pageData.redirect_url
        })
        // Redirect after a short delay to allow tracking
        setTimeout(() => {
          window.location.href = pageData.redirect_url!
        }, 100)
      }
    } catch (err: any) {
      console.error('Error loading page:', err)
      setError(err.message || 'Page not found')
    } finally {
      setLoading(false)
    }
  }

  const trackPageView = async () => {
    if (!page) return

    try {
      // Get session ID
      let sessionId = sessionStorage.getItem('funnel_session_id')
      if (!sessionId) {
        sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        sessionStorage.setItem('funnel_session_id', sessionId)
      }

      // Get user if logged in
      const { data: { user } } = await supabase.auth.getUser()

      // Get UTM parameters
      const urlParams = new URLSearchParams(window.location.search)
      const utmSource = urlParams.get('utm_source')
      const utmMedium = urlParams.get('utm_medium')
      const utmCampaign = urlParams.get('utm_campaign')

      // Track page view
      const { error } = await supabase
        .from('funnel_page_views')
        .insert({
          page_id: page.id,
          funnel_id: page.funnel_id,
          user_id: user?.id || null,
          session_id: sessionId,
          ip_address: null, // Will be set by database if needed
          user_agent: navigator.userAgent,
          referrer: document.referrer || null,
          utm_source: utmSource,
          utm_medium: utmMedium,
          utm_campaign: utmCampaign
        })

      if (error) {
        console.error('Error tracking page view:', error)
      }

      // Track with analytics
      trackEvent('funnel_page_view', {
        funnel_id: page.funnel_id,
        page_id: page.id,
        page_type: page.page_type
      })
    } catch (err) {
      console.error('Error tracking page view:', err)
    }
  }

  const handleClick = (event: React.MouseEvent) => {
    if (!page) return

    // Track click event
    const target = event.target as HTMLElement
    const isButton = target.tagName === 'BUTTON' || target.closest('button')
    const isLink = target.tagName === 'A' || target.closest('a')

    if (isButton || isLink) {
      trackEvent('funnel_click', {
        funnel_id: page.funnel_id,
        page_id: page.id,
        element: target.tagName,
        text: target.textContent?.substring(0, 50) || ''
      })

      // Track in database
      supabase
        .from('funnel_page_events')
        .insert({
          page_id: page.id,
          funnel_id: page.funnel_id,
          event_type: 'click',
          event_data: {
            element: target.tagName,
            text: target.textContent?.substring(0, 100) || ''
          }
        })
        .catch(console.error)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading page...</p>
        </div>
      </div>
    )
  }

  if (error || !page) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Page Not Found</h1>
          <p className="text-gray-600">{error || 'The page you are looking for does not exist.'}</p>
        </div>
      </div>
    )
  }

  return (
    <div onClick={handleClick} style={{ minHeight: '100vh', width: '100%' }}>
      <style>{`
        body { margin: 0; padding: 0; }
        * { box-sizing: border-box; }
      `}</style>
      {page.custom_css && (
        <style dangerouslySetInnerHTML={{ __html: page.custom_css }} />
      )}
      <div dangerouslySetInnerHTML={{ __html: page.html_content }} />
      {page.custom_js && (
        <script dangerouslySetInnerHTML={{ __html: page.custom_js }} />
      )}
    </div>
  )
}

