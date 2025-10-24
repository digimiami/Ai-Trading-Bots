import { useState } from 'react';
import { supabase } from '../lib/supabase';

export interface ProfileData {
  id: string;
  email: string;
  name: string;
  bio?: string;
  location?: string;
  website?: string;
  profile_picture_url?: string;
  created_at?: string;
  updated_at?: string;
}

export function useProfile() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const callProfileFunction = async (action: string, params: any = {}) => {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase.functions.invoke('profile-management', {
        body: { action, ...params }
      });

      if (error) throw error;
      return data;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const getProfile = async (): Promise<ProfileData> => {
    const data = await callProfileFunction('getProfile');
    return data.profile;
  };

  const updateProfile = async (profileData: Partial<ProfileData> & { profilePicture?: string }) => {
    return await callProfileFunction('updateProfile', profileData);
  };

  return {
    loading,
    error,
    getProfile,
    updateProfile
  };
}

