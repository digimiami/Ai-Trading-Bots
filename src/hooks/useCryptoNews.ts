import { useState } from 'react';
import { supabase } from '../lib/supabase';

export interface CryptoNewsArticle {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt?: string;
  keywords?: string[];
  author_id: string;
  status: 'draft' | 'published' | 'archived';
  meta_title?: string;
  meta_description?: string;
  meta_keywords?: string[];
  og_title?: string;
  og_description?: string;
  og_image_url?: string;
  twitter_card?: string;
  twitter_title?: string;
  twitter_description?: string;
  canonical_url?: string;
  featured_image_url?: string;
  category?: string;
  tags?: string[];
  reading_time?: number;
  view_count?: number;
  published_at?: string;
  created_at: string;
  updated_at: string;
}

export function useCryptoNews() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const callCryptoNewsFunction = async (action: string, params: any = {}) => {
    try {
      setLoading(true);
      setError(null);

      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated. Please log in.');
      }

      // Get Supabase URL - handle both formats
      let supabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL || '';
      
      // Remove /rest/v1 if present
      if (supabaseUrl.includes('/rest/v1')) {
        supabaseUrl = supabaseUrl.replace('/rest/v1', '');
      }
      
      const functionUrl = `${supabaseUrl}/functions/v1/crypto-news-management`;

      console.log('📡 Calling crypto-news-management:', { 
        action, 
        functionUrl,
        hasSession: !!session,
        supabaseUrl 
      });

      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || ''
        },
        body: JSON.stringify({ action, ...params })
      });

      console.log('📡 Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Edge function error:', {
          status: response.status,
          statusText: response.statusText,
          errorText
        });
        
        let errorMessage = `Failed to send request: ${response.status}`;
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || errorData.message || errorMessage;
          if (errorData.details) {
            errorMessage += `: ${errorData.details}`;
          }
        } catch {
          errorMessage = errorText || errorMessage;
        }
        
        setError(errorMessage);
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log('✅ Response data:', data);

      if (data?.error) {
        console.error('Edge function returned error:', data);
        const errorMessage = data.details ? `${data.error}: ${data.details}` : (data.error || 'Unknown error occurred');
        setError(errorMessage);
        throw new Error(errorMessage);
      }
      
      return data;
    } catch (err: any) {
      console.error('Crypto news function error:', err);
      const errorMessage = err.message || err.error || err.details || 'Failed to send a request to the Edge Function';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const generateArticle = async (keywords: string[], title?: string, category?: string) => {
    return await callCryptoNewsFunction('generateArticle', { keywords, title, category });
  };

  const getArticles = async (status?: string, limit?: number, offset?: number) => {
    const data = await callCryptoNewsFunction('getArticles', { status, limit, offset });
    return data.articles || [];
  };

  const getArticle = async (id?: string, slug?: string) => {
    const data = await callCryptoNewsFunction('getArticle', { id, slug });
    return data.article;
  };

  const createArticle = async (article: Partial<CryptoNewsArticle>) => {
    const data = await callCryptoNewsFunction('createArticle', article);
    return data.article;
  };

  const updateArticle = async (id: string, article: Partial<CryptoNewsArticle>) => {
    const data = await callCryptoNewsFunction('updateArticle', { id, ...article });
    return data.article;
  };

  const deleteArticle = async (id: string) => {
    return await callCryptoNewsFunction('deleteArticle', { id });
  };

  const publishArticle = async (id: string) => {
    const data = await callCryptoNewsFunction('publishArticle', { id });
    return data.article;
  };

  // Keyword list management functions
  const getKeywordLists = async () => {
    const data = await callCryptoNewsFunction('getKeywordLists');
    return data.keywordLists || [];
  };

  const createKeywordList = async (keywordList: {
    name: string;
    keywords: string[];
    category?: string;
    enabled?: boolean;
    frequency_hours?: number;
    auto_publish?: boolean;
    max_articles_per_run?: number;
  }) => {
    const data = await callCryptoNewsFunction('createKeywordList', keywordList);
    return data.keywordList;
  };

  const updateKeywordList = async (id: string, keywordList: Partial<{
    name: string;
    keywords: string[];
    category: string;
    enabled: boolean;
    frequency_hours: number;
    auto_publish: boolean;
    max_articles_per_run: number;
  }>) => {
    const data = await callCryptoNewsFunction('updateKeywordList', { id, ...keywordList });
    return data.keywordList;
  };

  const deleteKeywordList = async (id: string) => {
    return await callCryptoNewsFunction('deleteKeywordList', { id });
  };

  const runAutoPosting = async () => {
    const data = await callCryptoNewsFunction('runAutoPosting');
    return data;
  };

  return {
    loading,
    error,
    generateArticle,
    getArticles,
    getArticle,
    createArticle,
    updateArticle,
    deleteArticle,
    publishArticle,
    getKeywordLists,
    createKeywordList,
    updateKeywordList,
    deleteKeywordList,
    runAutoPosting
  };
}

