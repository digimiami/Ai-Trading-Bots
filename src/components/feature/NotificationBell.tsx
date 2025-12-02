import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUnreadMessageCount } from '../../hooks/useMessaging'

export default function NotificationBell() {
  const navigate = useNavigate()
  const { count, loading } = useUnreadMessageCount()
  const [showDropdown, setShowDropdown] = useState(false)

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    e.stopPropagation()
    console.log('🔔 Notification bell clicked, navigating to /messages')
    try {
      navigate('/messages')
      setShowDropdown(false)
    } catch (error) {
      console.error('Error navigating to messages:', error)
    }
  }

  return (
    <div className="relative">
      <button
        onClick={handleClick}
        className="relative p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors cursor-pointer z-50"
        title={`Messages${count > 0 ? ` (${count} unread)` : ''}`}
        type="button"
        aria-label={`Messages${count > 0 ? ` (${count} unread)` : ''}`}
      >
        <i className="ri-notification-line text-xl text-gray-600 dark:text-gray-300"></i>
        {count > 0 && (
          <span className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold pointer-events-none z-10">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>
    </div>
  )
}

