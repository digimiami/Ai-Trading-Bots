/**
 * Test Trade Notification Script
 * 
 * Run this in your browser console while logged into your app
 * 
 * This script will:
 * 1. Find your first running bot
 * 2. Execute it to trigger a trade
 * 3. Monitor for Telegram notification logs
 * 
 * Usage:
 * 1. Open your app in browser
 * 2. Open Developer Console (F12)
 * 3. Copy and paste this entire script
 * 4. Press Enter
 * 5. Check your Telegram and Supabase logs
 */

(async function testTradeNotification() {
  console.log('🧪 Starting Trade Notification Test...\n');
  
  try {
    // Get Supabase URL and keys from the page (they're usually in localStorage or window)
    const SUPABASE_URL = window.SUPABASE_URL || 'https://dkawxgwdqiirgmmjbvhc.supabase.co';
    const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || localStorage.getItem('sb-dkawxgwdqiirgmmjbvhc-auth-token')?.split('"anon_key":"')[1]?.split('"')[0];
    
    if (!SUPABASE_ANON_KEY) {
      console.error('❌ Could not find Supabase anon key. Please set it manually:');
      console.log('   window.SUPABASE_ANON_KEY = "your-anon-key";');
      console.log('   Then run this script again.');
      return;
    }
    
    console.log('✅ Found Supabase config');
    console.log('   URL:', SUPABASE_URL);
    console.log('   Key:', SUPABASE_ANON_KEY.substring(0, 20) + '...\n');
    
    // Create Supabase client
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    // Check authentication
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      console.error('❌ Not authenticated. Please log in first.');
      return;
    }
    
    console.log('✅ Authenticated as:', session.user.email);
    console.log('   User ID:', session.user.id, '\n');
    
    // Get first running bot
    console.log('🔍 Looking for running bots...');
    const { data: bots, error: botsError } = await supabase
      .from('trading_bots')
      .select('id, name, symbol, status, exchange')
      .eq('status', 'running')
      .eq('user_id', session.user.id)
      .limit(1);
    
    if (botsError) {
      console.error('❌ Error fetching bots:', botsError);
      return;
    }
    
    if (!bots || bots.length === 0) {
      console.error('❌ No running bots found.');
      console.log('💡 Please create a bot and set its status to "running" first.');
      return;
    }
    
    const bot = bots[0];
    console.log('✅ Found bot:', bot.name);
    console.log('   ID:', bot.id);
    console.log('   Symbol:', bot.symbol);
    console.log('   Exchange:', bot.exchange, '\n');
    
    // Check Telegram config
    console.log('🔍 Checking Telegram configuration...');
    const { data: telegramConfig, error: tgError } = await supabase
      .from('telegram_config')
      .select('*')
      .eq('user_id', session.user.id)
      .single();
    
    if (tgError || !telegramConfig) {
      console.warn('⚠️ No Telegram config found. Notifications may not work.');
      console.log('   Please configure Telegram in Settings → Telegram Notifications\n');
    } else {
      console.log('✅ Telegram config found');
      console.log('   Enabled:', telegramConfig.enabled);
      console.log('   Trade Executed Notifications:', telegramConfig.notifications?.trade_executed || false);
      
      if (!telegramConfig.enabled || !telegramConfig.notifications?.trade_executed) {
        console.warn('⚠️ Trade notifications are not enabled!');
        console.log('   Please enable them in Settings → Telegram Notifications\n');
      } else {
        console.log('   ✅ Notifications are enabled!\n');
      }
    }
    
    // Confirm before executing
    console.log('🚀 Ready to execute bot and trigger a trade...');
    const confirm = window.confirm(
      `Execute bot "${bot.name}" to test Telegram notifications?\n\n` +
      `This will:\n` +
      `1. Execute the bot (may place a real trade)\n` +
      `2. Trigger Telegram notification\n` +
      `3. Record the trade in database\n\n` +
      `Continue?`
    );
    
    if (!confirm) {
      console.log('❌ Test cancelled by user.');
      return;
    }
    
    console.log('\n🚀 Executing bot...');
    console.log('   This may take 10-30 seconds...\n');
    
    // Execute bot
    const startTime = Date.now();
    const response = await fetch(`${SUPABASE_URL}/functions/v1/bot-executor`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY
      },
      body: JSON.stringify({
        action: 'execute_bot',
        botId: bot.id
      })
    });
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Execution failed:', response.status, response.statusText);
      console.error('   Error:', errorText);
      return;
    }
    
    const result = await response.json();
    console.log('✅ Bot execution completed in', duration, 'seconds');
    console.log('   Result:', result, '\n');
    
    // Wait a moment for notification to be sent
    console.log('⏳ Waiting for notification to be sent...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Check recent trades
    console.log('🔍 Checking for recent trades...');
    const { data: recentTrades, error: tradesError } = await supabase
      .from('trades')
      .select('*')
      .eq('bot_id', bot.id)
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (tradesError) {
      console.warn('⚠️ Could not check trades:', tradesError);
    } else if (recentTrades && recentTrades.length > 0) {
      const trade = recentTrades[0];
      console.log('✅ Trade recorded!');
      console.log('   Trade ID:', trade.id);
      console.log('   Symbol:', trade.symbol || trade.bot_id);
      console.log('   Side:', trade.side);
      console.log('   Price:', trade.price || trade.entry_price);
      console.log('   Amount:', trade.amount || trade.size);
      console.log('   Status:', trade.status);
      console.log('   Created:', new Date(trade.created_at).toLocaleString(), '\n');
    } else {
      console.warn('⚠️ No recent trades found. Bot may not have executed a trade.');
      console.log('   This could mean:\n' +
                  '   - Bot strategy didn\'t trigger a trade signal\n' +
                  '   - Insufficient balance\n' +
                  '   - API configuration issue\n');
    }
    
    // Final instructions
    console.log('📋 Next Steps:');
    console.log('   1. Check your Telegram chat for notification');
    console.log('   2. Check Supabase Edge Function logs:');
    console.log('      - bot-executor logs (should show "✅ Telegram notification sent")');
    console.log('      - telegram-notifier logs (should show "✅ Message sent")');
    console.log('   3. If no notification received, check the troubleshooting guide:');
    console.log('      See TEST_TELEGRAM_NOTIFICATIONS.md\n');
    
    console.log('✅ Test completed!');
    
  } catch (error) {
    console.error('❌ Test failed with error:', error);
    console.error('   Stack:', error.stack);
  }
})();

