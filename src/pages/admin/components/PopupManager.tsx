/**
 * Admin Popup/Announcement Manager Component
 * Allows admins to create and manage popups for different audiences
 */

import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import Card from '../../../components/base/Card'
import Button from '../../../components/base/Button'

interface Popup {
  id: string
  title: string
  content_type: 'image' | 'video' | 'html'
  content: string
  link_url?: string | null
  size: 'small' | 'medium' | 'large' | 'fullscreen'
  target_audience: 'new_visitor' | 'all_users' | 'new_user' | 'homepage' | 'members_only' | 'individual'
  target_user_id?: string | null
  is_active: boolean
  show_on_pages?: string[] | null
  priority: number
  start_date?: string | null
  end_date?: string | null
  dismissible: boolean
  show_count: number
  dismiss_count: number
  created_at: string
  updated_at: string
}

interface User {
  id: string
  email: string
}

export default function PopupManager() {
  const [popups, setPopups] = useState<Popup[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [editingPopup, setEditingPopup] = useState<Popup | null>(null)
  const [formData, setFormData] = useState({
    title: '',
    content_type: 'html' as 'image' | 'video' | 'html',
    content: '',
    link_url: '',
    size: 'medium' as 'small' | 'medium' | 'large' | 'fullscreen',
    target_audience: 'all_users' as 'new_visitor' | 'all_users' | 'new_user' | 'homepage' | 'members_only' | 'individual',
    target_user_id: '',
    is_active: true,
    show_on_pages: [] as string[],
    priority: 0,
    start_date: '',
    end_date: '',
    dismissible: true
  })

  useEffect(() => {
    fetchPopups()
    fetchUsers()
  }, [])

  const fetchPopups = async () => {
    try {
      setLoading(true)
      setError(null)
      const { data, error } = await supabase
        .from('popups')
        .select('*')
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false })

      if (error) throw error
      setPopups(data || [])
    } catch (err: any) {
      console.error('Error fetching popups:', err)
      setError(err.message || 'Failed to load popups')
    } finally {
      setLoading(false)
    }
  }

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, email')
        .order('email', { ascending: true })
        .limit(1000)

      if (error) throw error
      setUsers(data || [])
    } catch (err) {
      console.error('Error fetching users:', err)
    }
  }

  const handleCreate = () => {
    setEditingPopup(null)
    setFormData({
      title: '',
      content_type: 'html',
      content: '',
      link_url: '',
      size: 'medium',
      target_audience: 'all_users',
      target_user_id: '',
      is_active: true,
      show_on_pages: [],
      priority: 0,
      start_date: '',
      end_date: '',
      dismissible: true
    })
    setShowCreateModal(true)
  }

  const handleEdit = (popup: Popup) => {
    setEditingPopup(popup)
    setFormData({
      title: popup.title,
      content_type: popup.content_type,
      content: popup.content,
      link_url: popup.link_url || '',
      size: popup.size,
      target_audience: popup.target_audience,
      target_user_id: popup.target_user_id || '',
      is_active: popup.is_active,
      show_on_pages: popup.show_on_pages || [],
      priority: popup.priority,
      start_date: popup.start_date ? new Date(popup.start_date).toISOString().slice(0, 16) : '',
      end_date: popup.end_date ? new Date(popup.end_date).toISOString().slice(0, 16) : '',
      dismissible: popup.dismissible
    })
    setShowCreateModal(true)
  }

  const handleSave = async () => {
    try {
      setError(null)
      
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const popupData: any = {
        title: formData.title,
        content_type: formData.content_type,
        content: formData.content,
        link_url: formData.link_url || null,
        size: formData.size,
        target_audience: formData.target_audience,
        target_user_id: formData.target_audience === 'individual' && formData.target_user_id ? formData.target_user_id : null,
        is_active: formData.is_active,
        show_on_pages: formData.show_on_pages.length > 0 ? formData.show_on_pages : null,
        priority: formData.priority,
        start_date: formData.start_date ? new Date(formData.start_date).toISOString() : null,
        end_date: formData.end_date ? new Date(formData.end_date).toISOString() : null,
        dismissible: formData.dismissible,
        created_by: user.id
      }

      if (editingPopup) {
        const { error } = await supabase
          .from('popups')
          .update(popupData)
          .eq('id', editingPopup.id)

        if (error) throw error
        alert('✅ Popup updated successfully!')
      } else {
        const { error } = await supabase
          .from('popups')
          .insert(popupData)

        if (error) throw error
        alert('✅ Popup created successfully!')
      }

      setShowCreateModal(false)
      fetchPopups()
    } catch (err: any) {
      console.error('Error saving popup:', err)
      setError(err.message || 'Failed to save popup')
      alert(`❌ Error: ${err.message || 'Failed to save popup'}`)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this popup?')) return

    try {
      const { error } = await supabase
        .from('popups')
        .delete()
        .eq('id', id)

      if (error) throw error
      alert('✅ Popup deleted successfully!')
      fetchPopups()
    } catch (err: any) {
      console.error('Error deleting popup:', err)
      alert(`❌ Error: ${err.message || 'Failed to delete popup'}`)
    }
  }

  const toggleActive = async (popup: Popup) => {
    try {
      const { error } = await supabase
        .from('popups')
        .update({ is_active: !popup.is_active })
        .eq('id', popup.id)

      if (error) throw error
      fetchPopups()
    } catch (err: any) {
      console.error('Error toggling popup:', err)
      alert(`❌ Error: ${err.message || 'Failed to update popup'}`)
    }
  }


  const removePage = (page: string) => {
    setFormData({ ...formData, show_on_pages: formData.show_on_pages.filter(p => p !== page) })
  }

  if (loading) {
    return (
      <Card>
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-400">Loading popups...</p>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white">Popup Manager</h2>
          <Button variant="primary" onClick={handleCreate}>
            <i className="ri-add-line mr-2"></i>
            Create Popup
          </Button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded text-red-400">
            {error}
          </div>
        )}

        {popups.length === 0 ? (
          <div className="text-center py-12">
            <i className="ri-notification-line text-6xl text-gray-600 mb-4"></i>
            <p className="text-gray-400 text-lg mb-2">No popups created yet</p>
            <p className="text-gray-500 text-sm">Create your first popup to get started.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="pb-3 text-gray-400 font-semibold">Title</th>
                  <th className="pb-3 text-gray-400 font-semibold">Type</th>
                  <th className="pb-3 text-gray-400 font-semibold">Size</th>
                  <th className="pb-3 text-gray-400 font-semibold">Target</th>
                  <th className="pb-3 text-gray-400 font-semibold">Status</th>
                  <th className="pb-3 text-gray-400 font-semibold">Stats</th>
                  <th className="pb-3 text-gray-400 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {popups.map((popup) => (
                  <tr key={popup.id} className="border-b border-gray-800">
                    <td className="py-3 text-white">{popup.title}</td>
                    <td className="py-3 text-gray-300 capitalize">{popup.content_type}</td>
                    <td className="py-3 text-gray-300 capitalize">{popup.size}</td>
                    <td className="py-3 text-gray-300">
                      <span className="capitalize">{popup.target_audience.replace('_', ' ')}</span>
                      {popup.target_audience === 'individual' && popup.target_user_id && (
                        <span className="text-xs text-gray-500 ml-1">(User ID)</span>
                      )}
                    </td>
                    <td className="py-3">
                      <button
                        onClick={() => toggleActive(popup)}
                        className={`px-2 py-1 rounded text-xs ${
                          popup.is_active
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-gray-500/20 text-gray-400'
                        }`}
                      >
                        {popup.is_active ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="py-3 text-gray-300 text-sm">
                      👁️ {popup.show_count} | ❌ {popup.dismiss_count}
                    </td>
                    <td className="py-3">
                      <div className="flex gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleEdit(popup)}
                        >
                          <i className="ri-edit-line"></i>
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => handleDelete(popup.id)}
                        >
                          <i className="ri-delete-bin-line"></i>
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-white">
                  {editingPopup ? 'Edit Popup' : 'Create New Popup'}
                </h2>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <i className="ri-close-line text-xl text-gray-400"></i>
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Title</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-800 text-white border border-gray-700 rounded-lg"
                    placeholder="Popup Title"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Content Type</label>
                    <select
                      value={formData.content_type}
                      onChange={(e) => setFormData({ ...formData, content_type: e.target.value as any })}
                      className="w-full px-3 py-2 bg-gray-800 text-white border border-gray-700 rounded-lg"
                    >
                      <option value="html">HTML</option>
                      <option value="image">Image</option>
                      <option value="video">Video</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Size</label>
                    <select
                      value={formData.size}
                      onChange={(e) => setFormData({ ...formData, size: e.target.value as any })}
                      className="w-full px-3 py-2 bg-gray-800 text-white border border-gray-700 rounded-lg"
                    >
                      <option value="small">Small</option>
                      <option value="medium">Medium</option>
                      <option value="large">Large</option>
                      <option value="fullscreen">Fullscreen</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    {formData.content_type === 'html' ? 'HTML Content' : formData.content_type === 'image' ? 'Image URL' : 'Video URL'}
                  </label>
                  {formData.content_type === 'html' ? (
                    <textarea
                      value={formData.content}
                      onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-800 text-white border border-gray-700 rounded-lg h-32 font-mono text-sm"
                      placeholder="<div>Your HTML content here</div>"
                    />
                  ) : (
                    <input
                      type="url"
                      value={formData.content}
                      onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-800 text-white border border-gray-700 rounded-lg"
                      placeholder={`Enter ${formData.content_type} URL`}
                    />
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Click Link URL (Optional)</label>
                  <input
                    type="url"
                    value={formData.link_url}
                    onChange={(e) => setFormData({ ...formData, link_url: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-800 text-white border border-gray-700 rounded-lg"
                    placeholder="https://example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Target Audience</label>
                  <select
                    value={formData.target_audience}
                    onChange={(e) => setFormData({ ...formData, target_audience: e.target.value as any, target_user_id: '' })}
                    className="w-full px-3 py-2 bg-gray-800 text-white border border-gray-700 rounded-lg"
                  >
                    <option value="new_visitor">New Visitors</option>
                    <option value="all_users">All Users</option>
                    <option value="new_user">New Users</option>
                    <option value="homepage">Homepage Only</option>
                    <option value="members_only">Members Only</option>
                    <option value="individual">Individual User</option>
                  </select>
                </div>

                {formData.target_audience === 'individual' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Select User</label>
                    <select
                      value={formData.target_user_id}
                      onChange={(e) => setFormData({ ...formData, target_user_id: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-800 text-white border border-gray-700 rounded-lg"
                    >
                      <option value="">Select a user...</option>
                      {users.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.email}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Start Date (Optional)</label>
                    <input
                      type="datetime-local"
                      value={formData.start_date}
                      onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-800 text-white border border-gray-700 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">End Date (Optional)</label>
                    <input
                      type="datetime-local"
                      value={formData.end_date}
                      onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-800 text-white border border-gray-700 rounded-lg"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Show on Pages (Optional)</label>
                  <p className="text-xs text-gray-500 mb-2">Leave empty to show on all pages, or specify specific page paths</p>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      id="page-input"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          const input = e.currentTarget as HTMLInputElement
                          const page = input.value.trim()
                          if (page && !formData.show_on_pages.includes(page)) {
                            setFormData({ ...formData, show_on_pages: [...formData.show_on_pages, page] })
                            input.value = ''
                          }
                        }
                      }}
                      className="flex-1 px-3 py-2 bg-gray-800 text-white border border-gray-700 rounded-lg"
                      placeholder="Enter page path (e.g., /dashboard, /bots) and press Enter"
                    />
                    <Button 
                      variant="secondary" 
                      onClick={() => {
                        const input = document.getElementById('page-input') as HTMLInputElement
                        if (input) {
                          const page = input.value.trim()
                          if (page && !formData.show_on_pages.includes(page)) {
                            setFormData({ ...formData, show_on_pages: [...formData.show_on_pages, page] })
                            input.value = ''
                          }
                        }
                      }}
                    >
                      Add Page
                    </Button>
                  </div>
                  {formData.show_on_pages.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {formData.show_on_pages.map((page) => (
                        <span
                          key={page}
                          className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-sm flex items-center gap-2"
                        >
                          {page}
                          <button
                            onClick={() => removePage(page)}
                            className="text-blue-400 hover:text-blue-300"
                          >
                            <i className="ri-close-line"></i>
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Priority</label>
                    <input
                      type="number"
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 bg-gray-800 text-white border border-gray-700 rounded-lg"
                      placeholder="0"
                    />
                    <p className="text-xs text-gray-500 mt-1">Higher priority popups show first</p>
                  </div>

                  <div className="flex items-center gap-4 pt-6">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.is_active}
                        onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                        className="w-4 h-4"
                      />
                      <span className="text-gray-300">Active</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.dismissible}
                        onChange={(e) => setFormData({ ...formData, dismissible: e.target.checked })}
                        className="w-4 h-4"
                      />
                      <span className="text-gray-300">Dismissible</span>
                    </label>
                  </div>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button 
                    variant="secondary" 
                    onClick={() => setShowPreview(true)}
                    className="flex items-center gap-2"
                  >
                    <i className="ri-eye-line"></i>
                    Preview
                  </Button>
                  <Button variant="primary" onClick={handleSave} className="flex-1">
                    {editingPopup ? 'Update Popup' : 'Create Popup'}
                  </Button>
                  <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Preview Modal */}
      {showPreview && (
        <PopupPreview
          popup={{
            id: 'preview',
            title: formData.title || 'Preview Popup',
            content_type: formData.content_type,
            content: formData.content || (formData.content_type === 'html' ? '<p>Enter content to preview</p>' : ''),
            link_url: formData.link_url || null,
            size: formData.size,
            dismissible: formData.dismissible,
            target_audience: formData.target_audience,
            target_user_id: formData.target_user_id || null,
            is_active: formData.is_active,
            show_on_pages: formData.show_on_pages.length > 0 ? formData.show_on_pages : null,
            priority: formData.priority,
            start_date: formData.start_date ? new Date(formData.start_date).toISOString() : null,
            end_date: formData.end_date ? new Date(formData.end_date).toISOString() : null,
            show_count: 0,
            dismiss_count: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  )
}

// Preview Component - Reuses PopupDisplay logic
function PopupPreview({ popup, onClose }: { popup: Popup; onClose: () => void }) {
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
            src={popup.content || 'https://via.placeholder.com/400x300?text=Enter+Image+URL'}
            alt={popup.title}
            className={`w-full h-auto ${popup.link_url ? 'cursor-pointer' : ''}`}
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
              src={popup.content || ''}
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
            dangerouslySetInnerHTML={{ __html: popup.content || '<p>Enter HTML content to preview</p>' }}
            style={{ cursor: popup.link_url ? 'pointer' : 'default' }}
          />
        )
      default:
        return <p className="text-gray-400">Select content type and enter content to preview</p>
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[10000]">
      <div 
        className={`bg-white dark:bg-gray-800 rounded-lg shadow-2xl ${sizeClasses[popup.size]} relative`}
        style={popup.size !== 'fullscreen' ? sizeStyles[popup.size] : {}}
      >
        {/* Preview Badge */}
        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 z-20">
          <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-xs font-semibold shadow-lg">
            PREVIEW
          </span>
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-2 right-2 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors z-10"
          aria-label="Close preview"
        >
          <i className="ri-close-line text-xl text-gray-600 dark:text-gray-300"></i>
        </button>
        
        <div className="p-6">
          {popup.title && (
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              {popup.title}
            </h3>
          )}
          {renderContent()}
          {popup.link_url && (
            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-sm text-blue-600 dark:text-blue-400">
                <i className="ri-external-link-line mr-1"></i>
                Click will open: {popup.link_url}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

