import Header from '../../components/feature/Header';
import Navigation from '../../components/feature/Navigation';

export default function CryptoBubblesPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header 
        title="Crypto Bubbles"
        subtitle="Interactive cryptocurrency market visualization"
      />
      <div className="pt-20 pb-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden" style={{ height: 'calc(100vh - 10rem)' }}>
            <iframe
              src="https://cryptobubbles.net/"
              className="w-full h-full border-0"
              title="Crypto Bubbles"
              allow="fullscreen"
            />
          </div>
        </div>
      </div>
      <Navigation />
    </div>
  );
}

