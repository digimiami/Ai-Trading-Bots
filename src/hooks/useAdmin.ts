import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

interface AdminStats {
  totalUsers: number
  totalBots: number
  totalTrades: number
  totalAlerts: number
}

interface AdminUser {
  id: string
  email: string
  user_role: string
  created_at: string
  updated_at: string
}

interface AdminLog {
  id: string
  action: string
  details: any
  created_at: string
  admin: { email: string }
  target_user: { email: string } | null
}

export function useAdmin() {
  const { user } = useAuth()
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [logs, setLogs] = useState<AdminLog[]>([])

  useEffect(() => {
    if (user) {
      checkAdminStatus()
    } else {
      setIsAdmin(false)
      setLoading(false)
    }
  }, [user])

  const checkAdminStatus = async () => {
    try {
      const { data } = await supabase
        .from('users')
        .select('user_role')
        .eq('id', user?.id)
        .single()

      setIsAdmin(data?.user_role === 'admin')
    } catch (error) {
      setIsAdmin(false)
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      const { data } = await supabase.functions.invoke('admin-management/stats')
      if (data?.stats) {
        setStats(data.stats)
      }
    } catch (error) {
      console.error('Error fetching admin stats:', error)
    }
  }

  const fetchUsers = async () => {
    try {
      const { data } = await supabase.functions.invoke('admin-management/users')
      if (data?.users) {
        setUsers(data.users)
      }
    } catch (error) {
      console.error('Error fetching users:', error)
    }
  }

  const fetchLogs = async () => {
    try {
      const { data } = await supabase.functions.invoke('admin-management/logs')
      if (data?.logs) {
        setLogs(data.logs)
      }
    } catch (error) {
      console.error('Error fetching logs:', error)
    }
  }

  const createAdmin = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('admin-management/create-admin', {
        body: { email, password }
      })
      
      if (error) throw error
      return { success: true, data }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  const updateUserRole = async (userId: string, role: string) => {
    try {
      const { error } = await supabase.functions.invoke('admin-management/update-role', {
        body: { userId, role }
      })
      
      if (error) throw error
      await fetchUsers() // Refresh users list
      return { success: true }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  const deleteUser = async (userId: string) => {
    try {
      const { error } = await supabase.functions.invoke('admin-management/delete-user', {
        body: { userId }
      })
      
      if (error) throw error
      await fetchUsers() // Refresh users list
      return { success: true }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  return {
    isAdmin,
    loading,
    stats,
    users,
    logs,
    fetchStats,
    fetchUsers,
    fetchLogs,
    createAdmin,
    updateUserRole,
    deleteUser
  }
}