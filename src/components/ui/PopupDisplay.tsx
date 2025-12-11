/**
 * Popup Display Component
 * Shows popups based on targeting rules
 */

import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'

interface Popup {
  id: string
  title: string
  content_type: 'image' | 'video' | 'html'
  content: string
  link_url?: string | null
  size: 'small' | 'medium' | 'large' | 'fullscreen'
  dismissible: boolean
}

export default function PopupDisplay() {
  const location = useLocation()
  const { user, loading: authLoading } = useAuth()
  const [popup, setPopup] = useState<Popup | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return
    fetchPopup()
  }, [location.pathname, user, authLoading])

  const fetchPopup = async () => {
    try {
      setLoading(true)
      
      // Get current user info
      const { data: { user: authUser } } = await supabase.auth.getUser()
      const isAuthenticated = !!authUser
      const currentPath = location.pathname

      // Check dismissed popups from localStorage
      const dismissedPopups = new Set<string>()
      try {
        const dismissed = localStorage.getItem('dismissed_popups')
        if (dismissed) {
          const dismissedArray = JSON.parse(dismissed)
          dismissedArray.forEach((id: string) => dismissedPopups.add(id))
        }
      } catch (e) {
        console.warn('Error loading dismissed popups:', e)
      }

      // Build query based on targeting
      const now = new Date().toISOString()
      let query = supabase
        .from('popups')
        .select('*')
        .eq('is_active', true)
        .or(`start_date.is.null,start_date.lte.${now}`)
        .or(`end_date.is.null,end_date.gte.${now}`)
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false })

      const { data: allPopups, error } = await query

      if (error) {
        // If table doesn't exist, just return silently
        if (error.code === 'PGRST116' || error.message?.includes('relation')) {
          setPopup(null)
          return
        }
        console.error('Error fetching popups:', error)
        return
      }

      if (!allPopups || allPopups.length === 0) {
        setPopup(null)
        return
      }

      // Filter popups based on targeting rules
      const eligiblePopups = allPopups.filter((p: any) => {
        // Check if user has already dismissed this popup
        if (dismissedPopups.has(p.id)) {
          return false
        }

        // Check target audience
        switch (p.target_audience) {
          case 'new_visitor':
            // Show to non-authenticated users
            return !isAuthenticated
          
          case 'all_users':
            // Show to everyone
            return true
          
          case 'new_user':
            // Show to authenticated users (new users)
            if (!isAuthenticated || !authUser) return false
            // Check if user is new (created within last 7 days)
            const userCreated = new Date(authUser.created_at)
            const daysSinceCreation = (Date.now() - userCreated.getTime()) / (1000 * 60 * 60 * 24)
            return daysSinceCreation <= 7
          
          case 'homepage':
            // Show only on homepage
            return currentPath === '/' || currentPath === '/dashboard'
          
          case 'members_only':
            // Show only to authenticated users
            return isAuthenticated
          
          case 'individual':
            // Show only to specific user
            return isAuthenticated && authUser && p.target_user_id === authUser.id
          
          default:
            return false
        }
      })

      // Check if popup should show on current page
      const pageFilteredPopups = eligiblePopups.filter((p: any) => {
        if (!p.show_on_pages || p.show_on_pages.length === 0) {
          // If no specific pages, show on all pages
          return true
        }
        // Check if current path matches any of the specified pages
        return p.show_on_pages.includes(currentPath)
      })

      if (pageFilteredPopups.length > 0) {
        // Get the highest priority popup
        const selectedPopup = pageFilteredPopups[0]
        setPopup(selectedPopup)
        
        // Increment show count
        try {
          await supabase.rpc('increment_popup_show_count', { popup_id: selectedPopup.id })
        } catch (e) {
          console.warn('Error incrementing show count:', e)
        }
      } else {
        setPopup(null)
      }
    } catch (err) {
      console.error('Error in fetchPopup:', err)
    } finally {
      setLoading(false)
    }
  }

  const trackPopupAction = async (popupId: string, userId: string, action: 'shown' | 'dismissed' | 'clicked') => {
    try {
      await supabase
        .from('popup_interactions')
        .insert({
          popup_id: popupId,
          user_id: userId,
          action
        })
        .select()
        .single()
    } catch (err) {
      // Ignore errors (might be duplicate or RLS issue)
      console.warn('Failed to track popup action:', err)
    }
  }

  const handleDismiss = async () => {
    if (!popup) return
    
    // Mark as dismissed in localStorage
    try {
      const dismissed = localStorage.getItem('dismissed_popups')
      const dismissedArray = dismissed ? JSON.parse(dismissed) : []
      if (!dismissedArray.includes(popup.id)) {
        dismissedArray.push(popup.id)
        localStorage.setItem('dismissed_popups', JSON.stringify(dismissedArray))
      }
    } catch (e) {
      console.error('Error saving dismissed popup:', e)
    }
    
    // Increment dismiss count
    try {
      await supabase.rpc('increment_popup_dismiss_count', { popup_id: popup.id })
    } catch (e) {
      console.warn('Error incrementing dismiss count:', e)
    }
    
    setPopup(null)
  }

  const handleClick = async () => {
    if (!popup || !popup.link_url) return
    
    // Track click
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (authUser) {
      trackPopupAction(popup.id, authUser.id, 'clicked')
    }
    
    // Open link
    window.open(popup.link_url, '_blank', 'noopener,noreferrer')
  }

  if (loading || !popup) return null

  const sizeClasses = {
    small: 'max-w-sm w-full',
    medium: 'max-w-2xl w-full',
    large: 'max-w-4xl w-full',
    fullscreen: 'w-full h-full max-w-none max-h-none m-0 rounded-none'
  }

  const sizeStyles = {
    small: { maxWidth: '400px' },
    medium: { maxWidth: '600px' },
    large: { maxWidth: '800px' },
    fullscreen: { width: '100%', height: '100%' }
  }

  const renderContent = () => {
    switch (popup.content_type) {
      case 'image':
        return (
          <img
            src={popup.content}
            alt={popup.title}
            className={`w-full h-auto ${popup.link_url ? 'cursor-pointer' : ''}`}
            onClick={popup.link_url ? handleClick : undefined}
            onError={(e) => {
              (e.target as HTMLImageElement).src = 'https://via.placeholder.com/400x300?text=Image+Not+Found'
            }}
          />
        )
      case 'video':
        // Check if it's a YouTube/Vimeo embed URL or direct video file
        const isEmbedUrl = popup.content.includes('youtube.com') || 
                          popup.content.includes('youtu.be') || 
                          popup.content.includes('vimeo.com')
        
        if (isEmbedUrl) {
          // Convert YouTube URL to embed format if needed
          let embedUrl = popup.content
          if (popup.content.includes('youtube.com/watch')) {
            const videoId = popup.content.split('v=')[1]?.split('&')[0]
            embedUrl = `https://www.youtube.com/embed/${videoId}`
          } else if (popup.content.includes('youtu.be/')) {
            const videoId = popup.content.split('youtu.be/')[1]?.split('?')[0]
            embedUrl = `https://www.youtube.com/embed/${videoId}`
          } else if (popup.content.includes('vimeo.com/')) {
            const videoId = popup.content.split('vimeo.com/')[1]?.split('?')[0]
            embedUrl = `https://player.vimeo.com/video/${videoId}`
          }
          
          return (
            <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
              <iframe
                src={embedUrl}
                className="absolute top-0 left-0 w-full h-full rounded-lg"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title={popup.title || 'Popup video'}
              />
            </div>
          )
        } else {
          // Direct video file
          return (
            <video
              src={popup.content}
              controls
              className="w-full h-auto rounded-lg"
              onError={(e) => {
                console.error('Video load error:', e)
              }}
            />
          )
        }
      case 'html':
        return (
          <div
            className="popup-html-content"
            dangerouslySetInnerHTML={{ __html: popup.content }}
            onClick={popup.link_url ? handleClick : undefined}
            style={{ cursor: popup.link_url ? 'pointer' : 'default' }}
          />
        )
      default:
        return null
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[9999]">
      <div 
        className={`bg-white dark:bg-gray-800 rounded-lg shadow-2xl ${sizeClasses[popup.size]} relative`}
        style={popup.size !== 'fullscreen' ? sizeStyles[popup.size] : {}}
      >
        {popup.dismissible && (
          <button
            onClick={handleDismiss}
            className="absolute top-2 right-2 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors z-10"
            aria-label="Close popup"
          >
            <i className="ri-close-line text-xl text-gray-600 dark:text-gray-300"></i>
          </button>
        )}
        
        <div className="p-6">
          {popup.title && (
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              {popup.title}
            </h3>
          )}
          {renderContent()}
        </div>
      </div>
    </div>
  )
}

