import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

export interface OnboardingResponses {
  experience?: string;
  riskTolerance?: string;
  tradingGoals?: string;
  initialCapital?: string;
  preferredExchange?: string;
}

export function useSetupWizard() {
  const { user } = useAuth();
  const [completed, setCompleted] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [onboardingData, setOnboardingData] = useState<OnboardingResponses>({});

  useEffect(() => {
    if (user) {
      fetchWizardStatus();
    }
  }, [user]);

  const fetchWizardStatus = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('users')
        .select('setup_wizard_completed, onboarding_responses')
        .eq('id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching wizard status:', error);
        return;
      }

      if (data) {
        setCompleted(data.setup_wizard_completed || false);
        setOnboardingData((data.onboarding_responses as OnboardingResponses) || {});
      }
    } catch (error) {
      console.error('Error fetching wizard status:', error);
    } finally {
      setLoading(false);
    }
  };

  const markWizardCompleted = async (responses?: OnboardingResponses) => {
    if (!user) return false;

    try {
      const updateData: any = {
        setup_wizard_completed: true,
        updated_at: new Date().toISOString()
      };

      if (responses) {
        updateData.onboarding_responses = responses;
        setOnboardingData(responses);
      }

      const { error } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', user.id);

      if (error) {
        console.error('Error marking wizard as completed:', error);
        return false;
      }

      setCompleted(true);
      return true;
    } catch (error) {
      console.error('Error marking wizard as completed:', error);
      return false;
    }
  };

  const resetWizard = async () => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('users')
        .update({
          setup_wizard_completed: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (error) {
        console.error('Error resetting wizard:', error);
        return false;
      }

      setCompleted(false);
      return true;
    } catch (error) {
      console.error('Error resetting wizard:', error);
      return false;
    }
  };

  const updateOnboardingData = async (data: Partial<OnboardingResponses>) => {
    if (!user) return false;

    try {
      const newData = { ...onboardingData, ...data };
      const { error } = await supabase
        .from('users')
        .update({
          onboarding_responses: newData,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (error) {
        console.error('Error updating onboarding data:', error);
        return false;
      }

      setOnboardingData(newData);
      return true;
    } catch (error) {
      console.error('Error updating onboarding data:', error);
      return false;
    }
  };

  return {
    completed,
    loading,
    onboardingData,
    markWizardCompleted,
    resetWizard,
    updateOnboardingData,
    refreshStatus: fetchWizardStatus
  };
}

