import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../../components/base/Button';

const META = {
  title: 'Pablo Cookie Policy | Trading Platform',
  description:
    'Learn about how Pablo uses cookies and similar technologies to provide and improve our trading automation platform.',
};

export default function CookiePolicyPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const previousTitle = document.title;
    document.title = META.title;
    return () => {
      document.title = previousTitle;
    };
  }, []);

  const sections = [
    {
      heading: 'What Are Cookies?',
      body: [
        'Cookies are small text files that are placed on your device when you visit our website. They help us provide you with a better experience by remembering your preferences and understanding how you use our platform.',
        'We use both session cookies (which expire when you close your browser) and persistent cookies (which remain on your device until deleted or expired).',
      ],
    },
    {
      heading: 'Types of Cookies We Use',
      body: [
        {
          title: 'Essential Cookies',
          description: 'These cookies are necessary for the website to function properly. They enable core functionality such as security, network management, and accessibility. You cannot opt-out of these cookies.',
        },
        {
          title: 'Analytics Cookies',
          description: 'These cookies help us understand how visitors interact with our website by collecting and reporting information anonymously. This helps us improve our platform and user experience.',
        },
        {
          title: 'Functional Cookies',
          description: 'These cookies allow the website to remember choices you make (such as your username, language, or region) and provide enhanced, personalized features.',
        },
        {
          title: 'Marketing Cookies',
          description: 'These cookies are used to track visitors across websites to display relevant advertisements. They help us measure the effectiveness of our marketing campaigns.',
        },
      ],
    },
    {
      heading: 'Third-Party Cookies',
      body: [
        'We may use third-party services that set their own cookies, such as analytics providers, advertising networks, and social media platforms. These third parties may use cookies to collect information about your online activities across different websites.',
        'We do not control these third-party cookies. Please refer to their respective privacy policies for more information.',
      ],
    },
    {
      heading: 'Managing Cookies',
      body: [
        'You can control and manage cookies in various ways. Most browsers allow you to refuse or accept cookies, and to delete cookies that have already been set.',
        'You can manage your cookie preferences through our cookie consent banner when you first visit our website. You can also change your preferences at any time.',
        'Please note that disabling certain cookies may impact the functionality of our platform and your user experience.',
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate('/')}
              className="flex items-center space-x-3 hover:opacity-80 transition-opacity"
            >
              <img 
                src="https://dkawxgwdqiirgmmjbvhc.supabase.co/storage/v1/object/public/pablobots-logo/logo_no_bg.png" 
                alt="Pablo Logo" 
                className="h-10 w-10 object-contain"
              />
              <span className="text-gray-900 font-semibold">Pablo Trading</span>
            </button>
            <Button variant="secondary" size="sm" onClick={() => navigate('/auth')}>
              Sign In
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-12">
        <header className="mb-8">
          <p className="text-sm uppercase tracking-wider text-gray-500 mb-2">Legal</p>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Cookie Policy</h1>
          <p className="text-sm text-gray-600">
            Last Updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
          <p className="text-base text-gray-700 mt-4">
            This Cookie Policy explains how Pablo Trading Platform ("we", "our", or "us") uses cookies and similar technologies 
            when you visit our website and use our trading automation platform.
          </p>
        </header>

        <section className="space-y-8">
          {sections.map((section) => (
            <div key={section.heading} className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">{section.heading}</h2>
              {Array.isArray(section.body) && section.body[0]?.title ? (
                <div className="space-y-4">
                  {section.body.map((item: any, index: number) => (
                    <div key={index} className="border-l-4 border-blue-500 pl-4">
                      <h3 className="font-semibold text-gray-900 mb-2">{item.title}</h3>
                      <p className="text-gray-700">{item.description}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-3 text-gray-700">
                  {section.body.map((item: string, index: number) => (
                    <p key={index}>{item}</p>
                  ))}
                </div>
              )}
            </div>
          ))}
        </section>

        <section className="mt-8 bg-blue-50 rounded-lg border border-blue-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Contact Us</h2>
          <p className="text-gray-700">
            If you have any questions about our use of cookies, please contact us at{' '}
            <a href="mailto:privacy@pablobots.net" className="text-blue-600 hover:text-blue-800 underline">
              privacy@pablobots.net
            </a>
          </p>
        </section>

        <div className="mt-8 flex gap-4">
          <Button variant="secondary" onClick={() => navigate('/privacy')}>
            Privacy Policy
          </Button>
          <Button variant="secondary" onClick={() => navigate('/terms')}>
            Terms of Service
          </Button>
          <Button variant="secondary" onClick={() => navigate('/')}>
            Back to Home
          </Button>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-8 mt-16">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid gap-6 md:grid-cols-4 text-sm">
            <div>
              <h4 className="text-white font-semibold mb-3">Legal</h4>
              <ul className="space-y-2">
                <li>
                  <button onClick={() => navigate('/privacy')} className="hover:text-white transition">
                    Privacy Policy
                  </button>
                </li>
                <li>
                  <button onClick={() => navigate('/terms')} className="hover:text-white transition">
                    Terms of Service
                  </button>
                </li>
                <li>
                  <button onClick={() => navigate('/risk')} className="hover:text-white transition">
                    Risk Disclosure
                  </button>
                </li>
                <li>
                  <button onClick={() => navigate('/cookies')} className="hover:text-white transition">
                    Cookie Policy
                  </button>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-3">Platform</h4>
              <ul className="space-y-2">
                <li>
                  <button onClick={() => navigate('/auth')} className="hover:text-white transition">
                    Sign In
                  </button>
                </li>
                <li>
                  <button onClick={() => navigate('/pricing')} className="hover:text-white transition">
                    Pricing
                  </button>
                </li>
                <li>
                  <button onClick={() => navigate('/contact')} className="hover:text-white transition">
                    Contact
                  </button>
                </li>
              </ul>
            </div>
            <div className="md:col-span-2">
              <p className="text-xs mt-4">
                © {new Date().getFullYear()} Pablo Trading Platform. All rights reserved.
              </p>
              <p className="text-xs mt-2">
                Pablo is a software platform providing trading automation tools. We do not handle user funds. 
                Trading involves substantial risk of loss.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

