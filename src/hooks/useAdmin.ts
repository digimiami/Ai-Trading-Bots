
import { useState } from 'react';
import { supabase } from '../lib/supabase';

interface User {
  id: string;
  email: string;
  role: string;
  created_at: string;
  last_sign_in_at: string;
}

interface InvitationCode {
  id: string;
  code: string;
  email: string;
  used: boolean;
  created_at: string;
  expires_at: string;
}

export function useAdmin() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const callAdminFunction = async (action: string, params: any = {}) => {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase.functions.invoke('admin-management-enhanced', {
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

  const getUsers = async (): Promise<User[]> => {
    const data = await callAdminFunction('getUsers');
    return data.users || [];
  };

  const createUser = async (email: string, password: string, role: string = 'user') => {
    return await callAdminFunction('createUser', { email, password, role });
  };

  const deleteUser = async (userId: string) => {
    return await callAdminFunction('deleteUser', { userId });
  };

  const getInvitationCodes = async (): Promise<InvitationCode[]> => {
    const data = await callAdminFunction('getInvitationCodes');
    return data.codes || [];
  };

  const generateInvitationCode = async (email: string, expiresInDays: number = 7) => {
    return await callAdminFunction('generateInvitationCode', { email, expiresInDays });
  };

  return {
    loading,
    error,
    getUsers,
    createUser,
    deleteUser,
    getInvitationCodes,
    generateInvitationCode
  };
}
