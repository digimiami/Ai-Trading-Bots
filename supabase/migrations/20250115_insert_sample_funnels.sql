-- Insert Sample Funnels with Pre-made Landing Pages
-- Run this after running the create_funnels_tables.sql migration

-- ============================================
-- SAMPLE FUNNEL 1: Crypto Trading Course
-- ============================================
INSERT INTO funnels (id, name, description, slug, is_active, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Crypto Trading Mastery Course',
  'Complete course funnel for crypto trading education',
  'crypto-trading-course',
  true,
  NOW(),
  NOW()
);

-- Landing Page for Crypto Trading Course
INSERT INTO funnel_pages (id, funnel_id, name, slug, page_type, html_content, meta_title, meta_description, custom_css, is_active, order_index, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000001',
  'Crypto Trading Course Landing',
  'landing',
  'landing',
  '<div class="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-purple-900 text-white">
    <div class="container mx-auto px-4 py-16">
      <div class="max-w-4xl mx-auto text-center">
        <h1 class="text-5xl font-bold mb-6">Master Crypto Trading in 30 Days</h1>
        <p class="text-xl mb-8 text-blue-200">Learn proven strategies from professional traders. Start making consistent profits in the crypto market.</p>
        
        <div class="bg-white/20 backdrop-blur-lg rounded-2xl p-8 mb-8 border border-white/30">
          <h2 class="text-2xl font-semibold mb-4 text-white">What You''ll Learn:</h2>
          <ul class="text-left space-y-3 max-w-2xl mx-auto">
            <li class="flex items-center text-white"><span class="text-green-300 mr-3 font-bold">✓</span> Advanced technical analysis techniques</li>
            <li class="flex items-center text-white"><span class="text-green-300 mr-3 font-bold">✓</span> Risk management strategies</li>
            <li class="flex items-center text-white"><span class="text-green-300 mr-3 font-bold">✓</span> Automated trading bot setup</li>
            <li class="flex items-center text-white"><span class="text-green-300 mr-3 font-bold">✓</span> Live trading sessions with experts</li>
            <li class="flex items-center text-white"><span class="text-green-300 mr-3 font-bold">✓</span> Lifetime access to course materials</li>
          </ul>
        </div>

        <div class="bg-yellow-400 text-gray-900 rounded-lg p-4 mb-8">
          <p class="text-2xl font-bold">Limited Time: 50% OFF</p>
          <p class="text-lg">Regular Price: $997 | Today: $497</p>
        </div>

        <button onclick="window.location.href=''#signup''" class="bg-green-500 hover:bg-green-600 text-white font-bold py-4 px-12 rounded-lg text-xl transition-all transform hover:scale-105 shadow-2xl">
          Get Started Now
        </button>
        
        <p class="mt-6 text-blue-100 font-medium">Join 10,000+ successful traders</p>
      </div>
    </div>
  </div>',
  'Crypto Trading Mastery Course - Learn Professional Trading',
  'Master crypto trading with our comprehensive 30-day course. Learn advanced strategies, risk management, and automated trading.',
  'body { font-family: ''Inter'', sans-serif; }',
  true,
  0,
  NOW(),
  NOW()
);

