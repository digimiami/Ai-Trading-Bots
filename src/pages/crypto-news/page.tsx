import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Header from '../../components/feature/Header';
import Navigation from '../../components/feature/Navigation';
import Card from '../../components/base/Card';
import Button from '../../components/base/Button';
import { useCryptoNews, type CryptoNewsArticle } from '../../hooks/useCryptoNews';
import { supabase } from '../../lib/supabase';

export default function CryptoNewsPage() {
  const navigate = useNavigate();
  const { slug } = useParams();
  const { getArticles, getArticle } = useCryptoNews();
  const [articles, setArticles] = useState<CryptoNewsArticle[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<CryptoNewsArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  useEffect(() => {
    if (slug) {
      loadArticle(slug);
    } else {
      loadArticles();
    }
  }, [slug, categoryFilter]);

  const loadArticles = async () => {
    try {
      setLoading(true);
      const articlesData = await getArticles('published');
      setArticles(articlesData);
    } catch (error) {
      console.error('Error loading articles:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadArticle = async (articleSlug: string) => {
    try {
      setLoading(true);
      const article = await getArticle(undefined, articleSlug);
      if (article) {
        setSelectedArticle(article);
        // Increment view count (only for published articles)
        if (article.status === 'published') {
          await supabase
            .from('crypto_news_articles')
            .update({ view_count: (article.view_count || 0) + 1 })
            .eq('id', article.id)
            .catch(() => {});
        }
      }
    } catch (error) {
      console.error('Error loading article:', error);
    } finally {
      setLoading(false);
    }
  };

  const categories = ['all', 'general', 'bitcoin', 'ethereum', 'altcoins', 'defi', 'nft', 'trading', 'analysis'];
  const filteredArticles = categoryFilter === 'all' 
    ? articles 
    : articles.filter(a => a.category === categoryFilter);

  // Render single article view
  if (selectedArticle) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header 
          title={selectedArticle.title}
          subtitle={selectedArticle.category ? selectedArticle.category.charAt(0).toUpperCase() + selectedArticle.category.slice(1) : 'Crypto News'}
          showBack
        />
        <div className="pt-20 pb-20 px-4">
          <div className="max-w-4xl mx-auto">
            <Card className="p-6">
              <div className="mb-4">
                <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                  <span>{new Date(selectedArticle.published_at || selectedArticle.created_at).toLocaleDateString()}</span>
                  <span>•</span>
                  <span>{selectedArticle.reading_time || 5} min read</span>
                  {selectedArticle.category && (
                    <>
                      <span>•</span>
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                        {selectedArticle.category}
                      </span>
                    </>
                  )}
                </div>
                {selectedArticle.featured_image_url && (
                  <img
                    src={selectedArticle.featured_image_url}
                    alt={selectedArticle.title}
                    className="w-full h-64 object-cover rounded-lg mb-4"
                  />
                )}
              </div>
              <div 
                className="prose prose-lg max-w-none dark:prose-invert"
                dangerouslySetInnerHTML={{ __html: formatMarkdown(selectedArticle.content) }}
              />
              {selectedArticle.tags && selectedArticle.tags.length > 0 && (
                <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex flex-wrap gap-2">
                    {selectedArticle.tags.map((tag, index) => (
                      <span
                        key={index}
                        className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm dark:bg-purple-900 dark:text-purple-200"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </Card>
            <div className="mt-6">
              <Button variant="secondary" onClick={() => { setSelectedArticle(null); navigate('/crypto-news'); }}>
                <i className="ri-arrow-left-line mr-2"></i>
                Back to News
              </Button>
            </div>
          </div>
        </div>
        <Navigation />
      </div>
    );
  }

  // Render article list
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header 
        title="Crypto News"
        subtitle="Latest cryptocurrency news and analysis"
      />
      <div className="pt-20 pb-20 px-4">
        <div className="max-w-7xl mx-auto">
          {/* Category Filter */}
          <Card className="p-4 mb-6">
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => setCategoryFilter(category)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    categoryFilter === category
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                  }`}
                >
                  {category.charAt(0).toUpperCase() + category.slice(1)}
                </button>
              ))}
            </div>
          </Card>

          {loading ? (
            <div className="text-center py-12">
              <i className="ri-loader-4-line animate-spin text-4xl text-blue-500"></i>
              <p className="mt-4 text-gray-600 dark:text-gray-400">Loading articles...</p>
            </div>
          ) : filteredArticles.length === 0 ? (
            <Card className="p-12 text-center">
              <i className="ri-newspaper-line text-4xl text-gray-400 mb-4"></i>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No Articles Found</h3>
              <p className="text-gray-600 dark:text-gray-400">
                {categoryFilter === 'all' 
                  ? 'No published articles yet. Check back soon!'
                  : `No articles in the ${categoryFilter} category.`}
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredArticles.map((article) => (
                <Card
                  key={article.id}
                  className="p-6 cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => navigate(`/crypto-news/${article.slug}`)}
                >
                  {article.featured_image_url && (
                    <img
                      src={article.featured_image_url}
                      alt={article.title}
                      className="w-full h-48 object-cover rounded-lg mb-4"
                    />
                  )}
                  <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                    <span>{new Date(article.published_at || article.created_at).toLocaleDateString()}</span>
                    <span>•</span>
                    <span>{article.reading_time || 5} min read</span>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 line-clamp-2">
                    {article.title}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-3 mb-4">
                    {article.excerpt || article.content.substring(0, 150)}...
                  </p>
                  <div className="flex items-center justify-between">
                    {article.category && (
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs dark:bg-blue-900 dark:text-blue-200">
                        {article.category}
                      </span>
                    )}
                    <span className="text-blue-600 dark:text-blue-400 text-sm font-medium">
                      Read more <i className="ri-arrow-right-line"></i>
                    </span>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
      <Navigation />
    </div>
  );
}

// Simple markdown to HTML converter (basic implementation)
function formatMarkdown(markdown: string): string {
  if (!markdown) return '';
  
  let html = markdown
    // Headers
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    // Bold
    .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.*?)\*/gim, '<em>$1</em>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline">$1</a>')
    // Line breaks
    .replace(/\n\n/gim, '</p><p>')
    .replace(/\n/gim, '<br>');
  
  return `<p>${html}</p>`;
}

