import { useState, useEffect } from 'react';
import Card from '../../../components/base/Card';
import Button from '../../../components/base/Button';
import { useCryptoNews, type CryptoNewsArticle } from '../../../hooks/useCryptoNews';

interface CryptoNewsManagerProps {
  onArticlePublished?: () => void;
}

export default function CryptoNewsManager({ onArticlePublished }: CryptoNewsManagerProps) {
  const {
    loading,
    error,
    generateArticle,
    getArticles,
    createArticle,
    updateArticle,
    deleteArticle,
    publishArticle
  } = useCryptoNews();

  const [articles, setArticles] = useState<CryptoNewsArticle[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingArticle, setEditingArticle] = useState<CryptoNewsArticle | null>(null);
  const [generating, setGenerating] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'published' | 'archived'>('all');

  const [articleForm, setArticleForm] = useState({
    title: '',
    content: '',
    excerpt: '',
    keywords: [] as string[],
    keywordInput: '',
    category: 'general',
    status: 'draft' as 'draft' | 'published' | 'archived',
    meta_title: '',
    meta_description: '',
    meta_keywords: [] as string[],
    meta_keywordInput: '',
    og_title: '',
    og_description: '',
    og_image_url: '',
    twitter_card: 'summary_large_image',
    twitter_title: '',
    twitter_description: '',
    canonical_url: '',
    featured_image_url: '',
    tags: [] as string[],
    tagInput: ''
  });

  useEffect(() => {
    loadArticles();
  }, [statusFilter]);

  const loadArticles = async () => {
    try {
      const articlesData = await getArticles(statusFilter === 'all' ? undefined : statusFilter);
      setArticles(articlesData);
    } catch (error) {
      console.error('Error loading articles:', error);
    }
  };

  const handleGenerateArticle = async () => {
    if (articleForm.keywords.length === 0) {
      alert('Please add at least one keyword');
      return;
    }

    setGenerating(true);
    try {
      console.log('🚀 Generating article with keywords:', articleForm.keywords);
      const result = await generateArticle(
        articleForm.keywords,
        articleForm.title || undefined,
        articleForm.category
      );

      console.log('✅ Article generation result:', result);

      if (result && result.article) {
        setArticleForm(prev => ({
          ...prev,
          title: result.article.title || prev.title,
          content: result.article.content || prev.content,
          excerpt: result.article.excerpt || prev.excerpt,
          reading_time: result.article.reading_time,
          // Auto-fill SEO meta tags
          meta_title: result.article.meta_title || result.article.title || prev.title,
          meta_description: result.article.meta_description || result.article.excerpt || prev.excerpt,
          meta_keywords: result.article.meta_keywords || result.article.keywords || prev.keywords,
          og_title: result.article.og_title || result.article.title || prev.title,
          og_description: result.article.og_description || result.article.excerpt || prev.excerpt,
          twitter_title: result.article.twitter_title || result.article.title || prev.title,
          twitter_description: result.article.twitter_description || result.article.excerpt || prev.excerpt,
          tags: result.article.tags || prev.tags
        }));
        alert('✅ Article generated successfully with SEO meta tags! Review and edit as needed.');
      } else {
        throw new Error('No article data returned from API');
      }
    } catch (error: any) {
      console.error('❌ Article generation error:', error);
      const errorMessage = error?.message || error?.error || String(error);
      alert(`❌ Failed to generate article: ${errorMessage}\n\nPlease check:\n1. Edge Function is deployed\n2. DeepSeek API key is configured\n3. You have admin access`);
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveArticle = async () => {
    if (!articleForm.title || !articleForm.content) {
      alert('Title and content are required');
      return;
    }

    try {
      if (editingArticle) {
        await updateArticle(editingArticle.id, articleForm);
        alert('✅ Article updated successfully');
      } else {
        await createArticle(articleForm);
        alert('✅ Article created successfully');
      }
      setShowCreateModal(false);
      setShowEditModal(false);
      setEditingArticle(null);
      resetForm();
      await loadArticles();
    } catch (error: any) {
      alert(`❌ Failed to save article: ${error?.message || error}`);
    }
  };

  const handleEditArticle = (article: CryptoNewsArticle) => {
    setEditingArticle(article);
    setArticleForm({
      title: article.title,
      content: article.content,
      excerpt: article.excerpt || '',
      keywords: article.keywords || [],
      keywordInput: '',
      category: article.category || 'general',
      status: article.status,
      meta_title: article.meta_title || '',
      meta_description: article.meta_description || '',
      meta_keywords: article.meta_keywords || [],
      meta_keywordInput: '',
      og_title: article.og_title || '',
      og_description: article.og_description || '',
      og_image_url: article.og_image_url || '',
      twitter_card: article.twitter_card || 'summary_large_image',
      twitter_title: article.twitter_title || '',
      twitter_description: article.twitter_description || '',
      canonical_url: article.canonical_url || '',
      featured_image_url: article.featured_image_url || '',
      tags: article.tags || [],
      tagInput: ''
    });
    setShowEditModal(true);
  };

  const handleDeleteArticle = async (id: string, title: string) => {
    if (!confirm(`Delete article "${title}"? This cannot be undone.`)) return;

    try {
      await deleteArticle(id);
      alert('✅ Article deleted successfully');
      await loadArticles();
    } catch (error: any) {
      alert(`❌ Failed to delete article: ${error?.message || error}`);
    }
  };

  const handlePublishArticle = async (id: string) => {
    try {
      await publishArticle(id);
      alert('✅ Article published successfully');
      await loadArticles();
      if (onArticlePublished) onArticlePublished();
    } catch (error: any) {
      alert(`❌ Failed to publish article: ${error?.message || error}`);
    }
  };

  const resetForm = () => {
    setArticleForm({
      title: '',
      content: '',
      excerpt: '',
      keywords: [],
      keywordInput: '',
      category: 'general',
      status: 'draft',
      meta_title: '',
      meta_description: '',
      meta_keywords: [],
      meta_keywordInput: '',
      og_title: '',
      og_description: '',
      og_image_url: '',
      twitter_card: 'summary_large_image',
      twitter_title: '',
      twitter_description: '',
      canonical_url: '',
      featured_image_url: '',
      tags: [],
      tagInput: ''
    });
  };

  const addKeyword = () => {
    if (articleForm.keywordInput.trim()) {
      setArticleForm(prev => ({
        ...prev,
        keywords: [...prev.keywords, prev.keywordInput.trim()],
        keywordInput: ''
      }));
    }
  };

  const removeKeyword = (index: number) => {
    setArticleForm(prev => ({
      ...prev,
      keywords: prev.keywords.filter((_, i) => i !== index)
    }));
  };

  const addMetaKeyword = () => {
    if (articleForm.meta_keywordInput.trim()) {
      setArticleForm(prev => ({
        ...prev,
        meta_keywords: [...prev.meta_keywords, prev.meta_keywordInput.trim()],
        meta_keywordInput: ''
      }));
    }
  };

  const removeMetaKeyword = (index: number) => {
    setArticleForm(prev => ({
      ...prev,
      meta_keywords: prev.meta_keywords.filter((_, i) => i !== index)
    }));
  };

  const addTag = () => {
    if (articleForm.tagInput.trim()) {
      setArticleForm(prev => ({
        ...prev,
        tags: [...prev.tags, prev.tagInput.trim()],
        tagInput: ''
      }));
    }
  };

  const removeTag = (index: number) => {
    setArticleForm(prev => ({
      ...prev,
      tags: prev.tags.filter((_, i) => i !== index)
    }));
  };

  return (
    <div className="space-y-6">
      <Card className="p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Crypto News Articles</h3>
          <div className="flex gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="all">All Status</option>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
            <Button onClick={() => { resetForm(); setShowCreateModal(true); }}>
              <i className="ri-add-line mr-2"></i>
              Create Article
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <i className="ri-loader-4-line animate-spin text-2xl text-gray-400"></i>
          </div>
        ) : articles.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <i className="ri-newspaper-line text-4xl mb-2"></i>
            <p>No articles found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {articles.map((article) => (
              <div key={article.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="font-semibold text-gray-900">{article.title}</h4>
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      article.status === 'published' ? 'bg-green-100 text-green-800' :
                      article.status === 'draft' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {article.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{article.excerpt || article.content.substring(0, 150)}...</p>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>Category: {article.category}</span>
                    <span>Reading time: {article.reading_time || 'N/A'} min</span>
                    <span>Views: {article.view_count || 0}</span>
                    {article.published_at && (
                      <span>Published: {new Date(article.published_at).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleEditArticle(article)}
                  >
                    <i className="ri-edit-line"></i>
                  </Button>
                  {article.status !== 'published' && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handlePublishArticle(article.id)}
                    >
                      <i className="ri-send-plane-line"></i>
                      Publish
                    </Button>
                  )}
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => handleDeleteArticle(article.id, article.title)}
                  >
                    <i className="ri-delete-bin-line"></i>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Create/Edit Article Modal */}
      {(showCreateModal || showEditModal) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">
                {editingArticle ? 'Edit Article' : 'Create New Article'}
              </h3>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setShowEditModal(false);
                  setEditingArticle(null);
                  resetForm();
                }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <i className="ri-close-line text-xl"></i>
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <div className="space-y-4">
              {/* Keywords for Generation */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Keywords for AI Generation
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={articleForm.keywordInput}
                    onChange={(e) => setArticleForm({...articleForm, keywordInput: e.target.value})}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addKeyword())}
                    placeholder="Add keyword and press Enter"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                  />
                  <Button type="button" onClick={addKeyword} variant="secondary">
                    Add
                  </Button>
                  <Button
                    type="button"
                    onClick={handleGenerateArticle}
                    variant="primary"
                    disabled={generating || articleForm.keywords.length === 0}
                  >
                    {generating ? (
                      <>
                        <i className="ri-loader-4-line animate-spin mr-2"></i>
                        Generating...
                      </>
                    ) : (
                      <>
                        <i className="ri-magic-line mr-2"></i>
                        Generate with DeepSeek
                      </>
                    )}
                  </Button>
                </div>
                {articleForm.keywords.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {articleForm.keywords.map((keyword, index) => (
                      <span
                        key={index}
                        className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-sm flex items-center gap-1"
                      >
                        {keyword}
                        <button
                          onClick={() => removeKeyword(index)}
                          className="hover:text-blue-600"
                        >
                          <i className="ri-close-line text-xs"></i>
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Basic Article Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                  <input
                    type="text"
                    value={articleForm.title}
                    onChange={(e) => setArticleForm({...articleForm, title: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select
                    value={articleForm.category}
                    onChange={(e) => setArticleForm({...articleForm, category: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="general">General</option>
                    <option value="bitcoin">Bitcoin (BTC)</option>
                    <option value="ethereum">Ethereum (ETH)</option>
                    <option value="xrp">XRP</option>
                    <option value="solana">Solana (SOL)</option>
                    <option value="cardano">Cardano (ADA)</option>
                    <option value="polkadot">Polkadot (DOT)</option>
                    <option value="dogecoin">Dogecoin (DOGE)</option>
                    <option value="shiba">Shiba Inu (SHIB)</option>
                    <option value="ondo">ONDO</option>
                    <option value="xml">XML</option>
                    <option value="binance-coin">Binance Coin (BNB)</option>
                    <option value="polygon">Polygon (MATIC)</option>
                    <option value="avalanche">Avalanche (AVAX)</option>
                    <option value="chainlink">Chainlink (LINK)</option>
                    <option value="litecoin">Litecoin (LTC)</option>
                    <option value="uniswap">Uniswap (UNI)</option>
                    <option value="altcoins">Altcoins</option>
                    <option value="defi">DeFi</option>
                    <option value="nft">NFT</option>
                    <option value="trading">Trading</option>
                    <option value="analysis">Analysis</option>
                    <option value="market-update">Market Update</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Content *</label>
                <textarea
                  value={articleForm.content}
                  onChange={(e) => setArticleForm({...articleForm, content: e.target.value})}
                  rows={15}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm"
                  required
                  placeholder="Article content (markdown supported)"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Excerpt</label>
                <textarea
                  value={articleForm.excerpt}
                  onChange={(e) => setArticleForm({...articleForm, excerpt: e.target.value})}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="Short description (auto-generated if empty)"
                />
              </div>

              {/* SEO Meta Tags Section */}
              <div className="border-t pt-4">
                <h4 className="font-semibold mb-3">SEO Meta Tags</h4>
                
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Meta Title</label>
                    <input
                      type="text"
                      value={articleForm.meta_title}
                      onChange={(e) => setArticleForm({...articleForm, meta_title: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="Auto-filled from title if empty"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Meta Keywords</label>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={articleForm.meta_keywordInput}
                        onChange={(e) => setArticleForm({...articleForm, meta_keywordInput: e.target.value})}
                        onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addMetaKeyword())}
                        placeholder="Add keyword"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                      <Button type="button" onClick={addMetaKeyword} size="sm" variant="secondary">
                        Add
                      </Button>
                    </div>
                    {articleForm.meta_keywords.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {articleForm.meta_keywords.map((keyword, index) => (
                          <span
                            key={index}
                            className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs flex items-center gap-1"
                          >
                            {keyword}
                            <button
                              onClick={() => removeMetaKeyword(index)}
                              className="hover:text-red-600"
                            >
                              <i className="ri-close-line text-xs"></i>
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Meta Description</label>
                  <textarea
                    value={articleForm.meta_description}
                    onChange={(e) => setArticleForm({...articleForm, meta_description: e.target.value})}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="Auto-filled from excerpt if empty"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">OG Title</label>
                    <input
                      type="text"
                      value={articleForm.og_title}
                      onChange={(e) => setArticleForm({...articleForm, og_title: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">OG Description</label>
                    <input
                      type="text"
                      value={articleForm.og_description}
                      onChange={(e) => setArticleForm({...articleForm, og_description: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">OG Image URL</label>
                    <input
                      type="url"
                      value={articleForm.og_image_url}
                      onChange={(e) => setArticleForm({...articleForm, og_image_url: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="https://..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Featured Image URL</label>
                    <input
                      type="url"
                      value={articleForm.featured_image_url}
                      onChange={(e) => setArticleForm({...articleForm, featured_image_url: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="https://..."
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Twitter Title</label>
                    <input
                      type="text"
                      value={articleForm.twitter_title}
                      onChange={(e) => setArticleForm({...articleForm, twitter_title: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Twitter Description</label>
                    <input
                      type="text"
                      value={articleForm.twitter_description}
                      onChange={(e) => setArticleForm({...articleForm, twitter_description: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Canonical URL</label>
                  <input
                    type="url"
                    value={articleForm.canonical_url}
                    onChange={(e) => setArticleForm({...articleForm, canonical_url: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="https://..."
                  />
                </div>
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={articleForm.tagInput}
                    onChange={(e) => setArticleForm({...articleForm, tagInput: e.target.value})}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                    placeholder="Add tag and press Enter"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                  />
                  <Button type="button" onClick={addTag} variant="secondary">
                    Add
                  </Button>
                </div>
                {articleForm.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {articleForm.tags.map((tag, index) => (
                      <span
                        key={index}
                        className="px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-sm flex items-center gap-1"
                      >
                        {tag}
                        <button
                          onClick={() => removeTag(index)}
                          className="hover:text-purple-600"
                        >
                          <i className="ri-close-line text-xs"></i>
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={articleForm.status}
                  onChange={(e) => setArticleForm({...articleForm, status: e.target.value as any})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="archived">Archived</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setShowCreateModal(false);
                    setShowEditModal(false);
                    setEditingArticle(null);
                    resetForm();
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  onClick={handleSaveArticle}
                  className="flex-1"
                >
                  {editingArticle ? 'Update Article' : 'Create Article'}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