-- Sale Page for Crypto Trading Course
INSERT INTO funnel_pages (id, funnel_id, name, slug, page_type, html_content, meta_title, meta_description, is_active, order_index, redirect_url, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000102',
  '00000000-0000-0000-0000-000000000001',
  'Crypto Trading Course Sale',
  'sale',
  'sale',
  '<div class="min-h-screen bg-gray-900 text-white">
    <div class="container mx-auto px-4 py-16">
      <div class="max-w-3xl mx-auto">
        <h1 class="text-4xl font-bold mb-6 text-center">Complete Your Purchase</h1>
        
        <div class="bg-gray-800 rounded-lg p-8 mb-6">
          <h2 class="text-2xl font-semibold mb-4">Crypto Trading Mastery Course</h2>
          <div class="flex justify-between items-center mb-4">
            <span class="text-gray-400 line-through">$997</span>
            <span class="text-3xl font-bold text-green-400">$497</span>
          </div>
          <p class="text-gray-200 mb-6 font-medium">One-time payment. Lifetime access.</p>
          
          <div class="border-t border-gray-600 pt-6">
            <h3 class="font-semibold mb-3 text-white">What''s Included:</h3>
            <ul class="space-y-2 text-gray-200">
              <li class="flex items-center"><span class="text-green-400 mr-2 font-bold">✓</span> 30+ hours of video content</li>
              <li class="flex items-center"><span class="text-green-400 mr-2 font-bold">✓</span> Trading bot templates</li>
              <li class="flex items-center"><span class="text-green-400 mr-2 font-bold">✓</span> Private community access</li>
              <li class="flex items-center"><span class="text-green-400 mr-2 font-bold">✓</span> Weekly live Q&A sessions</li>
              <li class="flex items-center"><span class="text-green-400 mr-2 font-bold">✓</span> Money-back guarantee</li>
            </ul>
          </div>
        </div>

        <button onclick="window.location.href=''#checkout''" class="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-4 px-8 rounded-lg text-xl transition-all">
          Secure Checkout - $497
        </button>
        
        <p class="text-center text-gray-300 mt-4 text-sm font-medium">🔒 Secure payment • 30-day money-back guarantee</p>
      </div>
    </div>
  </div>',
  'Purchase Crypto Trading Course',
  'Complete your purchase of the Crypto Trading Mastery Course',
  true,
  1,
  '/subscription',
  NOW(),
  NOW()
);

-- Thank You Page
INSERT INTO funnel_pages (id, funnel_id, name, slug, page_type, html_content, meta_title, meta_description, is_active, order_index, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000103',
  '00000000-0000-0000-0000-000000000001',
  'Thank You Page',
  'thank-you',
  'thank_you',
  '<div class="min-h-screen bg-gradient-to-br from-green-500 to-blue-600 text-white flex items-center justify-center">
    <div class="text-center max-w-2xl mx-auto px-4">
      <div class="text-6xl mb-6">🎉</div>
      <h1 class="text-5xl font-bold mb-4">Welcome to the Course!</h1>
      <p class="text-xl mb-8">Check your email for access instructions and course materials.</p>
      <div class="bg-white/30 backdrop-blur-lg rounded-lg p-6 mb-6 border border-white/40">
        <h2 class="text-2xl font-semibold mb-4 text-white">Next Steps:</h2>
        <ol class="text-left space-y-3 max-w-md mx-auto text-white">
          <li class="font-medium">1. Check your email for login credentials</li>
          <li class="font-medium">2. Join our private Discord community</li>
          <li class="font-medium">3. Start with Module 1: Basics of Trading</li>
        </ol>
      </div>
      <button onclick="window.location.href=''/dashboard''" class="bg-white text-green-600 font-bold py-3 px-8 rounded-lg hover:bg-gray-100 transition-all">
        Go to Dashboard
      </button>
    </div>
  </div>',
  'Thank You - Crypto Trading Course',
  'Thank you for purchasing the Crypto Trading Mastery Course',
  true,
  2,
  NOW(),
  NOW()
);

-- ============================================
-- SAMPLE FUNNEL 2: Trading Bot Subscription
-- ============================================
INSERT INTO funnels (id, name, description, slug, is_active, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  'Pablo AI Trading Bot - Premium',
  'Premium trading bot subscription funnel',
  'trading-bot-premium',
  true,
  NOW(),
  NOW()
);

