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
  const logoUrl = 'https://dkawxgwdqiirgmmjbvhc.supabase.co/storage/v1/object/public/pablobots-logo/logo_no_bg.png';
  const shareUrl = 'https://pablobots.com';

  const handleDownload = async () => {
    if (!cardRef.current) return;

    try {
      setDownloading(true);
      
      // Generate canvas from the card
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: '#111827', // Dark background
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
        backgroundColor: '#111827', // Dark background
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
          <h2 className="text-xl font-bold text-white">Share Bot Card</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <i className="ri-close-line text-xl text-gray-300"></i>
          </button>
        </div>

        {/* Shareable Card Preview */}
        <div ref={cardRef} className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-xl p-5 text-white shadow-2xl relative overflow-hidden" style={{ width: '400px' }}>
          {/* Rocket Graphic */}
          <div className="absolute top-2 right-2 opacity-20">
            <i className="ri-rocket-2-line text-6xl text-blue-400 transform rotate-45"></i>
          </div>
          
          {/* Decorative Elements */}
          <div className="absolute bottom-0 left-0 w-full h-20 bg-gradient-to-t from-blue-900/20 to-transparent"></div>
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl"></div>

          {/* Header with Logo */}
          <div className="flex items-center space-x-2 mb-4 relative z-10">
            <img 
              src={logoUrl}
              alt="PabloBots Logo"
              className="h-8 w-8 object-contain bg-white rounded p-0.5"
            />
            <div>
              <h3 className="text-sm font-bold text-white">PabloBots</h3>
            </div>
          </div>

          {/* Quote with Rocket */}
          <div className="text-center mb-4 relative z-10">
            <div className="flex items-center justify-center gap-2 mb-2">
              <i className="ri-rocket-2-fill text-2xl text-blue-400"></i>
              <p className="text-lg font-bold">Join PabloBots.com</p>
            </div>
            <p className="text-gray-300 text-xs">Automated Trading Made Simple</p>
          </div>

          {/* Bot Information - Compact */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-3 mb-4 relative z-10 border border-gray-700/50">
            <h4 className="text-sm font-bold mb-2 truncate">{bot.name}</h4>
            
            <div className="grid grid-cols-2 gap-2 text-xs">
              {bot.symbol && (
                <div>
                  <p className="text-gray-400 text-[10px] mb-0.5">Symbol</p>
                  <p className="font-semibold text-white">{bot.symbol}</p>
                </div>
              )}
              {bot.pnl !== undefined && (
                <div>
                  <p className="text-gray-400 text-[10px] mb-0.5">PnL</p>
                  <p className={`font-semibold ${bot.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {bot.pnl >= 0 ? '+' : ''}${bot.pnl.toFixed(2)}
                  </p>
                </div>
              )}
            </div>

            {(bot.winRate !== undefined || bot.totalTrades !== undefined) && (
              <div className="flex gap-3 mt-2 pt-2 border-t border-gray-700/50">
                {bot.winRate !== undefined && (
                  <div>
                    <p className="text-gray-400 text-[10px] mb-0.5">Win Rate</p>
                    <p className="font-semibold text-xs text-white">{bot.winRate.toFixed(1)}%</p>
                  </div>
                )}
                {bot.totalTrades !== undefined && (
                  <div>
                    <p className="text-gray-400 text-[10px] mb-0.5">Trades</p>
                    <p className="font-semibold text-xs text-white">{bot.totalTrades}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* QR Code - Smaller */}
          <div className="flex flex-col items-center relative z-10">
            <div className="bg-white p-2 rounded-lg">
              <QRCodeSVG
                value={shareUrl}
                size={80}
                level="H"
                includeMargin={false}
                bgColor="#ffffff"
                fgColor="#000000"
              />
            </div>
            <p className="text-gray-400 text-[10px] mt-2 text-center">
              Scan to visit PabloBots.com
            </p>
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
            className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-3 px-4 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <i className="ri-download-line"></i>
            Download
          </button>
        </div>
      </div>
    </div>
  );
}







