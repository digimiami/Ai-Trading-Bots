import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

export interface BotReport {
  generated_at: string;
  overview: {
    total_bots: number;
    active_bots: number;
    total_pnl: number;
    total_pnl_from_trades?: number;
    total_pnl_from_bots?: number;
    total_fees: number;
    net_profit_loss: number;
    total_trades: number;
  };
  active_bots: Array<{
    id: string;
    name: string;
    symbol: string;
    exchange: string;
    trading_type: string;
    status: string;
    pnl: number;
    total_trades: number;
    win_rate: number;
    last_trade_at: string | null;
  }>;
  contract_summary: Array<{
    contract: string;
    exchange: string;
    total_trades: number;
    total_net_pnl: number;
    total_fees_paid: number;
    net_profit_loss: number;
  }>;
  recent_trades: Array<{
    id: string;
    symbol: string;
    pnl: number;
    fee: number;
    amount: number;
    price: number;
    created_at: string;
  }>;
}

export async function generateBotReport(): Promise<BotReport> {
  const supabase = createClient(supabaseUrl!, supabaseAnonKey!);
  
  // Get current session
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new Error('Not authenticated');
  }

  // Call the edge function
  const response = await fetch(`${supabaseUrl}/functions/v1/bot-report`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to generate report');
  }

  const data = await response.json();
  return data.report;
}