-- Landing Page for Trading Bot
INSERT INTO funnel_pages (id, funnel_id, name, slug, page_type, html_content, meta_title, meta_description, custom_css, is_active, order_index, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000201',
  '00000000-0000-0000-0000-000000000002',
  'Trading Bot Landing',
  'landing',
  'landing',
  '<div class="min-h-screen bg-black text-white">
    <div class="container mx-auto px-4 py-20">
      <div class="max-w-5xl mx-auto">
        <div class="text-center mb-12">
          <h1 class="text-6xl font-bold mb-6 bg-gradient-to-r from-blue-400 to-purple-600 bg-clip-text text-transparent">
            Pablo AI Trading Bot
          </h1>
          <p class="text-2xl text-gray-200 mb-4 font-medium">Trade 24/7 with AI-Powered Automation</p>
          <p class="text-lg text-gray-300">Let our advanced AI handle your trades while you sleep</p>
        </div>

        <div class="grid md:grid-cols-3 gap-6 mb-12">
          <div class="bg-gray-900 rounded-lg p-6 border border-gray-800">
            <div class="text-4xl mb-4">🤖</div>
            <h3 class="text-xl font-semibold mb-2 text-white">AI-Powered</h3>
            <p class="text-gray-300">Advanced machine learning algorithms analyze market patterns</p>
          </div>
          <div class="bg-gray-900 rounded-lg p-6 border border-gray-800">
            <div class="text-4xl mb-4">⚡</div>
            <h3 class="text-xl font-semibold mb-2 text-white">Lightning Fast</h3>
            <p class="text-gray-300">Execute trades in milliseconds with low latency</p>
          </div>
          <div class="bg-gray-900 rounded-lg p-6 border border-gray-800">
            <div class="text-4xl mb-4">📈</div>
            <h3 class="text-xl font-semibold mb-2 text-white">Proven Results</h3>
            <p class="text-gray-300">Average 15-25% monthly returns with proper risk management</p>
          </div>
        </div>

        <div class="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-8 text-center mb-8">
          <h2 class="text-3xl font-bold mb-4">Start Trading Today</h2>
          <p class="text-xl mb-6">Join 5,000+ traders using Pablo AI</p>
          <div class="flex items-center justify-center gap-4 mb-6">
            <span class="text-3xl font-bold text-white">$99</span>
            <span class="text-white/90">/month</span>
          </div>
          <button onclick="window.location.href=''#signup''" class="bg-white text-blue-600 font-bold py-4 px-12 rounded-lg text-xl hover:bg-gray-100 transition-all transform hover:scale-105 shadow-lg">
            Start Free Trial
          </button>
          <p class="text-sm mt-4 text-white font-medium">7-day free trial • Cancel anytime</p>
        </div>

        <div class="bg-gray-900 rounded-lg p-6">
          <h3 class="text-2xl font-semibold mb-4 text-center">What''s Included:</h3>
          <div class="grid md:grid-cols-2 gap-4">
            <div class="flex items-start">
              <span class="text-green-400 mr-3 text-xl">✓</span>
              <div>
                <strong class="text-white">Unlimited Trading Bots</strong>
                <p class="text-gray-300 text-sm">Create as many bots as you need</p>
              </div>
            </div>
            <div class="flex items-start">
              <span class="text-green-300 mr-3 text-xl font-bold">✓</span>
              <div>
                <strong class="text-white">Real-time Analytics</strong>
                <p class="text-gray-300 text-sm">Track performance with detailed reports</p>
              </div>
            </div>
            <div class="flex items-start">
              <span class="text-green-300 mr-3 text-xl font-bold">✓</span>
              <div>
                <strong class="text-white">24/7 Support</strong>
                <p class="text-gray-300 text-sm">Get help whenever you need it</p>
              </div>
            </div>
            <div class="flex items-start">
              <span class="text-green-300 mr-3 text-xl font-bold">✓</span>
              <div>
                <strong class="text-white">Advanced Strategies</strong>
                <p class="text-gray-300 text-sm">Access to premium trading strategies</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>',
  'Pablo AI Trading Bot - Automated Crypto Trading',
  'Trade cryptocurrencies 24/7 with our AI-powered trading bot. Start your free trial today.',
  'body { font-family: ''Inter'', sans-serif; }',
  true,
  0,
  NOW(),
  NOW()
);

