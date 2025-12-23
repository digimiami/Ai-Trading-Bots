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
  '<div style="min-height: 100vh; background: linear-gradient(135deg, #1e3a8a 0%, #1e40af 50%, #7c3aed 100%); color: #ffffff;">
    <div style="max-width: 1200px; margin: 0 auto; padding: 4rem 1rem;">
      <div style="max-width: 56rem; margin: 0 auto; text-align: center;">
        <h1 style="font-size: 3rem; font-weight: 700; margin-bottom: 1.5rem; color: #ffffff;">Master Crypto Trading in 30 Days</h1>
        <p style="font-size: 1.25rem; margin-bottom: 2rem; color: #bfdbfe;">Learn proven strategies from professional traders. Start making consistent profits in the crypto market.</p>
        
        <div style="background: rgba(255, 255, 255, 0.15); backdrop-filter: blur(10px); border-radius: 1rem; padding: 2rem; margin-bottom: 2rem; border: 1px solid rgba(255, 255, 255, 0.3);">
          <h2 style="font-size: 1.5rem; font-weight: 600; margin-bottom: 1rem; color: #ffffff;">What You''ll Learn:</h2>
          <ul style="text-align: left; list-style: none; padding: 0; max-width: 32rem; margin: 0 auto;">
            <li style="display: flex; align-items: center; margin-bottom: 0.75rem; color: #ffffff;"><span style="color: #86efac; margin-right: 0.75rem; font-weight: 700;">✓</span> Advanced technical analysis techniques</li>
            <li style="display: flex; align-items: center; margin-bottom: 0.75rem; color: #ffffff;"><span style="color: #86efac; margin-right: 0.75rem; font-weight: 700;">✓</span> Risk management strategies</li>
            <li style="display: flex; align-items: center; margin-bottom: 0.75rem; color: #ffffff;"><span style="color: #86efac; margin-right: 0.75rem; font-weight: 700;">✓</span> Automated trading bot setup</li>
            <li style="display: flex; align-items: center; margin-bottom: 0.75rem; color: #ffffff;"><span style="color: #86efac; margin-right: 0.75rem; font-weight: 700;">✓</span> Live trading sessions with experts</li>
            <li style="display: flex; align-items: center; margin-bottom: 0.75rem; color: #ffffff;"><span style="color: #86efac; margin-right: 0.75rem; font-weight: 700;">✓</span> Lifetime access to course materials</li>
          </ul>
        </div>

        <div style="background: #facc15; color: #111827; border-radius: 0.5rem; padding: 1rem; margin-bottom: 2rem;">
          <p style="font-size: 1.5rem; font-weight: 700; color: #111827;">Limited Time: 50% OFF</p>
          <p style="font-size: 1.125rem; color: #111827;">Regular Price: $997 | Today: $497</p>
        </div>

        <button onclick="window.location.href=''#signup''" style="background: #22c55e; color: #ffffff; font-weight: 700; padding: 1rem 3rem; border-radius: 0.5rem; font-size: 1.25rem; border: none; cursor: pointer; transition: all 0.3s; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3);" onmouseover="this.style.background=''#16a34a''" onmouseout="this.style.background=''#22c55e''">
          Get Started Now
        </button>
        
        <p style="margin-top: 1.5rem; color: #dbeafe; font-weight: 500;">Join 10,000+ successful traders</p>
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
  '<div style="min-height: 100vh; background: #111827; color: #ffffff;">
    <div style="max-width: 1200px; margin: 0 auto; padding: 4rem 1rem;">
      <div style="max-width: 48rem; margin: 0 auto;">
        <h1 style="font-size: 2.25rem; font-weight: 700; margin-bottom: 1.5rem; text-align: center; color: #ffffff;">Complete Your Purchase</h1>
        
        <div style="background: #1f2937; border-radius: 0.5rem; padding: 2rem; margin-bottom: 1.5rem;">
          <h2 style="font-size: 1.5rem; font-weight: 600; margin-bottom: 1rem; color: #ffffff;">Crypto Trading Mastery Course</h2>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <span style="color: #9ca3af; text-decoration: line-through;">$997</span>
            <span style="font-size: 1.875rem; font-weight: 700; color: #4ade80;">$497</span>
          </div>
          <p style="color: #e5e7eb; margin-bottom: 1.5rem; font-weight: 500;">One-time payment. Lifetime access.</p>
          
          <div style="border-top: 1px solid #4b5563; padding-top: 1.5rem;">
            <h3 style="font-weight: 600; margin-bottom: 0.75rem; color: #ffffff;">What''s Included:</h3>
            <ul style="list-style: none; padding: 0; margin: 0;">
              <li style="display: flex; align-items: center; margin-bottom: 0.5rem; color: #e5e7eb;"><span style="color: #4ade80; margin-right: 0.5rem; font-weight: 700;">✓</span> 30+ hours of video content</li>
              <li style="display: flex; align-items: center; margin-bottom: 0.5rem; color: #e5e7eb;"><span style="color: #4ade80; margin-right: 0.5rem; font-weight: 700;">✓</span> Trading bot templates</li>
              <li style="display: flex; align-items: center; margin-bottom: 0.5rem; color: #e5e7eb;"><span style="color: #4ade80; margin-right: 0.5rem; font-weight: 700;">✓</span> Private community access</li>
              <li style="display: flex; align-items: center; margin-bottom: 0.5rem; color: #e5e7eb;"><span style="color: #4ade80; margin-right: 0.5rem; font-weight: 700;">✓</span> Weekly live Q&A sessions</li>
              <li style="display: flex; align-items: center; margin-bottom: 0.5rem; color: #e5e7eb;"><span style="color: #4ade80; margin-right: 0.5rem; font-weight: 700;">✓</span> Money-back guarantee</li>
            </ul>
          </div>
        </div>

        <button onclick="window.location.href=''#checkout''" style="width: 100%; background: #22c55e; color: #ffffff; font-weight: 700; padding: 1rem 2rem; border-radius: 0.5rem; font-size: 1.25rem; border: none; cursor: pointer; transition: all 0.3s;" onmouseover="this.style.background=''#16a34a''" onmouseout="this.style.background=''#22c55e''">
          Secure Checkout - $497
        </button>
        
        <p style="text-align: center; color: #d1d5db; margin-top: 1rem; font-size: 0.875rem; font-weight: 500;">🔒 Secure payment • 30-day money-back guarantee</p>
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
  '<div style="min-height: 100vh; background: linear-gradient(135deg, #22c55e 0%, #3b82f6 100%); color: #ffffff; display: flex; align-items: center; justify-content: center;">
    <div style="text-align: center; max-width: 42rem; margin: 0 auto; padding: 0 1rem;">
      <div style="font-size: 4rem; margin-bottom: 1.5rem;">🎉</div>
      <h1 style="font-size: 3rem; font-weight: 700; margin-bottom: 1rem; color: #ffffff;">Welcome to the Course!</h1>
      <p style="font-size: 1.25rem; margin-bottom: 2rem; color: #ffffff;">Check your email for access instructions and course materials.</p>
      <div style="background: rgba(255, 255, 255, 0.3); backdrop-filter: blur(10px); border-radius: 0.5rem; padding: 1.5rem; margin-bottom: 1.5rem; border: 1px solid rgba(255, 255, 255, 0.4);">
        <h2 style="font-size: 1.5rem; font-weight: 600; margin-bottom: 1rem; color: #ffffff;">Next Steps:</h2>
        <ol style="text-align: left; list-style: decimal; padding-left: 1.5rem; max-width: 28rem; margin: 0 auto; color: #ffffff;">
          <li style="margin-bottom: 0.75rem; font-weight: 500; color: #ffffff;">Check your email for login credentials</li>
          <li style="margin-bottom: 0.75rem; font-weight: 500; color: #ffffff;">Join our private Discord community</li>
          <li style="margin-bottom: 0.75rem; font-weight: 500; color: #ffffff;">Start with Module 1: Basics of Trading</li>
        </ol>
      </div>
      <button onclick="window.location.href=''/dashboard''" style="background: #ffffff; color: #16a34a; font-weight: 700; padding: 0.75rem 2rem; border-radius: 0.5rem; border: none; cursor: pointer; transition: all 0.3s;" onmouseover="this.style.background=''#f3f4f6''" onmouseout="this.style.background=''#ffffff''">
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
  '<div style="min-height: 100vh; background: #000000; color: #ffffff;">
    <div style="max-width: 1200px; margin: 0 auto; padding: 5rem 1rem;">
      <div style="max-width: 80rem; margin: 0 auto;">
        <div style="text-align: center; margin-bottom: 3rem;">
          <h1 style="font-size: 3.75rem; font-weight: 700; margin-bottom: 1.5rem; background: linear-gradient(to right, #60a5fa, #a78bfa); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
            Pablo AI Trading Bot
          </h1>
          <p style="font-size: 1.5rem; color: #e5e7eb; margin-bottom: 1rem; font-weight: 500;">Trade 24/7 with AI-Powered Automation</p>
          <p style="font-size: 1.125rem; color: #d1d5db;">Let our advanced AI handle your trades while you sleep</p>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1.5rem; margin-bottom: 3rem;">
          <div style="background: #111827; border-radius: 0.5rem; padding: 1.5rem; border: 1px solid #1f2937;">
            <div style="font-size: 2.5rem; margin-bottom: 1rem;">🤖</div>
            <h3 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 0.5rem; color: #ffffff;">AI-Powered</h3>
            <p style="color: #d1d5db;">Advanced machine learning algorithms analyze market patterns</p>
          </div>
          <div style="background: #111827; border-radius: 0.5rem; padding: 1.5rem; border: 1px solid #1f2937;">
            <div style="font-size: 2.5rem; margin-bottom: 1rem;">⚡</div>
            <h3 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 0.5rem; color: #ffffff;">Lightning Fast</h3>
            <p style="color: #d1d5db;">Execute trades in milliseconds with low latency</p>
          </div>
          <div style="background: #111827; border-radius: 0.5rem; padding: 1.5rem; border: 1px solid #1f2937;">
            <div style="font-size: 2.5rem; margin-bottom: 1rem;">📈</div>
            <h3 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 0.5rem; color: #ffffff;">Proven Results</h3>
            <p style="color: #d1d5db;">Average 15-25% monthly returns with proper risk management</p>
          </div>
        </div>

        <div style="background: linear-gradient(to right, #2563eb, #9333ea); border-radius: 1rem; padding: 2rem; text-align: center; margin-bottom: 2rem;">
          <h2 style="font-size: 1.875rem; font-weight: 700; margin-bottom: 1rem; color: #ffffff;">Start Trading Today</h2>
          <p style="font-size: 1.25rem; margin-bottom: 1.5rem; color: #ffffff;">Join 5,000+ traders using Pablo AI</p>
          <div style="display: flex; align-items: center; justify-content: center; gap: 1rem; margin-bottom: 1.5rem;">
            <span style="font-size: 1.875rem; font-weight: 700; color: #ffffff;">$99</span>
            <span style="color: rgba(255, 255, 255, 0.9);">/month</span>
          </div>
          <button onclick="window.location.href=''#signup''" style="background: #ffffff; color: #2563eb; font-weight: 700; padding: 1rem 3rem; border-radius: 0.5rem; font-size: 1.25rem; border: none; cursor: pointer; transition: all 0.3s; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);" onmouseover="this.style.background=''#f3f4f6''" onmouseout="this.style.background=''#ffffff''">
            Start Free Trial
          </button>
          <p style="font-size: 0.875rem; margin-top: 1rem; color: #ffffff; font-weight: 500;">7-day free trial • Cancel anytime</p>
        </div>

        <div style="background: #111827; border-radius: 0.5rem; padding: 1.5rem;">
          <h3 style="font-size: 1.5rem; font-weight: 600; margin-bottom: 1rem; text-align: center; color: #ffffff;">What''s Included:</h3>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem;">
            <div style="display: flex; align-items: flex-start;">
              <span style="color: #86efac; margin-right: 0.75rem; font-size: 1.25rem; font-weight: 700;">✓</span>
              <div>
                <strong style="color: #ffffff;">Unlimited Trading Bots</strong>
                <p style="color: #d1d5db; font-size: 0.875rem; margin: 0;">Create as many bots as you need</p>
              </div>
            </div>
            <div style="display: flex; align-items: flex-start;">
              <span style="color: #86efac; margin-right: 0.75rem; font-size: 1.25rem; font-weight: 700;">✓</span>
              <div>
                <strong style="color: #ffffff;">Real-time Analytics</strong>
                <p style="color: #d1d5db; font-size: 0.875rem; margin: 0;">Track performance with detailed reports</p>
              </div>
            </div>
            <div style="display: flex; align-items: flex-start;">
              <span style="color: #86efac; margin-right: 0.75rem; font-size: 1.25rem; font-weight: 700;">✓</span>
              <div>
                <strong style="color: #ffffff;">24/7 Support</strong>
                <p style="color: #d1d5db; font-size: 0.875rem; margin: 0;">Get help whenever you need it</p>
              </div>
            </div>
            <div style="display: flex; align-items: flex-start;">
              <span style="color: #86efac; margin-right: 0.75rem; font-size: 1.25rem; font-weight: 700;">✓</span>
              <div>
                <strong style="color: #ffffff;">Advanced Strategies</strong>
                <p style="color: #d1d5db; font-size: 0.875rem; margin: 0;">Access to premium trading strategies</p>
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
  '<div style="min-height: 100vh; background: linear-gradient(135deg, #312e81 0%, #6b21a8 50%, #9f1239 100%); color: #ffffff;">
    <div style="max-width: 1200px; margin: 0 auto; padding: 4rem 1rem;">
      <div style="max-width: 56rem; margin: 0 auto;">
        <div style="text-align: center; margin-bottom: 3rem;">
          <div style="font-size: 4rem; margin-bottom: 1.5rem;">📚</div>
          <h1 style="font-size: 3rem; font-weight: 700; margin-bottom: 1rem; color: #ffffff;">Get Your Free Trading Guide</h1>
          <p style="font-size: 1.5rem; color: #e9d5ff; margin-bottom: 0.5rem; font-weight: 500;">"10 Strategies That Made Me $100K in Crypto Trading"</p>
          <p style="font-size: 1.125rem; color: #ddd6fe;">Download instantly - No credit card required</p>
        </div>

        <div style="background: rgba(255, 255, 255, 0.2); backdrop-filter: blur(10px); border-radius: 1rem; padding: 2rem; margin-bottom: 2rem; border: 1px solid rgba(255, 255, 255, 0.3);">
          <h2 style="font-size: 1.5rem; font-weight: 600; margin-bottom: 1.5rem; text-align: center; color: #ffffff;">What''s Inside:</h2>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem;">
            <div style="display: flex; align-items: flex-start;">
              <span style="color: #fde047; margin-right: 0.75rem; font-size: 1.5rem;">📖</span>
              <div>
                <strong style="color: #ffffff;">10 Proven Strategies</strong>
                <p style="font-size: 0.875rem; color: #e9d5ff; margin: 0;">Step-by-step trading methods</p>
              </div>
            </div>
            <div style="display: flex; align-items: flex-start;">
              <span style="color: #fde047; margin-right: 0.75rem; font-size: 1.5rem;">💡</span>
              <div>
                <strong style="color: #ffffff;">Risk Management Tips</strong>
                <p style="font-size: 0.875rem; color: #e9d5ff; margin: 0;">Protect your capital</p>
              </div>
            </div>
            <div style="display: flex; align-items: flex-start;">
              <span style="color: #fde047; margin-right: 0.75rem; font-size: 1.5rem;">📊</span>
              <div>
                <strong style="color: #ffffff;">Market Analysis Tools</strong>
                <p style="font-size: 0.875rem; color: #e9d5ff; margin: 0;">Identify opportunities</p>
              </div>
            </div>
            <div style="display: flex; align-items: flex-start;">
              <span style="color: #fde047; margin-right: 0.75rem; font-size: 1.5rem;">🎯</span>
              <div>
                <strong style="color: #ffffff;">Entry & Exit Points</strong>
                <p style="font-size: 0.875rem; color: #e9d5ff; margin: 0;">Perfect timing strategies</p>
              </div>
            </div>
          </div>
        </div>

        <div style="background: #ffffff; border-radius: 1rem; padding: 2rem; color: #111827;">
          <h3 style="font-size: 1.5rem; font-weight: 700; margin-bottom: 1.5rem; text-align: center; color: #111827;">Get Instant Access</h3>
          <form style="display: flex; flex-direction: column; gap: 1rem;">
            <input type="text" placeholder="Your Name" style="width: 100%; padding: 0.75rem 1rem; border: 2px solid #9ca3af; border-radius: 0.5rem; color: #111827; font-size: 1rem;" onfocus="this.style.borderColor=''#9333ea''; this.style.outline=''none''" onblur="this.style.borderColor=''#9ca3af''">
            <input type="email" placeholder="Your Email" style="width: 100%; padding: 0.75rem 1rem; border: 2px solid #9ca3af; border-radius: 0.5rem; color: #111827; font-size: 1rem;" onfocus="this.style.borderColor=''#9333ea''; this.style.outline=''none''" onblur="this.style.borderColor=''#9ca3af''">
            <button type="submit" onclick="event.preventDefault(); window.location.href=''#download''" style="width: 100%; background: linear-gradient(to right, #9333ea, #db2777); color: #ffffff; font-weight: 700; padding: 1rem 2rem; border-radius: 0.5rem; font-size: 1.25rem; border: none; cursor: pointer; transition: all 0.3s;" onmouseover="this.style.opacity=''0.9''" onmouseout="this.style.opacity=''1''">
              Download Free Guide Now
            </button>
          </form>
          <p style="text-align: center; color: #6b7280; font-size: 0.875rem; margin-top: 1rem;">🔒 We respect your privacy. Unsubscribe at any time.</p>
        </div>

        <div style="margin-top: 2rem; text-align: center;">
          <p style="color: #e9d5ff; font-weight: 500;">⭐ Join 25,000+ traders who downloaded this guide</p>
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
  '<div style="min-height: 100vh; background: linear-gradient(135deg, #4ade80 0%, #3b82f6 100%); color: #ffffff; display: flex; align-items: center; justify-content: center;">
    <div style="text-align: center; max-width: 42rem; margin: 0 auto; padding: 0 1rem;">
      <div style="font-size: 4rem; margin-bottom: 1.5rem;">✅</div>
      <h1 style="font-size: 2.25rem; font-weight: 700; margin-bottom: 1rem; color: #ffffff;">Check Your Email!</h1>
      <p style="font-size: 1.25rem; margin-bottom: 2rem; color: #ffffff;">Your free trading guide has been sent to your inbox.</p>
      <div style="background: rgba(255, 255, 255, 0.3); backdrop-filter: blur(10px); border-radius: 0.5rem; padding: 1.5rem; margin-bottom: 1.5rem; border: 1px solid rgba(255, 255, 255, 0.4);">
        <p style="margin-bottom: 1rem; color: #ffffff; font-weight: 500;">Can''t find it? Check your spam folder.</p>
        <p style="font-size: 0.875rem; color: #ffffff;">The email should arrive within 2 minutes.</p>
      </div>
      <button onclick="window.location.href=''/dashboard''" style="background: #ffffff; color: #16a34a; font-weight: 700; padding: 0.75rem 2rem; border-radius: 0.5rem; border: none; cursor: pointer; transition: all 0.3s;" onmouseover="this.style.background=''#f3f4f6''" onmouseout="this.style.background=''#ffffff''">
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
  '<div style="min-height: 100vh; background: linear-gradient(to right, #dc2626, #f97316, #eab308); color: #ffffff;">
    <div style="max-width: 1200px; margin: 0 auto; padding: 4rem 1rem;">
      <div style="max-width: 48rem; margin: 0 auto; text-align: center;">
        <div style="background: rgba(255, 255, 255, 0.3); backdrop-filter: blur(10px); border-radius: 1rem; padding: 2rem; margin-bottom: 2rem; border: 1px solid rgba(255, 255, 255, 0.4);">
          <div style="font-size: 3rem; margin-bottom: 1rem;">🎥</div>
          <h1 style="font-size: 3rem; font-weight: 700; margin-bottom: 1rem; color: #ffffff;">Free Live Trading Webinar</h1>
          <p style="font-size: 1.5rem; margin-bottom: 1.5rem; color: #ffffff; font-weight: 500;">"How to Make $10K/Month with Crypto Trading Bots"</p>
          <div style="background: rgba(255, 255, 255, 0.4); border-radius: 0.5rem; padding: 1rem; margin-bottom: 1.5rem; border: 1px solid rgba(255, 255, 255, 0.5);">
            <p style="font-size: 1.875rem; font-weight: 700; margin-bottom: 0.5rem; color: #ffffff;">📅 January 20, 2025</p>
            <p style="font-size: 1.25rem; color: #ffffff; font-weight: 500;">⏰ 7:00 PM EST</p>
          </div>
        </div>

        <div style="background: #ffffff; color: #111827; border-radius: 1rem; padding: 2rem; margin-bottom: 2rem;">
          <h2 style="font-size: 1.875rem; font-weight: 700; margin-bottom: 1.5rem; color: #111827;">What You''ll Learn:</h2>
          <ul style="text-align: left; list-style: none; padding: 0; max-width: 36rem; margin: 0 auto;">
            <li style="display: flex; align-items: flex-start; margin-bottom: 1rem;">
              <span style="color: #f97316; margin-right: 0.75rem; font-size: 1.5rem; font-weight: 700;">✓</span>
              <div>
                <strong style="color: #111827;">How to set up profitable trading bots</strong>
                <p style="font-size: 0.875rem; color: #4b5563; margin: 0;">Step-by-step live demonstration</p>
              </div>
            </li>
            <li style="display: flex; align-items: flex-start; margin-bottom: 1rem;">
              <span style="color: #f97316; margin-right: 0.75rem; font-size: 1.5rem; font-weight: 700;">✓</span>
              <div>
                <strong style="color: #111827;">Best strategies for 2025</strong>
                <p style="font-size: 0.875rem; color: #4b5563; margin: 0;">What''s working right now</p>
              </div>
            </li>
            <li style="display: flex; align-items: flex-start; margin-bottom: 1rem;">
              <span style="color: #f97316; margin-right: 0.75rem; font-size: 1.5rem; font-weight: 700;">✓</span>
              <div>
                <strong style="color: #111827;">Live Q&A with experts</strong>
                <p style="font-size: 0.875rem; color: #4b5563; margin: 0;">Get your questions answered</p>
              </div>
            </li>
            <li style="display: flex; align-items: flex-start; margin-bottom: 1rem;">
              <span style="color: #f97316; margin-right: 0.75rem; font-size: 1.5rem; font-weight: 700;">✓</span>
              <div>
                <strong style="color: #111827;">Exclusive bonuses</strong>
                <p style="font-size: 0.875rem; color: #4b5563; margin: 0;">Free tools and resources</p>
              </div>
            </li>
          </ul>
        </div>

        <div style="background: #ffffff; color: #111827; border-radius: 1rem; padding: 2rem;">
          <h3 style="font-size: 1.5rem; font-weight: 700; margin-bottom: 1.5rem; color: #111827;">Reserve Your Spot</h3>
          <form style="display: flex; flex-direction: column; gap: 1rem;">
            <input type="text" placeholder="First Name" style="width: 100%; padding: 0.75rem 1rem; border: 2px solid #9ca3af; border-radius: 0.5rem; color: #111827; font-size: 1rem;" onfocus="this.style.borderColor=''#f97316''; this.style.outline=''none''" onblur="this.style.borderColor=''#9ca3af''">
            <input type="text" placeholder="Last Name" style="width: 100%; padding: 0.75rem 1rem; border: 2px solid #9ca3af; border-radius: 0.5rem; color: #111827; font-size: 1rem;" onfocus="this.style.borderColor=''#f97316''; this.style.outline=''none''" onblur="this.style.borderColor=''#9ca3af''">
            <input type="email" placeholder="Email Address" style="width: 100%; padding: 0.75rem 1rem; border: 2px solid #9ca3af; border-radius: 0.5rem; color: #111827; font-size: 1rem;" onfocus="this.style.borderColor=''#f97316''; this.style.outline=''none''" onblur="this.style.borderColor=''#9ca3af''">
            <button type="submit" onclick="event.preventDefault(); window.location.href=''#registered''" style="width: 100%; background: linear-gradient(to right, #dc2626, #f97316); color: #ffffff; font-weight: 700; padding: 1rem 2rem; border-radius: 0.5rem; font-size: 1.25rem; border: none; cursor: pointer; transition: all 0.3s;" onmouseover="this.style.opacity=''0.9''" onmouseout="this.style.opacity=''1''">
              Register for Free Webinar
            </button>
          </form>
          <p style="text-align: center; color: #6b7280; font-size: 0.875rem; margin-top: 1rem;">🔒 Limited to 500 spots • We''ll send you the link via email</p>
        </div>

        <div style="margin-top: 2rem;">
          <p style="font-size: 1.25rem; color: #ffffff; font-weight: 500;">🔥 <strong style="color: #ffffff;">487 spots remaining</strong></p>
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
  '<div style="min-height: 100vh; background: linear-gradient(135deg, #f97316 0%, #dc2626 100%); color: #ffffff; display: flex; align-items: center; justify-content: center;">
    <div style="text-align: center; max-width: 42rem; margin: 0 auto; padding: 0 1rem;">
      <div style="font-size: 4rem; margin-bottom: 1.5rem;">🎉</div>
      <h1 style="font-size: 2.25rem; font-weight: 700; margin-bottom: 1rem; color: #ffffff;">You''re Registered!</h1>
      <p style="font-size: 1.25rem; margin-bottom: 2rem; color: #ffffff;">Check your email for the webinar link and calendar reminder.</p>
      <div style="background: rgba(255, 255, 255, 0.3); backdrop-filter: blur(10px); border-radius: 0.5rem; padding: 1.5rem; margin-bottom: 1.5rem; border: 1px solid rgba(255, 255, 255, 0.4);">
        <h2 style="font-size: 1.5rem; font-weight: 600; margin-bottom: 1rem; color: #ffffff;">What Happens Next:</h2>
        <ol style="text-align: left; list-style: decimal; padding-left: 1.5rem; max-width: 28rem; margin: 0 auto; color: #ffffff;">
          <li style="margin-bottom: 0.75rem; font-weight: 500; color: #ffffff;">Check your email for confirmation</li>
          <li style="margin-bottom: 0.75rem; font-weight: 500; color: #ffffff;">Add the event to your calendar</li>
          <li style="margin-bottom: 0.75rem; font-weight: 500; color: #ffffff;">We''ll send a reminder 1 hour before</li>
          <li style="margin-bottom: 0.75rem; font-weight: 500; color: #ffffff;">Join us live on January 20 at 7 PM EST</li>
        </ol>
      </div>
      <button onclick="window.location.href=''/dashboard''" style="background: #ffffff; color: #f97316; font-weight: 700; padding: 0.75rem 2rem; border-radius: 0.5rem; border: none; cursor: pointer; transition: all 0.3s;" onmouseover="this.style.background=''#f3f4f6''" onmouseout="this.style.background=''#ffffff''">
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






