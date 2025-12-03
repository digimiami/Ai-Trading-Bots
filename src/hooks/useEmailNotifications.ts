import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

export interface EmailNotificationPreferences {
  enabled: boolean;
  trade_executed: boolean;
  bot_started: boolean;
  bot_stopped: boolean;
  error_occurred: boolean;
  daily_summary: boolean;
  profit_alert: boolean;
  loss_alert: boolean;
  position_opened: boolean;
  position_closed: boolean;
  stop_loss_triggered: boolean;
  take_profit_triggered: boolean;
}

export interface NotificationPreferences {
  email: EmailNotificationPreferences;
  push: {
    enabled: boolean;
    trade_executed: boolean;
    bot_started: boolean;
    bot_stopped: boolean;
    error_occurred: boolean;
  };
}

export interface UserSettings {
  notification_preferences: NotificationPreferences;
  alert_settings: any;
  risk_settings: any;
}

export function useEmailNotifications() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError;
      }

      if (data) {
        setSettings(data);
      } else {
        // Create default settings if none exist
        const defaultSettings: UserSettings = {
          notification_preferences: {
            email: {
              enabled: false,
              trade_executed: true,
              bot_started: true,
              bot_stopped: true,
              error_occurred: true,
              daily_summary: true,
              profit_alert: true,
              loss_alert: true,
              position_opened: true,
              position_closed: true,
              stop_loss_triggered: true,
              take_profit_triggered: true,
            },
            push: {
              enabled: true,
              trade_executed: true,
              bot_started: true,
              bot_stopped: true,
              error_occurred: true,
            },
          },
          alert_settings: {
            emailAlerts: true,
            pushAlerts: true,
            webhookAlerts: false,
            newTradeAlert: true,
            closePositionAlert: true,
            profitAlert: true,
            profitThreshold: 5,
            lossAlert: true,
            lossThreshold: 5,
            lowBalanceAlert: true,
            lowBalanceThreshold: 100,
            liquidationAlert: true,
            liquidationThreshold: 80,
            dailyPnlAlert: true,
            weeklyPnlAlert: false,
            monthlyPnlAlert: true,
          },
          risk_settings: {
            maxDailyLoss: 500,
            maxPositionSize: 1000,
            stopLossPercentage: 5,
            takeProfitPercentage: 10,
            maxOpenPositions: 5,
            riskPerTrade: 2,
            autoStopTrading: true,
            emergencyStopLoss: 20,
          },
        };

        const { data: newData, error: insertError } = await supabase
          .from('user_settings')
          .insert({
            user_id: user.id,
            notification_preferences: defaultSettings.notification_preferences,
            alert_settings: defaultSettings.alert_settings,
            risk_settings: defaultSettings.risk_settings,
          })
          .select()
          .single();

        if (insertError) throw insertError;

        setSettings(newData);
      }
    } catch (err: any) {
      console.error('Error fetching email notification settings:', err);
      setError(err.message || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, [user]);

  const updateEmailPreferences = useCallback(async (preferences: Partial<EmailNotificationPreferences>) => {
    if (!user || !settings) {
      throw new Error('User not authenticated or settings not loaded');
    }

    // Prevent users from enabling/disabling email notifications
    // Only allow updating individual notification types
    if (preferences.enabled !== undefined) {
      throw new Error('You cannot enable or disable email notifications. Please contact an administrator.');
    }

    try {
      const updatedPreferences = {
        ...settings.notification_preferences,
        email: {
          ...settings.notification_preferences.email,
          ...preferences,
        },
      };

      const { data, error: updateError } = await supabase
        .from('user_settings')
        .update({
          notification_preferences: updatedPreferences,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)
        .select()
        .single();

      if (updateError) throw updateError;

      setSettings(data);
      return { success: true, data };
    } catch (err: any) {
      console.error('Error updating email preferences:', err);
      throw err;
    }
  }, [user, settings]);

  const updateNotificationPreferences = useCallback(async (preferences: Partial<NotificationPreferences>) => {
    if (!user || !settings) {
      throw new Error('User not authenticated or settings not loaded');
    }

    try {
      const updatedPreferences = {
        ...settings.notification_preferences,
        ...preferences,
      };

      const { data, error: updateError } = await supabase
        .from('user_settings')
        .update({
          notification_preferences: updatedPreferences,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)
        .select()
        .single();

      if (updateError) throw updateError;

      setSettings(data);
      return { success: true, data };
    } catch (err: any) {
      console.error('Error updating notification preferences:', err);
      throw err;
    }
  }, [user, settings]);

  const updateAlertSettings = useCallback(async (alertSettings: any) => {
    if (!user || !settings) {
      throw new Error('User not authenticated or settings not loaded');
    }

    try {
      const { data, error: updateError } = await supabase
        .from('user_settings')
        .update({
          alert_settings: alertSettings,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)
        .select()
        .single();

      if (updateError) throw updateError;

      setSettings(data);
      return { success: true, data };
    } catch (err: any) {
      console.error('Error updating alert settings:', err);
      throw err;
    }
  }, [user, settings]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return {
    settings,
    loading,
    error,
    emailPreferences: settings?.notification_preferences?.email || null,
    pushPreferences: settings?.notification_preferences?.push || null,
    alertSettings: settings?.alert_settings || null,
    updateEmailPreferences,
    updateNotificationPreferences,
    updateAlertSettings,
    refreshSettings: fetchSettings,
  };
}