-- ============================================
-- SAMPLE FUNNEL 3: Lead Generation
-- ============================================
INSERT INTO funnels (id, name, description, slug, is_active, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000003',
  'Free Trading Guide Download',
  'Lead generation funnel for free trading guide',
  'free-trading-guide',
  true,
  NOW(),
  NOW()
);

-- Landing Page for Free Guide
INSERT INTO funnel_pages (id, funnel_id, name, slug, page_type, html_content, meta_title, meta_description, custom_css, is_active, order_index, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000301',
  '00000000-0000-0000-0000-000000000003',
  'Free Guide Landing',
  'landing',
  'landing',
  '<div class="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 text-white">
    <div class="container mx-auto px-4 py-16">
      <div class="max-w-4xl mx-auto">
        <div class="text-center mb-12">
          <div class="text-6xl mb-6">📚</div>
          <h1 class="text-5xl font-bold mb-4">Get Your Free Trading Guide</h1>
          <p class="text-2xl text-purple-100 mb-2 font-medium">"10 Strategies That Made Me $100K in Crypto Trading"</p>
          <p class="text-lg text-purple-200">Download instantly - No credit card required</p>
        </div>

        <div class="bg-white/20 backdrop-blur-lg rounded-2xl p-8 mb-8 border border-white/30">
          <h2 class="text-2xl font-semibold mb-6 text-center text-white">What''s Inside:</h2>
          <div class="grid md:grid-cols-2 gap-4">
            <div class="flex items-start">
              <span class="text-yellow-300 mr-3 text-2xl">📖</span>
              <div>
                <strong class="text-white">10 Proven Strategies</strong>
                <p class="text-sm text-purple-100">Step-by-step trading methods</p>
              </div>
            </div>
            <div class="flex items-start">
              <span class="text-yellow-300 mr-3 text-2xl">💡</span>
              <div>
                <strong class="text-white">Risk Management Tips</strong>
                <p class="text-sm text-purple-100">Protect your capital</p>
              </div>
            </div>
            <div class="flex items-start">
              <span class="text-yellow-300 mr-3 text-2xl">📊</span>
              <div>
                <strong class="text-white">Market Analysis Tools</strong>
                <p class="text-sm text-purple-100">Identify opportunities</p>
              </div>
            </div>
            <div class="flex items-start">
              <span class="text-yellow-300 mr-3 text-2xl">🎯</span>
              <div>
                <strong class="text-white">Entry & Exit Points</strong>
                <p class="text-sm text-purple-100">Perfect timing strategies</p>
              </div>
            </div>
          </div>
        </div>

        <div class="bg-white rounded-2xl p-8 text-gray-900">
          <h3 class="text-2xl font-bold mb-6 text-center">Get Instant Access</h3>
          <form class="space-y-4">
            <input type="text" placeholder="Your Name" class="w-full px-4 py-3 border-2 border-gray-400 rounded-lg text-gray-900 focus:ring-2 focus:ring-purple-500 focus:border-purple-500">
            <input type="email" placeholder="Your Email" class="w-full px-4 py-3 border-2 border-gray-400 rounded-lg text-gray-900 focus:ring-2 focus:ring-purple-500 focus:border-purple-500">
            <button type="submit" onclick="event.preventDefault(); window.location.href=''#download''" class="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold py-4 px-8 rounded-lg text-xl hover:from-purple-700 hover:to-pink-700 transition-all transform hover:scale-105">
              Download Free Guide Now
            </button>
          </form>
          <p class="text-center text-gray-500 text-sm mt-4">🔒 We respect your privacy. Unsubscribe at any time.</p>
        </div>

        <div class="mt-8 text-center">
          <p class="text-purple-100 font-medium">⭐ Join 25,000+ traders who downloaded this guide</p>
        </div>
      </div>
    </div>
  </div>',
  'Free Crypto Trading Guide - Download Now',
  'Download our free guide: "10 Strategies That Made Me $100K in Crypto Trading". Get instant access.',
  'body { font-family: ''Inter'', sans-serif; } input:focus { outline: none; }',
  true,
  0,
  NOW(),
  NOW()
);

