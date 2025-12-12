import { useState } from 'react';
import Button from '../base/Button';

interface SocialShareProps {
  url?: string;
  title?: string;
  description?: string;
  className?: string;
  variant?: 'default' | 'compact' | 'icons-only';
}

export default function SocialShare({
  url = typeof window !== 'undefined' ? window.location.href : '',
  title = 'Pablo AI Trading Bots',
  description = 'Launch institutional-grade trading bots in minutes. Pablo orchestrates market data, machine learning, and risk controls so you can scale across exchanges without writing code.',
  className = '',
  variant = 'default'
}: SocialShareProps) {
  const [copied, setCopied] = useState(false);

  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);
  const encodedDescription = encodeURIComponent(description);

  const shareLinks = {
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    twitter: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    whatsapp: `https://wa.me/?text=${encodedTitle}%20${encodedUrl}`,
    email: `mailto:?subject=${encodedTitle}&body=${encodedDescription}%20${encodedUrl}`
  };

  const handleShare = (platform: keyof typeof shareLinks) => {
    const shareUrl = shareLinks[platform];
    if (platform === 'email') {
      window.location.href = shareUrl;
    } else {
      window.open(shareUrl, '_blank', 'width=600,height=400');
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = url;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (fallbackErr) {
        console.error('Failed to copy:', fallbackErr);
      }
      document.body.removeChild(textArea);
    }
  };

  if (variant === 'icons-only') {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <button
          onClick={() => handleShare('facebook')}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-blue-600 hover:bg-blue-700 text-white transition-colors"
          aria-label="Share on Facebook"
          title="Share on Facebook"
        >
          <i className="ri-facebook-fill text-lg"></i>
        </button>
        <button
          onClick={() => handleShare('twitter')}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-black hover:bg-gray-800 text-white transition-colors dark:bg-gray-700 dark:hover:bg-gray-600"
          aria-label="Share on Twitter/X"
          title="Share on Twitter/X"
        >
          <i className="ri-twitter-x-fill text-lg"></i>
        </button>
        <button
          onClick={() => handleShare('linkedin')}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-blue-700 hover:bg-blue-800 text-white transition-colors"
          aria-label="Share on LinkedIn"
          title="Share on LinkedIn"
        >
          <i className="ri-linkedin-fill text-lg"></i>
        </button>
        <button
          onClick={() => handleShare('whatsapp')}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-green-500 hover:bg-green-600 text-white transition-colors"
          aria-label="Share on WhatsApp"
          title="Share on WhatsApp"
        >
          <i className="ri-whatsapp-fill text-lg"></i>
        </button>
        <button
          onClick={handleCopyLink}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-600 hover:bg-gray-700 text-white transition-colors"
          aria-label="Copy link"
          title="Copy link"
        >
          <i className={copied ? 'ri-check-line text-lg' : 'ri-links-line text-lg'}></i>
        </button>
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <span className="text-sm text-gray-600 dark:text-gray-400">Share:</span>
        <button
          onClick={() => handleShare('facebook')}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-label="Share on Facebook"
          title="Share on Facebook"
        >
          <i className="ri-facebook-fill text-blue-600 text-xl"></i>
        </button>
        <button
          onClick={() => handleShare('twitter')}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-label="Share on Twitter/X"
          title="Share on Twitter/X"
        >
          <i className="ri-twitter-x-fill text-xl"></i>
        </button>
        <button
          onClick={() => handleShare('linkedin')}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-label="Share on LinkedIn"
          title="Share on LinkedIn"
        >
          <i className="ri-linkedin-fill text-blue-700 text-xl"></i>
        </button>
        <button
          onClick={() => handleShare('whatsapp')}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-label="Share on WhatsApp"
          title="Share on WhatsApp"
        >
          <i className="ri-whatsapp-fill text-green-500 text-xl"></i>
        </button>
        <button
          onClick={handleCopyLink}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-label="Copy link"
          title="Copy link"
        >
          <i className={copied ? 'ri-check-line text-green-600 text-xl' : 'ri-links-line text-gray-600 dark:text-gray-400 text-xl'}></i>
        </button>
      </div>
    );
  }

  // Default variant
  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center gap-2">
        <i className="ri-share-line text-gray-600 dark:text-gray-400"></i>
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Share this page</span>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => handleShare('facebook')}
          className="flex items-center gap-2"
        >
          <i className="ri-facebook-fill text-blue-600"></i>
          <span>Facebook</span>
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => handleShare('twitter')}
          className="flex items-center gap-2"
        >
          <i className="ri-twitter-x-fill"></i>
          <span>Twitter/X</span>
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => handleShare('linkedin')}
          className="flex items-center gap-2"
        >
          <i className="ri-linkedin-fill text-blue-700"></i>
          <span>LinkedIn</span>
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => handleShare('whatsapp')}
          className="flex items-center gap-2"
        >
          <i className="ri-whatsapp-fill text-green-500"></i>
          <span>WhatsApp</span>
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => handleShare('email')}
          className="flex items-center gap-2"
        >
          <i className="ri-mail-line"></i>
          <span>Email</span>
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleCopyLink}
          className="flex items-center gap-2"
        >
          <i className={copied ? 'ri-check-line text-green-600' : 'ri-links-line'}></i>
          <span>{copied ? 'Copied!' : 'Copy Link'}</span>
        </Button>
      </div>
    </div>
  );
}

