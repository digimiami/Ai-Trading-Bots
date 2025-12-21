/**
 * Admin Manual Trading Component
 * Allows admins to manually place orders and manage positions for any user
 */

import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../hooks/useAuth'
import { API_ENDPOINTS, apiCall } from '../../../lib/supabase'
import Card from '../../../components/base/Card'
import Button from '../../../components/base/Button'

interface User {
  id: string
  email: string
}

interface OpenPosition {
  id: string
  user_id: string
  bot_id: string | null
  symbol: string
  side: string
  entry_price: number
  exit_price: number | null
  size: number
  amount: number | null
  pnl: number | null
  status: string
  exchange: string
  trading_type: string | null
  created_at: string
  executed_at: string | null
  users?: { email: string } | null
}

interface OrderForm {
  userId: string
  exchange: 'bybit' | 'okx' | 'bitunix' | 'mexc'
  symbol: string
  side: 'buy' | 'sell' | 'long' | 'short'
  orderType: 'limit' | 'market'
  amount: string
  price: string
  tradingType: 'spot' | 'futures' | 'linear'
}

export default function ManualTrading() {
  const { user } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [positions, setPositions] = useState<OpenPosition[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [placingOrder, setPlacingOrder] = useState(false)
  const [closingPositionId, setClosingPositionId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'place-order' | 'positions'>('place-order')
  
  const [orderForm, setOrderForm] = useState<OrderForm>({
    userId: '',
    exchange: 'bybit',
    symbol: '',
    side: 'buy',
    orderType: 'market',
    amount: '',
    price: '',
    tradingType: 'spot'
  })

  const [filters, setFilters] = useState({
    exchange: 'all',
    userId: 'all',
    symbol: ''
  })

  useEffect(() => {
    checkAdminStatus()
    fetchUsers()
    fetchOpenPositions()
  }, [user])

  const checkAdminStatus = async () => {
    if (!user?.id) {
      setIsAdmin(false)
      return
    }

    try {
      const { data, error } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()

      if (!error && data?.role === 'admin') {
        setIsAdmin(true)
      } else {
        setIsAdmin(false)
      }
    } catch (err) {
      console.error('Error checking admin status:', err)
      setIsAdmin(false)
    }
  }

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, email')
        .order('email', { ascending: true })
        .limit(500)

      if (error) throw error
      setUsers(data || [])
    } catch (err: any) {
      console.error('Error fetching users:', err)
      setError(`Failed to load users: ${err?.message || err}`)
    }
  }

  const fetchOpenPositions = async () => {
    try {
      setLoading(true)
      setError(null)

      // Fetch all open positions (admin can see all)
      let query = supabase
        .from('trades')
        .select(`
          *,
          users!trades_user_id_fkey(email)
        `)
        .in('status', ['open', 'pending'])
        .order('created_at', { ascending: false })

      const { data, error } = await query

      if (error) throw error

      // Transform and filter data
      let filteredPositions = (data || []) as OpenPosition[]

      // Apply filters
      if (filters.exchange !== 'all') {
        filteredPositions = filteredPositions.filter(p => p.exchange === filters.exchange)
      }
      if (filters.userId !== 'all') {
        filteredPositions = filteredPositions.filter(p => p.user_id === filters.userId)
      }
      if (filters.symbol) {
        filteredPositions = filteredPositions.filter(p => 
          p.symbol.toLowerCase().includes(filters.symbol.toLowerCase())
        )
      }

      setPositions(filteredPositions)
    } catch (err: any) {
      console.error('Error fetching open positions:', err)
      setError(`Failed to load positions: ${err?.message || err}`)
      setPositions([])
    } finally {
      setLoading(false)
    }
  }

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!orderForm.userId) {
      alert('Please select a user')
      return
    }
    if (!orderForm.symbol) {
      alert('Please enter a symbol')
      return
    }
    if (!orderForm.amount || parseFloat(orderForm.amount) <= 0) {
      alert('Please enter a valid amount')
      return
    }
    if (orderForm.orderType === 'limit' && (!orderForm.price || parseFloat(orderForm.price) <= 0)) {
      alert('Please enter a valid price for limit orders')
      return
    }

    try {
      setPlacingOrder(true)
      setError(null)

      // Get user's API keys for the selected exchange
      const { data: apiKeys, error: apiKeysError } = await supabase
        .from('api_keys')
        .select('api_key, api_secret, exchange')
        .eq('user_id', orderForm.userId)
        .eq('exchange', orderForm.exchange)
        .single()

      if (apiKeysError || !apiKeys) {
        throw new Error(`User does not have API keys configured for ${orderForm.exchange}. Please configure API keys first.`)
      }

      // Create a temporary bot for the manual order
      // This allows us to use the existing bot-executor logic
      const { data: tempBot, error: botError } = await supabase
        .from('trading_bots')
        .insert({
          user_id: orderForm.userId,
          name: `[MANUAL] ${orderForm.symbol} ${orderForm.side.toUpperCase()}`,
          exchange: orderForm.exchange,
          symbol: orderForm.symbol.toUpperCase(),
          trading_type: orderForm.tradingType,
          status: 'running',
          paper_trading: false,
          strategy: {},
          strategy_config: {}
        })
        .select()
        .single()

      if (botError) {
        throw new Error(`Failed to create temporary bot: ${botError.message}`)
      }

      // Create a manual trade signal for the bot-executor
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('Not authenticated')
      }

      const supabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
      
      // Create manual trade signal in database
      const tradeSignal = {
        bot_id: tempBot.id,
        signal_type: 'manual',
        side: orderForm.side,
        symbol: orderForm.symbol.toUpperCase(),
        price: orderForm.orderType === 'limit' ? parseFloat(orderForm.price) : null,
        amount: parseFloat(orderForm.amount),
        timestamp: new Date().toISOString(),
        source: 'admin_manual'
      }

      const { error: signalError } = await supabase
        .from('manual_trade_signals')
        .insert(tradeSignal)
        .select()
        .single()

      if (signalError) {
        // If table doesn't exist, try alternative approach
        console.warn('Manual trade signals table may not exist, trying direct execution:', signalError)
        
        // Call bot-executor directly with execute_bot
        const response = await fetch(`${supabaseUrl}/functions/v1/bot-executor`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'execute_bot',
            botId: tempBot.id
          }),
        })

        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`Failed to execute bot: ${errorText}`)
        }

        const result = await response.json()
        
        // Delete temporary bot
        await supabase
          .from('trading_bots')
          .delete()
          .eq('id', tempBot.id)

        alert(`✅ Order execution initiated!\n\nBot ID: ${tempBot.id}\nSymbol: ${orderForm.symbol}\nSide: ${orderForm.side}\nAmount: ${orderForm.amount}\n\nCheck the bot logs for order details.`)
        return
      }

      // If signal was created, execute the bot
      const response = await fetch(`${supabaseUrl}/functions/v1/bot-executor`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'execute_bot',
          botId: tempBot.id
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to execute bot: ${errorText}`)
      }

      const result = await response.json()

      // Delete temporary bot after a delay
      setTimeout(async () => {
        await supabase
          .from('trading_bots')
          .delete()
          .eq('id', tempBot.id)
      }, 5000)

      // Note: The order execution happens asynchronously
      // Check bot logs or positions for order confirmation
      
      // Reset form
      setOrderForm({
        userId: '',
        exchange: 'bybit',
        symbol: '',
        side: 'buy',
        orderType: 'market',
        amount: '',
        price: '',
        tradingType: 'spot'
      })

      // Refresh positions
      await fetchOpenPositions()
    } catch (err: any) {
      console.error('Error placing order:', err)
      alert(`❌ Failed to place order: ${err?.message || err}`)
      setError(err?.message || 'Failed to place order')
    } finally {
      setPlacingOrder(false)
    }
  }

  const handleClosePosition = async (positionId: string) => {
    if (!confirm('Are you sure you want to close this position?')) {
      return
    }

    try {
      setClosingPositionId(positionId)
      setError(null)

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('Not authenticated')
      }

      const supabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
      
      const response = await fetch(`${supabaseUrl}/functions/v1/risk-management?action=close-position`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tradeId: positionId,
          reason: 'Manually closed by admin'
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to close position')
      }

      alert('✅ Position closed successfully!')
      
      // Refresh positions
      await fetchOpenPositions()
    } catch (err: any) {
      console.error('Error closing position:', err)
      alert(`❌ Failed to close position: ${err?.message || err}`)
      setError(err?.message || 'Failed to close position')
    } finally {
      setClosingPositionId(null)
    }
  }

  if (!isAdmin) {
    return (
      <Card>
        <div className="text-center py-8">
          <i className="ri-shield-cross-line text-6xl text-red-500 mb-4"></i>
          <p className="text-red-400 text-lg mb-2">Access Denied</p>
          <p className="text-gray-500 text-sm">Admin access is required for manual trading.</p>
        </div>
      </Card>
    )
  }

  const filteredPositions = positions.filter(p => {
    if (filters.exchange !== 'all' && p.exchange !== filters.exchange) return false
    if (filters.userId !== 'all' && p.user_id !== filters.userId) return false
    if (filters.symbol && !p.symbol.toLowerCase().includes(filters.symbol.toLowerCase())) return false
    return true
  })

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-700">
        <button
          onClick={() => setActiveTab('place-order')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'place-order'
              ? 'text-blue-400 border-b-2 border-blue-400'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          <i className="ri-add-circle-line mr-2"></i>
          Place Order
        </button>
        <button
          onClick={() => setActiveTab('positions')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'positions'
              ? 'text-blue-400 border-b-2 border-blue-400'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          <i className="ri-file-list-line mr-2"></i>
          Open Positions ({filteredPositions.length})
        </button>
      </div>

      {/* Place Order Tab */}
      {activeTab === 'place-order' && (
        <Card>
          <h2 className="text-2xl font-bold text-white mb-6">Manual Order Placement</h2>
          
          <form onSubmit={handlePlaceOrder} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* User Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  User <span className="text-red-400">*</span>
                </label>
                <select
                  value={orderForm.userId}
                  onChange={(e) => setOrderForm({ ...orderForm, userId: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-800 text-white border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">Select a user...</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.email}
                    </option>
                  ))}
                </select>
              </div>

              {/* Exchange Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Exchange <span className="text-red-400">*</span>
                </label>
                <select
                  value={orderForm.exchange}
                  onChange={(e) => setOrderForm({ ...orderForm, exchange: e.target.value as any })}
                  className="w-full px-3 py-2 bg-gray-800 text-white border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="bybit">Bybit</option>
                  <option value="okx">OKX</option>
                  <option value="bitunix">Bitunix</option>
                  <option value="mexc">MEXC</option>
                </select>
              </div>

              {/* Symbol */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Symbol <span className="text-red-400">*</span> (e.g., BTCUSDT)
                </label>
                <input
                  type="text"
                  value={orderForm.symbol}
                  onChange={(e) => setOrderForm({ ...orderForm, symbol: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 bg-gray-800 text-white border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="BTCUSDT"
                  required
                />
              </div>

              {/* Trading Type */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Trading Type <span className="text-red-400">*</span>
                </label>
                <select
                  value={orderForm.tradingType}
                  onChange={(e) => setOrderForm({ ...orderForm, tradingType: e.target.value as any })}
                  className="w-full px-3 py-2 bg-gray-800 text-white border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="spot">Spot</option>
                  <option value="futures">Futures</option>
                  <option value="linear">Linear (Perpetual)</option>
                </select>
              </div>

              {/* Side */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Side <span className="text-red-400">*</span>
                </label>
                <select
                  value={orderForm.side}
                  onChange={(e) => setOrderForm({ ...orderForm, side: e.target.value as any })}
                  className="w-full px-3 py-2 bg-gray-800 text-white border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="buy">Buy / Long</option>
                  <option value="sell">Sell / Short</option>
                  <option value="long">Long</option>
                  <option value="short">Short</option>
                </select>
              </div>

              {/* Order Type */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Order Type <span className="text-red-400">*</span>
                </label>
                <select
                  value={orderForm.orderType}
                  onChange={(e) => setOrderForm({ ...orderForm, orderType: e.target.value as any })}
                  className="w-full px-3 py-2 bg-gray-800 text-white border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="market">Market</option>
                  <option value="limit">Limit</option>
                </select>
              </div>

              {/* Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Amount <span className="text-red-400">*</span>
                </label>
                <input
                  type="number"
                  step="any"
                  value={orderForm.amount}
                  onChange={(e) => setOrderForm({ ...orderForm, amount: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-800 text-white border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0.001"
                  required
                />
              </div>

              {/* Price (only for limit orders) */}
              {orderForm.orderType === 'limit' && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Price <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={orderForm.price}
                    onChange={(e) => setOrderForm({ ...orderForm, price: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-800 text-white border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="50000"
                    required
                  />
                </div>
              )}
            </div>

            {error && (
              <div className="p-3 bg-red-900/20 border border-red-500/30 rounded-lg">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              disabled={placingOrder}
              className="w-full"
            >
              {placingOrder ? (
                <>
                  <i className="ri-loader-4-line animate-spin mr-2"></i>
                  Placing Order...
                </>
              ) : (
                <>
                  <i className="ri-add-circle-line mr-2"></i>
                  Place Order
                </>
              )}
            </Button>
          </form>
        </Card>
      )}

      {/* Open Positions Tab */}
      {activeTab === 'positions' && (
        <div className="space-y-4">
          {/* Filters */}
          <Card>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Exchange</label>
                <select
                  value={filters.exchange}
                  onChange={(e) => {
                    setFilters({ ...filters, exchange: e.target.value })
                    setTimeout(() => fetchOpenPositions(), 100)
                  }}
                  className="w-full px-3 py-2 bg-gray-800 text-white border border-gray-700 rounded-lg"
                >
                  <option value="all">All Exchanges</option>
                  <option value="bybit">Bybit</option>
                  <option value="okx">OKX</option>
                  <option value="bitunix">Bitunix</option>
                  <option value="mexc">MEXC</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">User</label>
                <select
                  value={filters.userId}
                  onChange={(e) => {
                    setFilters({ ...filters, userId: e.target.value })
                    setTimeout(() => fetchOpenPositions(), 100)
                  }}
                  className="w-full px-3 py-2 bg-gray-800 text-white border border-gray-700 rounded-lg"
                >
                  <option value="all">All Users</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.email}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Symbol</label>
                <input
                  type="text"
                  value={filters.symbol}
                  onChange={(e) => {
                    setFilters({ ...filters, symbol: e.target.value })
                    setTimeout(() => fetchOpenPositions(), 100)
                  }}
                  className="w-full px-3 py-2 bg-gray-800 text-white border border-gray-700 rounded-lg"
                  placeholder="BTCUSDT"
                />
              </div>

              <div className="flex items-end">
                <Button
                  onClick={fetchOpenPositions}
                  variant="secondary"
                  className="w-full"
                >
                  <i className="ri-refresh-line mr-2"></i>
                  Refresh
                </Button>
              </div>
            </div>
          </Card>

          {/* Positions Table */}
          <Card>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-white">
                Open Positions ({filteredPositions.length})
              </h2>
            </div>

            {loading ? (
              <div className="text-center py-8">
                <i className="ri-loader-4-line animate-spin text-3xl text-gray-400"></i>
                <p className="mt-4 text-gray-400">Loading positions...</p>
              </div>
            ) : filteredPositions.length === 0 ? (
              <div className="text-center py-12">
                <i className="ri-file-list-line text-6xl text-gray-600 mb-4"></i>
                <p className="text-gray-400 text-lg mb-2">No open positions found</p>
                <p className="text-gray-500 text-sm">
                  {filters.exchange !== 'all' || filters.userId !== 'all' || filters.symbol
                    ? 'Try adjusting your filters'
                    : 'Open positions will appear here'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="pb-3 text-gray-400 font-semibold">User</th>
                      <th className="pb-3 text-gray-400 font-semibold">Symbol</th>
                      <th className="pb-3 text-gray-400 font-semibold">Exchange</th>
                      <th className="pb-3 text-gray-400 font-semibold">Side</th>
                      <th className="pb-3 text-gray-400 font-semibold">Entry Price</th>
                      <th className="pb-3 text-gray-400 font-semibold">Size</th>
                      <th className="pb-3 text-gray-400 font-semibold">PnL</th>
                      <th className="pb-3 text-gray-400 font-semibold">Status</th>
                      <th className="pb-3 text-gray-400 font-semibold">Opened</th>
                      <th className="pb-3 text-gray-400 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPositions.map((position) => (
                      <tr key={position.id} className="border-b border-gray-800">
                        <td className="py-3 text-white text-sm">
                          {(position as any).users?.email || position.user_id.substring(0, 8) + '...'}
                        </td>
                        <td className="py-3 text-white font-medium">{position.symbol}</td>
                        <td className="py-3">
                          <span className="px-2 py-1 rounded text-xs bg-blue-500/20 text-blue-400 capitalize">
                            {position.exchange}
                          </span>
                        </td>
                        <td className="py-3">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            position.side.toLowerCase() === 'buy' || position.side.toLowerCase() === 'long'
                              ? 'bg-green-500/20 text-green-400'
                              : 'bg-red-500/20 text-red-400'
                          }`}>
                            {position.side.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-3 text-white">${position.entry_price?.toFixed(2) || '0.00'}</td>
                        <td className="py-3 text-white">{position.size || position.amount || '0'}</td>
                        <td className={`py-3 font-medium ${
                          (position.pnl || 0) >= 0 ? 'text-green-400' : 'text-red-400'
                        }`}>
                          ${(position.pnl || 0).toFixed(2)}
                        </td>
                        <td className="py-3">
                          <span className="px-2 py-1 rounded text-xs bg-yellow-500/20 text-yellow-400 capitalize">
                            {position.status}
                          </span>
                        </td>
                        <td className="py-3 text-gray-300 text-sm">
                          {new Date(position.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-3">
                          <Button
                            onClick={() => handleClosePosition(position.id)}
                            disabled={closingPositionId === position.id}
                            variant="secondary"
                            size="sm"
                          >
                            {closingPositionId === position.id ? (
                              <>
                                <i className="ri-loader-4-line animate-spin mr-1"></i>
                                Closing...
                              </>
                            ) : (
                              <>
                                <i className="ri-close-circle-line mr-1"></i>
                                Close
                              </>
                            )}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}