-- Thank You Page for Guide Download
INSERT INTO funnel_pages (id, funnel_id, name, slug, page_type, html_content, meta_title, meta_description, is_active, order_index, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000302',
  '00000000-0000-0000-0000-000000000003',
  'Download Thank You',
  'thank-you',
  'thank_you',
  '<div class="min-h-screen bg-gradient-to-br from-green-400 to-blue-500 text-white flex items-center justify-center">
    <div class="text-center max-w-2xl mx-auto px-4">
      <div class="text-6xl mb-6">✅</div>
      <h1 class="text-4xl font-bold mb-4">Check Your Email!</h1>
      <p class="text-xl mb-8">Your free trading guide has been sent to your inbox.</p>
      <div class="bg-white/30 backdrop-blur-lg rounded-lg p-6 mb-6 border border-white/40">
        <p class="mb-4 text-white font-medium">Can''t find it? Check your spam folder.</p>
        <p class="text-sm text-white">The email should arrive within 2 minutes.</p>
      </div>
      <button onclick="window.location.href=''/dashboard''" class="bg-white text-green-600 font-bold py-3 px-8 rounded-lg hover:bg-gray-100 transition-all">
        Go to Dashboard
      </button>
    </div>
  </div>',
  'Thank You - Download Your Free Guide',
  'Your free trading guide has been sent to your email',
  true,
  1,
  NOW(),
  NOW()
);

-- ============================================
-- SAMPLE FUNNEL 4: Webinar Registration
-- ============================================
INSERT INTO funnels (id, name, description, slug, is_active, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000004',
  'Free Trading Webinar',
  'Webinar registration funnel',
  'free-trading-webinar',
  true,
  NOW(),
  NOW()
);

