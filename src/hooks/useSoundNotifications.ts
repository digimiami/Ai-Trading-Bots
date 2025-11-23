import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useBots } from './useBots';

/**
 * Hook to handle sound notifications for real trades
 * Plays a sound when a real trade is executed for bots with sound notifications enabled
 */
export function useSoundNotifications() {
  const { bots } = useBots();
  const [enabled, setEnabled] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastTradeIdsRef = useRef<Set<string>>(new Set());
  const [volume, setVolume] = useState(0.7);

  // Initialize audio element
  useEffect(() => {
    // Create audio element with a simple notification sound
    // Using Web Audio API to generate a pleasant notification sound
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    const createNotificationSound = () => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Create a pleasant two-tone notification sound
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 0.1);
      
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(volume, audioContext.currentTime + 0.01);
      gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.2);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.2);
    };

    // Store the function for later use
    (window as any).__playTradeSound = createNotificationSound;

    return () => {
      if (audioContext.state !== 'closed') {
        audioContext.close();
      }
    };
  }, [volume]);

  // Load volume preference from localStorage
  useEffect(() => {
    const savedVolume = localStorage.getItem('sound_notification_volume');
    if (savedVolume) {
      setVolume(parseFloat(savedVolume));
    }
  }, []);

  // Listen for new real trades
  useEffect(() => {
    if (!enabled) {
      console.log('🔕 Sound notifications disabled');
      return;
    }

    // Get list of bot IDs that have sound notifications enabled
    const botsWithSoundEnabled = bots
      .filter(bot => bot.soundNotificationsEnabled && !bot.paperTrading)
      .map(bot => bot.id);

    console.log('🔔 Sound notifications setup:', {
      enabled,
      totalBots: bots.length,
      botsWithSoundEnabled: botsWithSoundEnabled.length,
      botIds: botsWithSoundEnabled
    });

    if (botsWithSoundEnabled.length === 0) {
      console.log('🔕 No bots with sound notifications enabled');
      return;
    }

    // Subscribe to trades table changes
    const channel = supabase
      .channel('trade-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'trades',
          filter: `bot_id=in.(${botsWithSoundEnabled.join(',')})`,
        },
        (payload) => {
          console.log('🔔 Trade INSERT event received:', payload);
          const newTrade = payload.new as any;
          
          console.log('🔔 Processing trade:', {
            id: newTrade.id,
            bot_id: newTrade.bot_id,
            paper_trading: newTrade.paper_trading,
            status: newTrade.status,
            side: newTrade.side
          });
          
          // Skip if we've already processed this trade
          if (lastTradeIdsRef.current.has(newTrade.id)) {
            console.log('🔕 Trade already processed, skipping:', newTrade.id);
            return;
          }

          // Only play sound for real trades (not paper trading)
          // Real trades have paper_trading as null, undefined, or false
          if (newTrade.paper_trading === true) {
            console.log('🔕 Skipping paper trading trade:', newTrade.id);
            return;
          }

          // Only play sound for trades that are opening positions (not closing)
          // Status should be 'open', 'filled', 'pending', or 'partial' for new positions
          const validStatuses = ['open', 'filled', 'pending', 'partial'];
          const tradeStatus = (newTrade.status || '').toLowerCase();
          if (tradeStatus && !validStatuses.includes(tradeStatus)) {
            console.log('🔕 Skipping trade with status (likely closing):', newTrade.status);
            return;
          }

          // Mark this trade as processed
          lastTradeIdsRef.current.add(newTrade.id);
          
          // Clean up old trade IDs (keep only last 100)
          if (lastTradeIdsRef.current.size > 100) {
            const idsArray = Array.from(lastTradeIdsRef.current);
            lastTradeIdsRef.current = new Set(idsArray.slice(-50));
          }

          // Play sound notification
          if ((window as any).__playTradeSound) {
            try {
              console.log('🔔 Playing sound notification for real trade:', newTrade.id);
              (window as any).__playTradeSound();
              console.log(`✅ Sound notification played for trade: ${newTrade.id} (Bot: ${newTrade.bot_id})`);
            } catch (error) {
              console.error('❌ Failed to play sound notification:', error);
            }
          } else {
            console.warn('⚠️ Sound function not available (__playTradeSound not found)');
          }
        }
      )
      .subscribe((status) => {
        console.log('🔔 Realtime subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('✅ Successfully subscribed to trade notifications');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Realtime channel error - sound notifications may not work');
        }
      });

    return () => {
      console.log('🔕 Unsubscribing from trade notifications');
      supabase.removeChannel(channel);
    };
  }, [enabled, bots]);

  // Polling fallback (in case realtime doesn't work)
  useEffect(() => {
    if (!enabled) return;

    const botsWithSoundEnabled = bots
      .filter(bot => bot.soundNotificationsEnabled && !bot.paperTrading)
      .map(bot => bot.id);

    if (botsWithSoundEnabled.length === 0) return;

    const pollInterval = setInterval(async () => {
      try {
        // Fetch recent trades (last 30 seconds) for enabled bots
        const { data: recentTrades, error } = await supabase
          .from('trades')
          .select('id, bot_id, created_at, paper_trading')
          .in('bot_id', botsWithSoundEnabled)
          .eq('paper_trading', false)
          .gte('created_at', new Date(Date.now() - 30000).toISOString())
          .order('created_at', { ascending: false })
          .limit(10);

        if (error) {
          console.warn('Error fetching recent trades for sound notifications:', error);
          return;
        }

        if (recentTrades && recentTrades.length > 0) {
          recentTrades.forEach((trade: any) => {
            if (!lastTradeIdsRef.current.has(trade.id)) {
              lastTradeIdsRef.current.add(trade.id);
              
              // Play sound notification
              if ((window as any).__playTradeSound) {
                try {
                  (window as any).__playTradeSound();
                  console.log(`🔔 Sound notification played for trade: ${trade.id} (Bot: ${trade.bot_id})`);
                } catch (error) {
                  console.warn('Failed to play sound notification:', error);
                }
              }
            }
          });
        }
      } catch (error) {
        console.warn('Error in sound notification polling:', error);
      }
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(pollInterval);
  }, [enabled, bots]);

  const playTestSound = () => {
    if ((window as any).__playTradeSound) {
      (window as any).__playTradeSound();
    }
  };

  const updateVolume = (newVolume: number) => {
    setVolume(newVolume);
    localStorage.setItem('sound_notification_volume', newVolume.toString());
  };

  return {
    enabled,
    setEnabled,
    volume,
    setVolume: updateVolume,
    playTestSound,
  };
}

