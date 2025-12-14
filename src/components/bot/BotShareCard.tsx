import { useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import html2canvas from 'html2canvas';

interface BotShareCardProps {
  bot: {
    id: string;
    name: string;
    symbol?: string;
    exchange?: string;
    pnl?: number;
    pnlPercentage?: number;
    winRate?: number;
    totalTrades?: number;
    status?: string;
  };
  isOpen: boolean;
  onClose: () => void;
}

export default function BotShareCard({ bot, isOpen, onClose }: BotShareCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const logoUrl = 'https://dkawxgwdqiirgmmjbvhc.supabase.co/storage/v1/object/public/profile-images/logo.png';
  const shareUrl = 'https://pablobots.com';

  const handleDownload = async () => {
    if (!cardRef.current) return;

    try {
      setDownloading(true);
      
      // Generate canvas from the card
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: '#ffffff',
        scale: 2, // Higher quality
        logging: false,
      });

      // Convert to blob and download
      canvas.toBlob((blob) => {
        if (!blob) return;
        
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `pablobots-${bot.name.replace(/\s+/g, '-').toLowerCase()}-share.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 'image/png');
    } catch (error) {
      console.error('Error generating share card:', error);
      alert('Failed to generate share card. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  const handleShare = async () => {
    if (!cardRef.current) return;

    try {
      setDownloading(true);
      
      // Generate canvas from the card
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        logging: false,
      });

      // Convert to blob
      canvas.toBlob(async (blob) => {
        if (!blob) return;

        // Try Web Share API
        if (navigator.share && navigator.canShare) {
          const file = new File([blob], `pablobots-${bot.name}.png`, { type: 'image/png' });
          
          if (navigator.canShare({ files: [file] })) {
            try {
              await navigator.share({
                files: [file],
                title: `Check out my ${bot.name} bot on PabloBots!`,
                text: 'Join PabloBots.com - AI Trading Platform',
              });
              return;
            } catch (error: any) {
              if (error.name !== 'AbortError') {
                console.error('Error sharing:', error);
              }
            }
          }
        }

        // Fallback to download
        handleDownload();
      }, 'image/png');
    } catch (error) {
      console.error('Error sharing card:', error);
      handleDownload();
    } finally {
      setDownloading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-lg max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">Share Bot Card</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <i className="ri-close-line text-xl text-gray-600"></i>
          </button>
        </div>

        {/* Shareable Card Preview */}
        <div ref={cardRef} className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl p-8 text-white shadow-2xl">
          {/* Header with Logo and Quote */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <img 
                src={logoUrl}
                alt="PabloBots Logo"
                className="h-12 w-12 object-contain bg-white rounded-lg p-1"
              />
              <div>
                <h3 className="text-lg font-bold">PabloBots</h3>
                <p className="text-blue-100 text-sm">AI Trading Platform</p>
              </div>
            </div>
          </div>

          {/* Quote */}
          <div className="text-center mb-6 py-4 border-t border-blue-400/30 border-b border-blue-400/30">
            <p className="text-2xl font-bold italic">Join PabloBots.com</p>
            <p className="text-blue-100 text-sm mt-1">Automated Trading Made Simple</p>
          </div>

          {/* Bot Information */}
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 mb-6">
            <h4 className="text-xl font-bold mb-4">{bot.name}</h4>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              {bot.symbol && (
                <div>
                  <p className="text-blue-200 text-xs mb-1">Symbol</p>
                  <p className="font-semibold">{bot.symbol}</p>
                </div>
              )}
              {bot.exchange && (
                <div>
                  <p className="text-blue-200 text-xs mb-1">Exchange</p>
                  <p className="font-semibold uppercase">{bot.exchange}</p>
                </div>
              )}
              {bot.pnl !== undefined && (
                <div>
                  <p className="text-blue-200 text-xs mb-1">PnL</p>
                  <p className={`font-semibold ${bot.pnl >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                    {bot.pnl >= 0 ? '+' : ''}${bot.pnl.toFixed(2)}
                  </p>
                </div>
              )}
              {bot.winRate !== undefined && (
                <div>
                  <p className="text-blue-200 text-xs mb-1">Win Rate</p>
                  <p className="font-semibold">{bot.winRate.toFixed(1)}%</p>
                </div>
              )}
            </div>

            {bot.totalTrades !== undefined && (
              <div className="mt-4 pt-4 border-t border-white/20">
                <p className="text-blue-200 text-xs mb-1">Total Trades</p>
                <p className="font-semibold text-lg">{bot.totalTrades}</p>
              </div>
            )}
          </div>

          {/* QR Code */}
          <div className="flex flex-col items-center">
            <div className="bg-white p-4 rounded-lg">
              <QRCodeSVG
                value={shareUrl}
                size={120}
                level="H"
                includeMargin={false}
              />
            </div>
            <p className="text-blue-100 text-xs mt-3 text-center">
              Scan to visit PabloBots.com
            </p>
          </div>

          {/* Footer */}
          <div className="mt-6 text-center text-blue-100 text-xs">
            <p>Start your automated trading journey today!</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-3 mt-6">
          <button
            onClick={handleShare}
            disabled={downloading}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {downloading ? (
              <>
                <i className="ri-loader-4-line animate-spin"></i>
                Generating...
              </>
            ) : (
              <>
                <i className="ri-share-line"></i>
                Share
              </>
            )}
          </button>
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-3 px-4 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <i className="ri-download-line"></i>
            Download
          </button>
        </div>
      </div>
    </div>
  );
}