-- Landing Page for Webinar
INSERT INTO funnel_pages (id, funnel_id, name, slug, page_type, html_content, meta_title, meta_description, custom_css, is_active, order_index, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000401',
  '00000000-0000-0000-0000-000000000004',
  'Webinar Landing',
  'landing',
  'landing',
  '<div class="min-h-screen bg-gradient-to-r from-red-600 via-orange-500 to-yellow-500 text-white">
    <div class="container mx-auto px-4 py-16">
      <div class="max-w-3xl mx-auto text-center">
        <div class="bg-white/30 backdrop-blur-lg rounded-2xl p-8 mb-8 border border-white/40">
          <div class="text-5xl mb-4">🎥</div>
          <h1 class="text-5xl font-bold mb-4 text-white">Free Live Trading Webinar</h1>
          <p class="text-2xl mb-6 text-white font-medium">"How to Make $10K/Month with Crypto Trading Bots"</p>
          <div class="bg-white/40 rounded-lg p-4 mb-6 border border-white/50">
            <p class="text-3xl font-bold mb-2 text-white">📅 January 20, 2025</p>
            <p class="text-xl text-white font-medium">⏰ 7:00 PM EST</p>
          </div>
        </div>

        <div class="bg-white text-gray-900 rounded-2xl p-8 mb-8">
          <h2 class="text-3xl font-bold mb-6">What You''ll Learn:</h2>
          <ul class="text-left space-y-4 max-w-xl mx-auto">
            <li class="flex items-start">
              <span class="text-orange-500 mr-3 text-2xl">✓</span>
              <div>
                <strong>How to set up profitable trading bots</strong>
                <p class="text-sm text-gray-600">Step-by-step live demonstration</p>
              </div>
            </li>
            <li class="flex items-start">
              <span class="text-orange-500 mr-3 text-2xl">✓</span>
              <div>
                <strong>Best strategies for 2025</strong>
                <p class="text-sm text-gray-600">What''s working right now</p>
              </div>
            </li>
            <li class="flex items-start">
              <span class="text-orange-500 mr-3 text-2xl">✓</span>
              <div>
                <strong>Live Q&A with experts</strong>
                <p class="text-sm text-gray-600">Get your questions answered</p>
              </div>
            </li>
            <li class="flex items-start">
              <span class="text-orange-500 mr-3 text-2xl">✓</span>
              <div>
                <strong>Exclusive bonuses</strong>
                <p class="text-sm text-gray-600">Free tools and resources</p>
              </div>
            </li>
          </ul>
        </div>

        <div class="bg-white text-gray-900 rounded-2xl p-8">
          <h3 class="text-2xl font-bold mb-6">Reserve Your Spot</h3>
          <form class="space-y-4">
            <input type="text" placeholder="First Name" class="w-full px-4 py-3 border-2 border-gray-400 rounded-lg text-gray-900 focus:border-orange-500 focus:ring-2 focus:ring-orange-500">
            <input type="text" placeholder="Last Name" class="w-full px-4 py-3 border-2 border-gray-400 rounded-lg text-gray-900 focus:border-orange-500 focus:ring-2 focus:ring-orange-500">
            <input type="email" placeholder="Email Address" class="w-full px-4 py-3 border-2 border-gray-400 rounded-lg text-gray-900 focus:border-orange-500 focus:ring-2 focus:ring-orange-500">
            <button type="submit" onclick="event.preventDefault(); window.location.href=''#registered''" class="w-full bg-gradient-to-r from-red-600 to-orange-500 text-white font-bold py-4 px-8 rounded-lg text-xl hover:from-red-700 hover:to-orange-600 transition-all transform hover:scale-105">
              Register for Free Webinar
            </button>
          </form>
          <p class="text-center text-gray-500 text-sm mt-4">🔒 Limited to 500 spots • We''ll send you the link via email</p>
        </div>

        <div class="mt-8">
          <p class="text-xl text-white font-medium">🔥 <strong class="text-white">487 spots remaining</strong></p>
        </div>
      </div>
    </div>
  </div>',
  'Free Trading Webinar - Register Now',
  'Join our free live webinar: "How to Make $10K/Month with Crypto Trading Bots". Register now!',
  'body { font-family: ''Inter'', sans-serif; } input:focus { outline: none; border-color: #f97316; }',
  true,
  0,
  NOW(),
  NOW()
);

-- Thank You Page for Webinar
INSERT INTO funnel_pages (id, funnel_id, name, slug, page_type, html_content, meta_title, meta_description, is_active, order_index, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000402',
  '00000000-0000-0000-0000-000000000004',
  'Webinar Thank You',
  'thank-you',
  'thank_you',
  '<div class="min-h-screen bg-gradient-to-br from-orange-500 to-red-600 text-white flex items-center justify-center">
    <div class="text-center max-w-2xl mx-auto px-4">
      <div class="text-6xl mb-6">🎉</div>
      <h1 class="text-4xl font-bold mb-4">You''re Registered!</h1>
      <p class="text-xl mb-8">Check your email for the webinar link and calendar reminder.</p>
      <div class="bg-white/30 backdrop-blur-lg rounded-lg p-6 mb-6 border border-white/40">
        <h2 class="text-2xl font-semibold mb-4 text-white">What Happens Next:</h2>
        <ol class="text-left space-y-3 max-w-md mx-auto text-white">
          <li class="font-medium">1. Check your email for confirmation</li>
          <li class="font-medium">2. Add the event to your calendar</li>
          <li class="font-medium">3. We''ll send a reminder 1 hour before</li>
          <li class="font-medium">4. Join us live on January 20 at 7 PM EST</li>
        </ol>
      </div>
      <button onclick="window.location.href=''/dashboard''" class="bg-white text-orange-600 font-bold py-3 px-8 rounded-lg hover:bg-gray-100 transition-all">
        Go to Dashboard
      </button>
    </div>
  </div>',
  'Thank You - Webinar Registration',
  'You''re registered for the free trading webinar. Check your email for details.',
  true,
  1,
  NOW(),
  NOW()
);
