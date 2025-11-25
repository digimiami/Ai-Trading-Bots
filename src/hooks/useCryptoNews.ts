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

      const { data, error: invokeError } = await supabase.functions.invoke('crypto-news-management', {
        body: { action, ...params }
      });

      if (invokeError) {
        console.error('Edge function invoke error:', invokeError);
        const errorMessage = invokeError.message || 'Unknown error occurred';
        setError(errorMessage);
        throw new Error(errorMessage);
      }
      
      if (data?.error) {
        console.error('Edge function returned error:', data);
        const errorMessage = data.details ? `${data.error}: ${data.details}` : (data.error || 'Unknown error occurred');
        setError(errorMessage);
        throw new Error(errorMessage);
      }
      
      return data;
    } catch (err: any) {
      console.error('Crypto news function error:', err);
      const errorMessage = err.message || err.error || err.details || 'Unknown error occurred';
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

  return {
    loading,
    error,
    generateArticle,
    getArticles,
    getArticle,
    createArticle,
    updateArticle,
    deleteArticle,
    publishArticle
  };
}

