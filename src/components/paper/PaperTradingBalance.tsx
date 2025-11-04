import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Card from '../base/Card';
import Button from '../base/Button';

export default function PaperTradingBalance() {
  const [balance, setBalance] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [addAmount, setAddAmount] = useState('');
  
  useEffect(() => {
    fetchBalance();
  }, []);
  
  const fetchBalance = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    const { data } = await supabase
      .from('paper_trading_accounts')
      .select('*')
      .eq('user_id', user.id)
      .single();
    
    if (data) {
      setBalance(data);
    }
  };
  
  const handleAddFunds = async () => {
    const amount = parseFloat(addAmount);
    if (!amount || amount <= 0) {
      alert('Please enter a valid amount');
      return;
    }
    
    setLoading(true);
    try {
      // Call edge function to add funds
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/paper-trading`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'add_funds',
          amount: amount
        })
      });
      
      if (response.ok) {
        await fetchBalance();
        setAddAmount('');
        alert(`✅ Added $${amount.toFixed(2)} to paper trading balance`);
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add funds');
      }
    } catch (error: any) {
      alert('Error adding funds: ' + error.message);
    } finally {
      setLoading(false);
    }
  };
  
  if (!balance) {
    // Return null if no balance yet (will be created on first trade)
    return null;
  }
  
  return (
    <Card className="p-4">
      <h3 className="text-lg font-semibold mb-3">📝 Paper Trading Balance</h3>
      <div className="space-y-3">
        <div className="flex justify-between">
          <span className="text-gray-600">Available Balance:</span>
          <span className="text-xl font-bold text-green-600">
            ${parseFloat(balance.balance).toFixed(2)}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Initial Balance:</span>
          <span>${parseFloat(balance.initial_balance).toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Total Deposited:</span>
          <span className="text-green-600">${parseFloat(balance.total_deposited || 0).toFixed(2)}</span>
        </div>
        <div className="border-t pt-3 mt-3">
          <div className="flex gap-2">
            <input
              type="number"
              value={addAmount}
              onChange={(e) => setAddAmount(e.target.value)}
              placeholder="Amount to add"
              className="flex-1 px-3 py-2 border rounded-lg"
              min="1"
              step="0.01"
            />
            <Button
              onClick={handleAddFunds}
              loading={loading}
              variant="primary"
            >
              Add Funds
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

