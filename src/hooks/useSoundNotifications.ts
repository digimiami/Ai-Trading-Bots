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

  // Initialize audio element - only on user interaction
  useEffect(() => {
    // Create audio context - handle browser autoplay policy
    let audioContext: AudioContext | null = null;
    let userInteracted = false;
    
    const initAudioContext = async () => {
      try {
        // Only create AudioContext after user interaction
        if (!userInteracted) {
          console.log('🔔 AudioContext requires user interaction - waiting...');
          return null;
        }
        
        if (!audioContext || audioContext.state === 'closed') {
          audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        
        // Resume audio context if suspended (browser autoplay policy)
        if (audioContext.state === 'suspended') {
          console.log('🔔 AudioContext suspended, attempting to resume...');
          try {
            await audioContext.resume();
            console.log('✅ AudioContext resumed:', audioContext.state);
          } catch (resumeError) {
            console.warn('⚠️ Could not resume AudioContext:', resumeError);
            // Don't fail - we'll try again on next play
          }
        }
        
        return audioContext;
      } catch (error) {
        console.error('❌ Failed to create AudioContext:', error);
        return null;
      }
    };
    
    // Listen for user interaction to enable audio
    const enableAudio = async () => {
      if (!userInteracted) {
        userInteracted = true;
        console.log('🔔 User interaction detected - enabling audio');
        await initAudioContext();
      }
    };
    
    // Add event listeners for user interaction
    const events = ['click', 'touchstart', 'keydown'];
    events.forEach(event => {
      document.addEventListener(event, enableAudio, { once: true });
    });
    
    const createNotificationSound = async () => {
      try {
        // Initialize or resume audio context
        if (!audioContext || audioContext.state === 'closed') {
          audioContext = await initAudioContext();
          if (!audioContext) {
            console.warn('⚠️ Cannot play sound: AudioContext not available');
            return;
          }
        }
        
        // Resume if suspended
        if (audioContext.state === 'suspended') {
          await audioContext.resume();
        }
        
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.type = 'sine';
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        // Create a more noticeable three-tone notification sound
        const now = audioContext.currentTime;
        oscillator.frequency.setValueAtTime(600, now);
        oscillator.frequency.setValueAtTime(800, now + 0.1);
        oscillator.frequency.setValueAtTime(1000, now + 0.2);
        
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(volume * 0.8, now + 0.01);
        gainNode.gain.linearRampToValueAtTime(volume, now + 0.1);
        gainNode.gain.linearRampToValueAtTime(volume, now + 0.2);
        gainNode.gain.linearRampToValueAtTime(0, now + 0.3);
        
        oscillator.start(now);
        oscillator.stop(now + 0.3);
        
        console.log('🔔 Sound notification played successfully');
      } catch (error) {
        console.error('❌ Failed to play sound notification:', error);
        // Try to reinitialize audio context on next attempt
        audioContext = null;
      }
    };

    // Store the function for later use
    (window as any).__playTradeSound = createNotificationSound;

    return () => {
      // Remove event listeners
      events.forEach(event => {
        document.removeEventListener(event, enableAudio);
      });
      
      if (audioContext && audioContext.state !== 'closed') {
        audioContext.close().catch(console.error);
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
        // Note: trades table doesn't have paper_trading column - real trades only go here
        // Use .or() for status filtering since .in() with array doesn't work in Supabase PostgREST
        const { data: recentTrades, error } = await supabase
          .from('trades')
          .select('id, bot_id, created_at, status')
          .in('bot_id', botsWithSoundEnabled)
          .or('status.eq.open,status.eq.filled,status.eq.pending,status.eq.partial')
          .gte('created_at', new Date(Date.now() - 30000).toISOString())
          .order('created_at', { ascending: false })
          .limit(10);

        if (error) {
          // Don't log AbortError - it's just a cancelled request
          if (error.name !== 'AbortError' && error.message !== 'The user aborted a request.') {
            // Suppress network connectivity errors (they're too noisy)
            const errorMessage = error.message || String(error);
            const isNetworkError = 
              errorMessage.includes('Failed to fetch') ||
              errorMessage.includes('ERR_NAME_NOT_RESOLVED') ||
              errorMessage.includes('ERR_NETWORK_CHANGED') ||
              errorMessage.includes('ERR_CONNECTION_RESET') ||
              errorMessage.includes('network');
            
            if (!isNetworkError) {
              console.warn('Error fetching recent trades for sound notifications:', error);
            }
            // Silently return for network errors - they'll retry on next poll
          }
          return;
        }

        if (recentTrades && recentTrades.length > 0) {
          recentTrades.forEach((trade: any) => {
            if (!lastTradeIdsRef.current.has(trade.id)) {
              lastTradeIdsRef.current.add(trade.id);
              
              console.log('🔔 Polling found new trade:', trade.id);
              
              // Play sound notification
              if ((window as any).__playTradeSound) {
                try {
                  (window as any).__playTradeSound();
                  console.log(`✅ Sound notification played for trade: ${trade.id} (Bot: ${trade.bot_id})`);
                } catch (error) {
                  console.error('❌ Failed to play sound notification:', error);
                }
              } else {
                console.warn('⚠️ Sound function not available');
              }
            }
          });
        }
      } catch (error) {
        // Suppress network connectivity errors
        const errorMessage = error instanceof Error ? error.message : String(error);
        const isNetworkError = 
          errorMessage.includes('Failed to fetch') ||
          errorMessage.includes('ERR_NAME_NOT_RESOLVED') ||
          errorMessage.includes('ERR_NETWORK_CHANGED') ||
          errorMessage.includes('ERR_CONNECTION_RESET');
        
        if (!isNetworkError) {
          console.warn('Error in sound notification polling:', error);
        }
        // Silently continue - will retry on next interval
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

