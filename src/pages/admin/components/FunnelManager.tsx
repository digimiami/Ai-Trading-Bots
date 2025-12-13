/**
 * Admin Funnel Manager Component
 * Allows admins to create and manage sales funnels with landing/sale pages
 */

import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import Card from '../../../components/base/Card'
import Button from '../../../components/base/Button'
import { useNavigate } from 'react-router-dom'

interface Funnel {
  id: string
  name: string
  description?: string | null
  slug: string
  is_active: boolean
  created_at: string
  updated_at: string
}

interface FunnelPage {
  id: string
  funnel_id: string
  name: string
  slug: string
  page_type: 'landing' | 'sale' | 'thank_you' | 'upsell' | 'downsell'
  html_content: string
  meta_title?: string | null
  meta_description?: string | null
  custom_css?: string | null
  custom_js?: string | null
  is_active: boolean
  order_index: number
  redirect_url?: string | null
  created_at: string
  updated_at: string
}

interface PageStats {
  views: number
  clicks: number
  conversions: number
}

export default function FunnelManager() {
  const navigate = useNavigate()
  const [funnels, setFunnels] = useState<Funnel[]>([])
  const [selectedFunnel, setSelectedFunnel] = useState<Funnel | null>(null)
  const [pages, setPages] = useState<FunnelPage[]>([])
  const [pageStats, setPageStats] = useState<Record<string, PageStats>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showFunnelModal, setShowFunnelModal] = useState(false)
  const [showPageModal, setShowPageModal] = useState(false)
  const [editingFunnel, setEditingFunnel] = useState<Funnel | null>(null)
  const [editingPage, setEditingPage] = useState<FunnelPage | null>(null)
  const [funnelForm, setFunnelForm] = useState({
    name: '',
    description: '',
    slug: '',
    is_active: true
  })
  const [pageForm, setPageForm] = useState({
    name: '',
    slug: '',
    page_type: 'landing' as 'landing' | 'sale' | 'thank_you' | 'upsell' | 'downsell',
    html_content: '',
    meta_title: '',
    meta_description: '',
    custom_css: '',
    custom_js: '',
    is_active: true,
    order_index: 0,
    redirect_url: ''
  })

  useEffect(() => {
    fetchFunnels()
  }, [])

  useEffect(() => {
    if (selectedFunnel) {
      fetchPages(selectedFunnel.id)
      fetchPageStats(selectedFunnel.id)
    }
  }, [selectedFunnel])

  const fetchFunnels = async () => {
    try {
      setLoading(true)
      setError(null)
      const { data, error } = await supabase
        .from('funnels')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setFunnels(data || [])
    } catch (err: any) {
      console.error('Error fetching funnels:', err)
      setError(err.message || 'Failed to load funnels')
    } finally {
      setLoading(false)
    }
  }

  const fetchPages = async (funnelId: string) => {
    try {
      const { data, error } = await supabase
        .from('funnel_pages')
        .select('*')
        .eq('funnel_id', funnelId)
        .order('order_index', { ascending: true })
        .order('created_at', { ascending: true })

      if (error) throw error
      setPages(data || [])
    } catch (err: any) {
      console.error('Error fetching pages:', err)
    }
  }

  const fetchPageStats = async (funnelId: string) => {
    try {
      // Get views count
      const { data: viewsData } = await supabase
        .from('funnel_page_views')
        .select('page_id')
        .eq('funnel_id', funnelId)

      // Get events count
      const { data: eventsData } = await supabase
        .from('funnel_page_events')
        .select('page_id, event_type')
        .eq('funnel_id', funnelId)

      const stats: Record<string, PageStats> = {}
      
      // Count views per page
      if (viewsData) {
        viewsData.forEach((view) => {
          if (!stats[view.page_id]) {
            stats[view.page_id] = { views: 0, clicks: 0, conversions: 0 }
          }
          stats[view.page_id].views++
        })
      }

      // Count clicks and conversions per page
      if (eventsData) {
        eventsData.forEach((event) => {
          if (!stats[event.page_id]) {
            stats[event.page_id] = { views: 0, clicks: 0, conversions: 0 }
          }
          if (event.event_type === 'click') {
            stats[event.page_id].clicks++
          } else if (['purchase', 'signup', 'form_submit'].includes(event.event_type)) {
            stats[event.page_id].conversions++
          }
        })
      }

      setPageStats(stats)
    } catch (err) {
      console.error('Error fetching page stats:', err)
    }
  }

  const handleCreateFunnel = () => {
    setEditingFunnel(null)
    setFunnelForm({
      name: '',
      description: '',
      slug: '',
      is_active: true
    })
    setShowFunnelModal(true)
  }

  const handleEditFunnel = (funnel: Funnel) => {
    setEditingFunnel(funnel)
    setFunnelForm({
      name: funnel.name,
      description: funnel.description || '',
      slug: funnel.slug,
      is_active: funnel.is_active
    })
    setShowFunnelModal(true)
  }

  const handleSaveFunnel = async () => {
    try {
      setError(null)
      
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const funnelData: any = {
        name: funnelForm.name,
        description: funnelForm.description || null,
        slug: funnelForm.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        is_active: funnelForm.is_active
      }

      if (editingFunnel) {
        const { error } = await supabase
          .from('funnels')
          .update(funnelData)
          .eq('id', editingFunnel.id)

        if (error) throw error
        alert('✅ Funnel updated successfully!')
      } else {
        funnelData.created_by = user.id
        const { error } = await supabase
          .from('funnels')
          .insert(funnelData)

        if (error) throw error
        alert('✅ Funnel created successfully!')
      }

      setShowFunnelModal(false)
      fetchFunnels()
    } catch (err: any) {
      console.error('Error saving funnel:', err)
      setError(err.message || 'Failed to save funnel')
      alert(`❌ Error: ${err.message || 'Failed to save funnel'}`)
    }
  }

  const handleDeleteFunnel = async (id: string) => {
    if (!confirm('Are you sure you want to delete this funnel? This will delete all associated pages and tracking data.')) return

    try {
      const { error } = await supabase
        .from('funnels')
        .delete()
        .eq('id', id)

      if (error) throw error
      alert('✅ Funnel deleted successfully!')
      if (selectedFunnel?.id === id) {
        setSelectedFunnel(null)
        setPages([])
      }
      fetchFunnels()
    } catch (err: any) {
      console.error('Error deleting funnel:', err)
      alert(`❌ Error: ${err.message || 'Failed to delete funnel'}`)
    }
  }

  const handleCreatePage = () => {
    if (!selectedFunnel) {
      alert('Please select a funnel first')
      return
    }
    setEditingPage(null)
    setPageForm({
      name: '',
      slug: '',
      page_type: 'landing',
      html_content: '<div class="container mx-auto px-4 py-16"><h1 class="text-4xl font-bold mb-4">Welcome</h1><p class="text-lg mb-8">Your content here</p><button class="bg-blue-600 text-white px-6 py-3 rounded-lg">Get Started</button></div>',
      meta_title: '',
      meta_description: '',
      custom_css: '',
      custom_js: '',
      is_active: true,
      order_index: pages.length,
      redirect_url: ''
    })
    setShowPageModal(true)
  }

  const handleEditPage = (page: FunnelPage) => {
    setEditingPage(page)
    setPageForm({
      name: page.name,
      slug: page.slug,
      page_type: page.page_type,
      html_content: page.html_content,
      meta_title: page.meta_title || '',
      meta_description: page.meta_description || '',
      custom_css: page.custom_css || '',
      custom_js: page.custom_js || '',
      is_active: page.is_active,
      order_index: page.order_index,
      redirect_url: page.redirect_url || ''
    })
    setShowPageModal(true)
  }

  const handleSavePage = async () => {
    if (!selectedFunnel) return

    try {
      setError(null)

      const pageData: any = {
        funnel_id: selectedFunnel.id,
        name: pageForm.name,
        slug: pageForm.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        page_type: pageForm.page_type,
        html_content: pageForm.html_content,
        meta_title: pageForm.meta_title || null,
        meta_description: pageForm.meta_description || null,
        custom_css: pageForm.custom_css || null,
        custom_js: pageForm.custom_js || null,
        is_active: pageForm.is_active,
        order_index: pageForm.order_index,
        redirect_url: pageForm.redirect_url || null
      }

      if (editingPage) {
        const { error } = await supabase
          .from('funnel_pages')
          .update(pageData)
          .eq('id', editingPage.id)

        if (error) throw error
        alert('✅ Page updated successfully!')
      } else {
        const { error } = await supabase
          .from('funnel_pages')
          .insert(pageData)

        if (error) throw error
        alert('✅ Page created successfully!')
      }

      setShowPageModal(false)
      fetchPages(selectedFunnel.id)
    } catch (err: any) {
      console.error('Error saving page:', err)
      setError(err.message || 'Failed to save page')
      alert(`❌ Error: ${err.message || 'Failed to save page'}`)
    }
  }

  const handleDeletePage = async (id: string) => {
    if (!confirm('Are you sure you want to delete this page?')) return

    try {
      const { error } = await supabase
        .from('funnel_pages')
        .delete()
        .eq('id', id)

      if (error) throw error
      alert('✅ Page deleted successfully!')
      if (selectedFunnel) {
        fetchPages(selectedFunnel.id)
        fetchPageStats(selectedFunnel.id)
      }
    } catch (err: any) {
      console.error('Error deleting page:', err)
      alert(`❌ Error: ${err.message || 'Failed to delete page'}`)
    }
  }

  const handleViewPage = (page: FunnelPage) => {
    if (!selectedFunnel) return
    navigate(`/funnel/${selectedFunnel.slug}/${page.slug}`)
  }

  if (loading) {
    return (
      <Card>
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-400">Loading funnels...</p>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white">Funnel Manager</h2>
          <Button variant="primary" onClick={handleCreateFunnel}>
            <i className="ri-add-line mr-2"></i>
            Create Funnel
          </Button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded text-red-400">
            {error}
          </div>
        )}

        {/* Funnels List */}
        <div className="space-y-3 mb-6">
          {funnels.length === 0 ? (
            <div className="text-center py-12">
              <i className="ri-stack-line text-6xl text-gray-600 mb-4"></i>
              <p className="text-gray-400 text-lg mb-2">No funnels created yet</p>
              <p className="text-gray-500 text-sm">Create your first funnel to get started.</p>
            </div>
          ) : (
            funnels.map((funnel) => (
              <div
                key={funnel.id}
                className={`p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                  selectedFunnel?.id === funnel.id
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                }`}
                onClick={() => setSelectedFunnel(funnel)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-white">{funnel.name}</h3>
                      <span className={`px-2 py-1 rounded text-xs ${
                        funnel.is_active
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-gray-500/20 text-gray-400'
                      }`}>
                        {funnel.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    {funnel.description && (
                      <p className="text-sm text-gray-400 mb-2">{funnel.description}</p>
                    )}
                    <p className="text-xs text-gray-500">
                      Slug: <code className="bg-gray-700 px-1 rounded">/{funnel.slug}</code>
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleEditFunnel(funnel)
                      }}
                    >
                      <i className="ri-edit-line"></i>
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteFunnel(funnel.id)
                      }}
                    >
                      <i className="ri-delete-bin-line"></i>
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pages List for Selected Funnel */}
        {selectedFunnel && (
          <div className="mt-6 pt-6 border-t border-gray-700">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold text-white">
                Pages in "{selectedFunnel.name}"
              </h3>
              <Button variant="primary" size="sm" onClick={handleCreatePage}>
                <i className="ri-add-line mr-2"></i>
                Add Page
              </Button>
            </div>

            {pages.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No pages in this funnel yet. Create your first page.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pages.map((page) => {
                  const stats = pageStats[page.id] || { views: 0, clicks: 0, conversions: 0 }
                  return (
                    <div
                      key={page.id}
                      className="p-4 rounded-lg border border-gray-700 bg-gray-800/50"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h4 className="text-md font-semibold text-white">{page.name}</h4>
                            <span className="px-2 py-1 rounded text-xs bg-blue-500/20 text-blue-400 capitalize">
                              {page.page_type.replace('_', ' ')}
                            </span>
                            <span className={`px-2 py-1 rounded text-xs ${
                              page.is_active
                                ? 'bg-green-500/20 text-green-400'
                                : 'bg-gray-500/20 text-gray-400'
                            }`}>
                              {page.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mb-2">
                            URL: <code className="bg-gray-700 px-1 rounded">/funnel/{selectedFunnel.slug}/{page.slug}</code>
                          </p>
                          <div className="flex gap-4 text-xs text-gray-400">
                            <span>👁️ {stats.views} views</span>
                            <span>🖱️ {stats.clicks} clicks</span>
                            <span>✅ {stats.conversions} conversions</span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleViewPage(page)}
                          >
                            <i className="ri-eye-line mr-1"></i>
                            View
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleEditPage(page)}
                          >
                            <i className="ri-edit-line"></i>
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => handleDeletePage(page.id)}
                          >
                            <i className="ri-delete-bin-line"></i>
                          </Button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Funnel Create/Edit Modal */}
      {showFunnelModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-white">
                  {editingFunnel ? 'Edit Funnel' : 'Create New Funnel'}
                </h2>
                <button
                  onClick={() => setShowFunnelModal(false)}
                  className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <i className="ri-close-line text-xl text-gray-400"></i>
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Name</label>
                  <input
                    type="text"
                    value={funnelForm.name}
                    onChange={(e) => setFunnelForm({ ...funnelForm, name: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-800 text-white border border-gray-700 rounded-lg"
                    placeholder="My Sales Funnel"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
                  <textarea
                    value={funnelForm.description}
                    onChange={(e) => setFunnelForm({ ...funnelForm, description: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-800 text-white border border-gray-700 rounded-lg h-24"
                    placeholder="Funnel description..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Slug (URL)</label>
                  <input
                    type="text"
                    value={funnelForm.slug}
                    onChange={(e) => setFunnelForm({ ...funnelForm, slug: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-800 text-white border border-gray-700 rounded-lg"
                    placeholder="my-sales-funnel"
                  />
                  <p className="text-xs text-gray-500 mt-1">Will be accessible at /funnel/my-sales-funnel</p>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={funnelForm.is_active}
                    onChange={(e) => setFunnelForm({ ...funnelForm, is_active: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <label className="text-gray-300">Active</label>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button variant="primary" onClick={handleSaveFunnel} className="flex-1">
                    {editingFunnel ? 'Update Funnel' : 'Create Funnel'}
                  </Button>
                  <Button variant="secondary" onClick={() => setShowFunnelModal(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Page Create/Edit Modal */}
      {showPageModal && selectedFunnel && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-6xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-white">
                  {editingPage ? 'Edit Page' : 'Create New Page'}
                </h2>
                <button
                  onClick={() => setShowPageModal(false)}
                  className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <i className="ri-close-line text-xl text-gray-400"></i>
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Page Name</label>
                    <input
                      type="text"
                      value={pageForm.name}
                      onChange={(e) => setPageForm({ ...pageForm, name: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-800 text-white border border-gray-700 rounded-lg"
                      placeholder="Landing Page"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Page Type</label>
                    <select
                      value={pageForm.page_type}
                      onChange={(e) => setPageForm({ ...pageForm, page_type: e.target.value as any })}
                      className="w-full px-3 py-2 bg-gray-800 text-white border border-gray-700 rounded-lg"
                    >
                      <option value="landing">Landing Page</option>
                      <option value="sale">Sale Page</option>
                      <option value="thank_you">Thank You Page</option>
                      <option value="upsell">Upsell Page</option>
                      <option value="downsell">Downsell Page</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Slug (URL)</label>
                  <input
                    type="text"
                    value={pageForm.slug}
                    onChange={(e) => setPageForm({ ...pageForm, slug: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-800 text-white border border-gray-700 rounded-lg"
                    placeholder="landing-page"
                  />
                  <p className="text-xs text-gray-500 mt-1">Will be accessible at /funnel/{selectedFunnel.slug}/landing-page</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Meta Title</label>
                    <input
                      type="text"
                      value={pageForm.meta_title}
                      onChange={(e) => setPageForm({ ...pageForm, meta_title: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-800 text-white border border-gray-700 rounded-lg"
                      placeholder="Page Title"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Order Index</label>
                    <input
                      type="number"
                      value={pageForm.order_index}
                      onChange={(e) => setPageForm({ ...pageForm, order_index: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 bg-gray-800 text-white border border-gray-700 rounded-lg"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Meta Description</label>
                  <textarea
                    value={pageForm.meta_description}
                    onChange={(e) => setPageForm({ ...pageForm, meta_description: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-800 text-white border border-gray-700 rounded-lg h-20"
                    placeholder="Page description for SEO"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">HTML Content</label>
                  <textarea
                    value={pageForm.html_content}
                    onChange={(e) => setPageForm({ ...pageForm, html_content: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-800 text-white border border-gray-700 rounded-lg h-64 font-mono text-sm"
                    placeholder="<div>Your HTML content here</div>"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Custom CSS (Optional)</label>
                  <textarea
                    value={pageForm.custom_css}
                    onChange={(e) => setPageForm({ ...pageForm, custom_css: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-800 text-white border border-gray-700 rounded-lg h-32 font-mono text-sm"
                    placeholder="/* Your custom CSS here */"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Custom JavaScript (Optional)</label>
                  <textarea
                    value={pageForm.custom_js}
                    onChange={(e) => setPageForm({ ...pageForm, custom_js: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-800 text-white border border-gray-700 rounded-lg h-32 font-mono text-sm"
                    placeholder="// Your custom JavaScript here"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Redirect URL (Optional)</label>
                  <input
                    type="url"
                    value={pageForm.redirect_url}
                    onChange={(e) => setPageForm({ ...pageForm, redirect_url: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-800 text-white border border-gray-700 rounded-lg"
                    placeholder="https://example.com"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={pageForm.is_active}
                    onChange={(e) => setPageForm({ ...pageForm, is_active: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <label className="text-gray-300">Active</label>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button variant="primary" onClick={handleSavePage} className="flex-1">
                    {editingPage ? 'Update Page' : 'Create Page'}
                  </Button>
                  <Button variant="secondary" onClick={() => setShowPageModal(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
