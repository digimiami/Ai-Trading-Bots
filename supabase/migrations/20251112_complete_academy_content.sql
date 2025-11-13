-- =============================================
-- Complete Academy Content Migration
-- Updates all existing lessons and adds new modules
-- =============================================

-- Update existing lessons with complete content
UPDATE public.module_lessons
SET content_md = CASE
  -- Module 1: Orientation & Setup
  WHEN slug = 'welcome' AND module_id IN (SELECT id FROM public.course_modules WHERE slug = 'orientation-setup') THEN
    '# Welcome to Pablo AI Trading Platform

Welcome to Pablo, your comprehensive AI-powered trading automation platform. This platform combines advanced trading strategies with machine learning capabilities to help you automate your cryptocurrency trading.

## What You''ll Learn

- Platform overview and key features
- Navigation and workspace layout
- Core concepts and terminology
- Getting started with your first bot

## Platform Overview

Pablo AI Trading is designed to make algorithmic trading accessible to traders of all experience levels. Our platform provides:

- **Automated Trading Bots**: Create and deploy trading strategies without coding
- **Paper Trading**: Test strategies risk-free before going live
- **AI/ML Integration**: Leverage machine learning for better predictions
- **Real-time Monitoring**: Track performance and adjust strategies on the fly
- **Multiple Exchanges**: Connect to major cryptocurrency exchanges
- **Risk Management**: Built-in stop-loss, take-profit, and position sizing

## Getting Started

1. **Dashboard**: Your central command center for all trading activities
2. **Bots**: Create and manage your trading bots
3. **Academy**: Learn trading strategies and platform features
4. **Settings**: Configure your account and exchange connections

Let''s begin your journey to automated trading success!'

  WHEN slug = 'security' AND module_id IN (SELECT id FROM public.course_modules WHERE slug = 'orientation-setup') THEN
    '## Security & Account Setup

Security is paramount when dealing with cryptocurrency trading. This lesson covers essential security practices to protect your account and funds.

### Multi-Factor Authentication (MFA)

**Why MFA Matters:**
- Adds an extra layer of security beyond passwords
- Protects against unauthorized access
- Required for sensitive operations

**How to Enable:**
1. Go to Settings > Security
2. Click "Enable Two-Factor Authentication"
3. Scan QR code with authenticator app (Google Authenticator, Authy)
4. Enter verification code to confirm

### API Key Management

**Best Practices:**
- **Read-Only Keys**: Use for monitoring and analysis
- **Trading Keys**: Only enable when actively trading
- **IP Whitelisting**: Restrict API access to specific IP addresses
- **Key Permissions**: Grant minimum required permissions
- **Regular Rotation**: Update API keys every 90 days

**Creating Secure API Keys:**
1. Log into your exchange account
2. Navigate to API Management
3. Create new API key with appropriate permissions
4. Copy API key and secret (store securely)
5. Add to Pablo platform in Settings > Exchanges

### Secure Storage

**Never Share:**
- API keys and secrets
- Private keys
- Passwords
- Recovery phrases

**Storage Recommendations:**
- Use password managers (1Password, LastPass)
- Enable encryption on stored credentials
- Use hardware security keys for critical accounts
- Regular backups of important data

### Account Recovery

Set up account recovery options:
- Backup email addresses
- Security questions
- Recovery codes (store offline)

### Security Checklist

- [ ] MFA enabled on all accounts
- [ ] API keys created with minimal permissions
- [ ] Passwords are strong and unique
- [ ] Credentials stored securely
- [ ] Regular security audits scheduled
- [ ] Email notifications enabled for account activity'

  WHEN slug = 'first-automation' AND module_id IN (SELECT id FROM public.course_modules WHERE slug = 'orientation-setup') THEN
    '### Launch Your First Trading Bot

This walkthrough will guide you through creating and deploying your first automated trading bot using paper trading mode.

## Step 1: Connect an Exchange

1. Navigate to **Settings > Exchanges**
2. Click **"Add Exchange"**
3. Select your exchange (Binance, Bybit, etc.)
4. Enter your API credentials
5. Test connection and save

## Step 2: Create a Paper Trading Account

Paper trading allows you to test strategies without risking real funds:

1. Go to **Dashboard > Paper Trading**
2. Click **"Create Paper Account"**
3. Set initial balance (default: $10,000)
4. Confirm account creation

## Step 3: Create Your First Bot

1. Navigate to **Bots > Create Bot**
2. **Basic Configuration:**
   - Name: "My First Bot"
   - Exchange: Select your connected exchange
   - Trading Type: Spot or Futures
   - Symbol: BTC/USDT (or your preferred pair)

3. **Strategy Selection:**
   - Choose a preset strategy (Trend Following, Mean Reversion, etc.)
   - Or create a custom strategy

4. **Risk Parameters:**
   - Trade Amount: $100 per trade
   - Stop Loss: 2%
   - Take Profit: 4%
   - Risk Level: Low/Medium/High

5. **Enable Paper Trading:**
   - Toggle "Paper Trading" to ON
   - This ensures no real funds are used

## Step 4: Deploy and Monitor

1. Click **"Create Bot"**
2. Bot will appear in your dashboard
3. Monitor real-time performance
4. Review trade history and metrics

## Understanding Bot Status

- **Running**: Bot is active and executing trades
- **Stopped**: Bot is paused (no new trades)
- **Error**: Bot encountered an issue (check logs)

## Next Steps

- Review bot performance after 24 hours
- Adjust parameters based on results
- Try different strategies
- Move to live trading when confident

Remember: Paper trading is risk-free, so experiment freely!'

  WHEN slug = 'paper-vs-real' AND module_id IN (SELECT id FROM public.course_modules WHERE slug = 'orientation-setup') THEN
    '## Paper Trading vs Real Trading

Understanding the differences between paper trading and real trading is crucial before making the switch. This lesson covers what to expect in each mode and how to transition successfully.

### What is Paper Trading?

**Paper Trading (Simulation Mode):**
- Uses virtual money (no real funds at risk)
- Executes simulated trades based on real market data
- Perfect for testing strategies and learning
- Zero financial risk
- Same market conditions as real trading

**Key Characteristics:**
- Real-time market data from mainnet
- Simulated order execution
- Virtual balance management
- Full strategy testing capability
- Performance tracking and metrics

### What is Real Trading?

**Real Trading (Live Mode):**
- Uses actual funds from your exchange account
- Places real orders on the exchange
- Real profits and losses
- Requires careful risk management
- Emotional and psychological factors

**Key Characteristics:**
- Actual order placement
- Real money at risk
- Exchange fees apply
- Slippage may occur
- Withdrawal capabilities

### Key Differences

**1. Execution Differences**

**Paper Trading:**
- Instant order fills (simulated)
- No slippage (uses exact prices)
- No exchange fees
- Perfect execution conditions

**Real Trading:**
- Order fills depend on market liquidity
- Slippage can occur (price moves during execution)
- Exchange fees apply (maker/taker fees)
- Real market conditions affect execution

**2. Psychological Impact**

**Paper Trading:**
- No emotional stress
- Easy to take losses
- Can experiment freely
- Less pressure on decisions

**Real Trading:**
- Real money creates emotional pressure
- Losses feel more significant
- May hesitate on trades
- Requires discipline and emotional control

**3. Performance Expectations**

**Paper Trading:**
- Often shows better results (no fees, no slippage)
- Perfect execution conditions
- May not reflect real-world performance
- Useful for strategy validation

**Real Trading:**
- Performance typically lower (fees, slippage)
- Real market conditions
- More accurate representation
- Actual profitability matters

### What to Expect When Paper Trading

**Advantages:**
- ✅ Risk-free learning environment
- ✅ Test multiple strategies simultaneously
- ✅ Experiment with different parameters
- ✅ Build confidence before going live
- ✅ Understand platform features
- ✅ Learn from mistakes without cost

**Limitations:**
- ⚠️ Results may be optimistic (no fees/slippage)
- ⚠️ No emotional pressure (different psychology)
- ⚠️ Perfect execution (not realistic)
- ⚠️ May develop bad habits
- ⚠️ Doesn''t account for all real-world factors

**Best Practices:**
- Treat paper trading seriously
- Use realistic position sizes
- Monitor performance closely
- Document what works and what doesn''t
- Test for at least 2-4 weeks before going live
- Test in different market conditions

### What to Expect When Switching to Real Trading

**Performance Adjustments:**

**Expect Lower Returns:**
- Exchange fees reduce profits (0.1-0.2% per trade)
- Slippage affects entry/exit prices
- Real execution may differ from simulation
- Initial performance may be 10-20% lower

**Psychological Changes:**

**Increased Stress:**
- Real money creates pressure
- Losses feel more significant
- May second-guess decisions
- Need for emotional discipline

**Behavioral Adjustments:**
- May be more conservative
- Could hesitate on good trades
- Might overtrade to recover losses
- Need to stick to tested strategies

**Practical Considerations:**

**Capital Management:**
- Start with smaller position sizes
- Use only risk capital (money you can afford to lose)
- Gradually increase as confidence grows
- Maintain emergency fund

**Monitoring Requirements:**
- More frequent checks initially
- Watch for execution issues
- Monitor fees and slippage
- Track real vs paper performance

### Making the Transition

**Step 1: Validate in Paper Trading**
- Test strategy for minimum 2-4 weeks
- Achieve consistent positive results
- Understand strategy behavior
- Document performance metrics

**Step 2: Start Small in Real Trading**
- Use 10-25% of intended capital initially
- Test with one bot first
- Monitor closely for first week
- Compare real vs paper performance

**Step 3: Gradual Scaling**
- Increase position sizes gradually
- Add more bots over time
- Scale based on proven performance
- Maintain risk management rules

**Step 4: Continuous Monitoring**
- Track real vs paper performance
- Adjust for fees and slippage
- Refine strategies based on real results
- Maintain discipline and patience

### Performance Comparison

**Typical Differences:**

**Paper Trading Results:**
- Win Rate: 60%
- Average Profit: $50 per trade
- Monthly Return: 15%

**Real Trading Results (Expected):**
- Win Rate: 55-58% (slightly lower)
- Average Profit: $40-45 per trade (fees/slippage)
- Monthly Return: 10-12% (after fees)

**Why the Difference?**
- Exchange fees: 0.1-0.2% per trade
- Slippage: 0.05-0.1% average
- Execution delays
- Real market conditions

### Red Flags to Watch For

**In Paper Trading:**
- Unrealistic win rates (>70%)
- Perfect execution every time
- No consideration of fees
- Overconfidence in results

**When Switching to Real:**
- Significant performance drop (>30% difference)
- Emotional trading decisions
- Ignoring risk management
- Overtrading to recover losses

### Success Checklist

**Before Going Live:**
- [ ] Paper traded for 2-4+ weeks
- [ ] Consistent positive results
- [ ] Understand strategy behavior
- [ ] Tested in different market conditions
- [ ] Documented performance metrics
- [ ] Set realistic expectations
- [ ] Prepared for lower returns
- [ ] Risk management rules defined

**When Starting Real Trading:**
- [ ] Start with small capital
- [ ] Use proven strategies only
- [ ] Monitor closely initially
- [ ] Track fees and slippage
- [ ] Compare real vs paper performance
- [ ] Maintain discipline
- [ ] Stick to risk management
- [ ] Be patient with results

### Final Thoughts

**Paper Trading is Essential:**
- Never skip paper trading phase
- Use it to build confidence
- Learn platform features
- Validate strategies thoroughly

**Real Trading is Different:**
- Expect lower performance
- Account for fees and slippage
- Prepare for emotional challenges
- Start small and scale gradually

**Key Takeaway:**
Paper trading teaches you the mechanics, but real trading teaches you discipline. Both are valuable, but they serve different purposes. Use paper trading to learn and validate, then use real trading to build actual wealth with proven strategies.'

  -- Module 2: Platform Deep Dive
  WHEN slug = 'workflow' AND module_id IN (SELECT id FROM public.course_modules WHERE slug = 'platform-deep-dive') THEN
    '## Workflow Automations

Pablo''s automation system orchestrates signals, risk management, and execution seamlessly. Understanding this workflow is key to effective bot management.

### Automation Architecture

**Core Components:**
1. **Signal Generator**: Identifies trading opportunities
2. **Risk Engine**: Evaluates and filters trades
3. **Execution Layer**: Places orders on exchanges
4. **Monitoring System**: Tracks performance in real-time

### Signal Flow

**Step 1: Market Analysis**
- Technical indicators (RSI, MACD, EMA)
- Price action patterns
- Volume analysis
- Market sentiment

**Step 2: Signal Generation**
- Entry signals (buy/sell)
- Exit signals (take profit/stop loss)
- Position sizing recommendations

**Step 3: Risk Assessment**
- Position size calculation
- Drawdown limits
- Maximum exposure checks
- Correlation analysis

**Step 4: Execution**
- Order placement
- Slippage management
- Fill confirmation
- Trade logging

### Workflow Customization

**Strategy Templates:**
- Pre-built strategies for common patterns
- Customizable parameters
- Backtesting capabilities

**Conditional Logic:**
- IF/THEN rules
- Multiple condition chains
- Time-based triggers
- Event-driven actions

### Best Practices

1. **Start Simple**: Begin with basic strategies
2. **Test Thoroughly**: Use paper trading extensively
3. **Monitor Closely**: Watch first few trades carefully
4. **Iterate Gradually**: Make small adjustments
5. **Document Changes**: Keep notes on what works

### Common Workflows

**Trend Following:**
- Identify trend direction
- Enter on pullbacks
- Exit on trend reversal

**Mean Reversion:**
- Identify overbought/oversold conditions
- Enter contrarian positions
- Exit at mean reversion

**Breakout Trading:**
- Monitor consolidation patterns
- Enter on breakout confirmation
- Exit on target or stop loss'

  WHEN slug = 'monitoring' AND module_id IN (SELECT id FROM public.course_modules WHERE slug = 'platform-deep-dive') THEN
    '### Observability Stack

Effective monitoring is crucial for successful automated trading. This lesson covers Pablo''s comprehensive monitoring and alerting system.

## Dashboard Overview

**Key Metrics:**
- Total PnL (Profit and Loss)
- Win Rate
- Number of Trades
- Average Trade Duration
- Sharpe Ratio
- Maximum Drawdown

**Real-time Updates:**
- Live trade execution
- Position updates
- Balance changes
- Performance metrics

## Custom Dashboards

**Creating Custom Views:**
1. Click "Customize Dashboard"
2. Drag and drop widgets
3. Configure display options
4. Save layout

**Available Widgets:**
- PnL Chart
- Trade History Table
- Performance Metrics
- Bot Status Overview
- Market Data Feed

## Alert Configuration

**Alert Types:**
- **Trade Alerts**: Notify on trade execution
- **Performance Alerts**: Trigger on PnL thresholds
- **Error Alerts**: System and bot errors
- **Risk Alerts**: Drawdown and exposure warnings

**Setting Up Alerts:**
1. Go to Settings > Alerts
2. Click "Create Alert"
3. Select alert type
4. Configure conditions
5. Choose notification channel

**Notification Channels:**
- Email
- SMS (premium)
- Telegram
- Webhook
- In-app notifications

## Guardrails and Limits

**Position Limits:**
- Maximum position size
- Maximum total exposure
- Per-symbol limits
- Leverage limits

**Drawdown Protection:**
- Daily drawdown limit
- Weekly drawdown limit
- Maximum drawdown threshold
- Auto-stop on breach

**Trade Limits:**
- Maximum trades per day
- Maximum trades per hour
- Cooldown periods
- Minimum profit threshold

## Logging and Debugging

**Accessing Logs:**
1. Navigate to Bot > Logs
2. Filter by date, level, or type
3. Export logs for analysis

**Log Levels:**
- **Info**: General operations
- **Warning**: Potential issues
- **Error**: Failures requiring attention
- **Debug**: Detailed execution flow

## Performance Analysis

**Key Reports:**
- Daily/Weekly/Monthly summaries
- Trade-by-trade analysis
- Strategy performance comparison
- Risk-adjusted returns

**Export Options:**
- CSV for spreadsheet analysis
- JSON for programmatic access
- PDF reports for documentation'

  WHEN slug = 'knowledge-check' AND module_id IN (SELECT id FROM public.course_modules WHERE slug = 'platform-deep-dive') THEN
    '{"questions":[{"question":"Which component evaluates and filters trades before execution?","options":["Signal Generator","Risk Engine","Execution Layer","Monitoring System"],"correctIndex":1},{"question":"Where do you configure alert channels?","options":["Monitoring & Alerts","Governance Center","Automation Mesh","Strategy Studio"],"correctIndex":0},{"question":"What is the maximum drawdown threshold used for?","options":["Position sizing","Risk protection","Signal generation","Order execution"],"correctIndex":1},{"question":"Which alert type notifies you when a bot encounters an error?","options":["Trade Alerts","Performance Alerts","Error Alerts","Risk Alerts"],"correctIndex":2},{"question":"What does PnL stand for?","options":["Profit and Loss","Price and Liquidity","Position and Leverage","Portfolio and Limits"],"correctIndex":0}]}'

  -- Module 3: Crypto Foundations
  WHEN slug = 'microstructure' AND module_id IN (SELECT id FROM public.course_modules WHERE slug = 'crypto-foundations') THEN
    '## Market Microstructure

Understanding market microstructure is essential for effective trading. This lesson covers order books, liquidity, and execution considerations.

### Order Book Basics

**What is an Order Book?**
- Real-time list of buy and sell orders
- Shows price levels and order sizes
- Updates continuously as orders are placed/filled

**Key Components:**
- **Bids**: Buy orders (want to purchase)
- **Asks**: Sell orders (want to sell)
- **Spread**: Difference between best bid and ask
- **Depth**: Total volume at each price level

### Reading the Order Book

**Bid Side (Left):**
- Shows buyers willing to purchase
- Prices listed from highest to lowest
- Best bid is the highest price

**Ask Side (Right):**
- Shows sellers willing to sell
- Prices listed from lowest to highest
- Best ask is the lowest price

**Spread Analysis:**
- Tight spread = High liquidity
- Wide spread = Low liquidity
- Spread affects execution price

### Liquidity Pockets

**What is Liquidity?**
- Ease of buying/selling without price impact
- High liquidity = Large order book depth
- Low liquidity = Thin order book

**Identifying Liquidity:**
- Look for large orders at price levels
- Monitor order book depth
- Check trading volume
- Analyze historical liquidity patterns

**Liquidity Impact:**
- High liquidity: Better execution, lower slippage
- Low liquidity: Higher slippage, price impact
- Affects position sizing decisions

### Execution Considerations

**Market Orders:**
- Execute immediately at current price
- Higher slippage risk
- Use for urgent trades

**Limit Orders:**
- Execute at specified price or better
- Lower slippage
- May not fill immediately

**Order Types:**
- **Market**: Immediate execution
- **Limit**: Price-specific execution
- **Stop-Loss**: Risk management
- **Take-Profit**: Profit realization

### Slippage Management

**What is Slippage?**
- Difference between expected and actual price
- More common in low liquidity markets
- Affects profitability

**Reducing Slippage:**
- Trade during high liquidity periods
- Use limit orders when possible
- Split large orders
- Monitor order book depth

### Market Impact

**Price Impact:**
- Large orders move market price
- More significant in low liquidity
- Consider when sizing positions

**Best Practices:**
- Size positions relative to liquidity
- Use time-weighted average price (TWAP)
- Consider order book depth
- Monitor execution quality'

  WHEN slug = 'risk-position' AND module_id IN (SELECT id FROM public.course_modules WHERE slug = 'crypto-foundations') THEN
    '### Position Sizing Basics

Proper position sizing is critical for risk management and long-term profitability. This lesson covers ATR-based sizing, volatility buckets, and capital allocation.

## Risk Per Trade

**The 1% Rule:**
- Risk only 1-2% of capital per trade
- Protects against string of losses
- Allows for recovery

**Calculation:**
```
Position Size = (Account Balance × Risk %) / Stop Loss Distance
```

**Example:**
- Account: $10,000
- Risk: 1% = $100
- Stop Loss: 2% away
- Position Size: $100 / 0.02 = $5,000

## ATR-Based Position Sizing

**What is ATR?**
- Average True Range
- Measures market volatility
- Adjusts position size to volatility

**ATR Calculation:**
1. Calculate True Range (TR)
2. Average TR over period (typically 14)
3. Use ATR to set stop loss distance

**Using ATR for Sizing:**
- Higher ATR = Larger stop distance = Smaller position
- Lower ATR = Smaller stop distance = Larger position
- Maintains consistent risk across different volatility

**Formula:**
```
Position Size = (Risk Amount) / (ATR × Multiplier)
```

## Volatility Buckets

**Categorizing Assets:**
- **High Volatility**: BTC, ETH (larger swings)
- **Medium Volatility**: Major alts
- **Low Volatility**: Stablecoins, major pairs

**Position Sizing by Bucket:**
- High volatility: Smaller positions
- Medium volatility: Standard positions
- Low volatility: Larger positions (if desired)

**Benefits:**
- Normalizes risk across assets
- Prevents overexposure to volatile assets
- Simplifies position sizing decisions

## Capital Allocation

**Portfolio Distribution:**
- Diversify across strategies
- Limit exposure per strategy
- Consider correlation between positions

**Allocation Rules:**
- Maximum 20-30% per strategy
- Maximum 10-15% per asset
- Reserve capital for opportunities
- Maintain cash buffer

## Kelly Criterion

**Optimal Position Sizing:**
- Mathematical approach to position sizing
- Based on win rate and risk/reward ratio
- Formula: f = (p × b - q) / b

**Where:**
- f = Fraction of capital to risk
- p = Win probability
- b = Win/loss ratio
- q = Loss probability (1 - p)

**Conservative Approach:**
- Use fractional Kelly (25-50% of full Kelly)
- Reduces risk of over-leveraging
- More practical for real trading

## Practical Guidelines

**For Beginners:**
- Start with 0.5-1% risk per trade
- Use fixed position sizes initially
- Gradually introduce ATR-based sizing

**For Intermediate:**
- Implement ATR-based sizing
- Use volatility buckets
- Monitor and adjust regularly

**For Advanced:**
- Kelly Criterion or variations
- Dynamic position sizing
- Portfolio-level risk management

## Risk Management Checklist

- [ ] Risk per trade defined (1-2%)
- [ ] Stop loss always set
- [ ] Position size calculated before entry
- [ ] Total exposure monitored
- [ ] Correlation between positions considered
- [ ] Maximum drawdown limits set'

  WHEN slug = 'psychology' AND module_id IN (SELECT id FROM public.course_modules WHERE slug = 'crypto-foundations') THEN
    '### Trading Psychology & Mindset

Discipline beats emotion in trading. This lesson covers the psychological aspects of trading and how to maintain a professional mindset.

## Emotional Challenges

**Common Emotions:**
- **Fear**: Prevents taking good trades
- **Greed**: Leads to overtrading
- **Hope**: Holding losing positions too long
- **Revenge**: Trading to recover losses

**Impact on Performance:**
- Emotional decisions = Poor outcomes
- Deviating from strategy = Increased risk
- Overtrading = Higher costs, lower returns

## Discipline Framework

**Stick to Your Plan:**
- Define strategy before trading
- Set clear entry/exit rules
- Follow rules consistently
- Review and adjust systematically

**Avoid Emotional Trading:**
- Don''t trade after big wins (euphoria)
- Don''t trade after big losses (revenge)
- Take breaks when emotional
- Use automation to remove emotion

## Routine and Structure

**Daily Routine:**
1. Review overnight activity
2. Check bot status and performance
3. Analyze market conditions
4. Adjust parameters if needed
5. Document decisions and reasoning

**Weekly Review:**
- Performance analysis
- Strategy evaluation
- Risk assessment
- Plan adjustments

**Monthly Assessment:**
- Overall performance review
- Strategy optimization
- Goal setting
- Learning and improvement

## Handling Losses

**Accept Losses:**
- Losses are part of trading
- Not every trade will be profitable
- Focus on long-term performance
- Learn from losing trades

**Recovery Strategies:**
- Don''t increase position size after losses
- Stick to risk management rules
- Take time to analyze what went wrong
- Return to trading with clear mind

## Performance Mindset

**Process Over Outcome:**
- Focus on following your strategy
- Good process leads to good outcomes
- Short-term results can be random
- Long-term consistency matters

**Continuous Learning:**
- Study market behavior
- Analyze your trades
- Learn from mistakes
- Stay updated on strategies

## Stress Management

**Signs of Trading Stress:**
- Difficulty sleeping
- Constant checking of positions
- Emotional reactions to PnL
- Neglecting other responsibilities

**Coping Strategies:**
- Set trading hours
- Use automation to reduce monitoring
- Take regular breaks
- Maintain work-life balance
- Exercise and healthy habits

## Building Confidence

**Start Small:**
- Begin with paper trading
- Use small position sizes
- Build confidence gradually
- Scale up as you gain experience

**Track Progress:**
- Document wins and losses
- Analyze what works
- Celebrate milestones
- Learn from setbacks

## Professional Mindset

**Treat Trading as Business:**
- Set clear goals
- Measure performance objectively
- Make data-driven decisions
- Maintain professional standards

**Long-term Perspective:**
- Focus on sustainable growth
- Avoid get-rich-quick mentality
- Build wealth gradually
- Stay patient and disciplined'
END
WHERE slug IN ('welcome', 'security', 'first-automation', 'workflow', 'monitoring', 'knowledge-check', 'microstructure', 'risk-position', 'psychology')
  AND module_id IN (SELECT id FROM public.course_modules WHERE slug IN ('orientation-setup', 'platform-deep-dive', 'crypto-foundations'));

-- Add new lesson to Orientation & Setup module
INSERT INTO public.module_lessons (module_id, title, slug, type, content_md, media_url, order_index)
SELECT 
  cm.id,
  'Paper Trading vs Real Trading',
  'paper-vs-real',
  'guide',
  '## Paper Trading vs Real Trading

Understanding the differences between paper trading and real trading is crucial before making the switch. This lesson covers what to expect in each mode and how to transition successfully.

### What is Paper Trading?

**Paper Trading (Simulation Mode):**
- Uses virtual money (no real funds at risk)
- Executes simulated trades based on real market data
- Perfect for testing strategies and learning
- Zero financial risk
- Same market conditions as real trading

**Key Characteristics:**
- Real-time market data from mainnet
- Simulated order execution
- Virtual balance management
- Full strategy testing capability
- Performance tracking and metrics

### What is Real Trading?

**Real Trading (Live Mode):**
- Uses actual funds from your exchange account
- Places real orders on the exchange
- Real profits and losses
- Requires careful risk management
- Emotional and psychological factors

**Key Characteristics:**
- Actual order placement
- Real money at risk
- Exchange fees apply
- Slippage may occur
- Withdrawal capabilities

### Key Differences

**1. Execution Differences**

**Paper Trading:**
- Instant order fills (simulated)
- No slippage (uses exact prices)
- No exchange fees
- Perfect execution conditions

**Real Trading:**
- Order fills depend on market liquidity
- Slippage can occur (price moves during execution)
- Exchange fees apply (maker/taker fees)
- Real market conditions affect execution

**2. Psychological Impact**

**Paper Trading:**
- No emotional stress
- Easy to take losses
- Can experiment freely
- Less pressure on decisions

**Real Trading:**
- Real money creates emotional pressure
- Losses feel more significant
- May hesitate on trades
- Requires discipline and emotional control

**3. Performance Expectations**

**Paper Trading:**
- Often shows better results (no fees, no slippage)
- Perfect execution conditions
- May not reflect real-world performance
- Useful for strategy validation

**Real Trading:**
- Performance typically lower (fees, slippage)
- Real market conditions
- More accurate representation
- Actual profitability matters

### What to Expect When Paper Trading

**Advantages:**
- ✅ Risk-free learning environment
- ✅ Test multiple strategies simultaneously
- ✅ Experiment with different parameters
- ✅ Build confidence before going live
- ✅ Understand platform features
- ✅ Learn from mistakes without cost

**Limitations:**
- ⚠️ Results may be optimistic (no fees/slippage)
- ⚠️ No emotional pressure (different psychology)
- ⚠️ Perfect execution (not realistic)
- ⚠️ May develop bad habits
- ⚠️ Doesn''t account for all real-world factors

**Best Practices:**
- Treat paper trading seriously
- Use realistic position sizes
- Monitor performance closely
- Document what works and what doesn''t
- Test for at least 2-4 weeks before going live
- Test in different market conditions

### What to Expect When Switching to Real Trading

**Performance Adjustments:**

**Expect Lower Returns:**
- Exchange fees reduce profits (0.1-0.2% per trade)
- Slippage affects entry/exit prices
- Real execution may differ from simulation
- Initial performance may be 10-20% lower

**Psychological Changes:**

**Increased Stress:**
- Real money creates pressure
- Losses feel more significant
- May second-guess decisions
- Need for emotional discipline

**Behavioral Adjustments:**
- May be more conservative
- Could hesitate on good trades
- Might overtrade to recover losses
- Need to stick to tested strategies

**Practical Considerations:**

**Capital Management:**
- Start with smaller position sizes
- Use only risk capital (money you can afford to lose)
- Gradually increase as confidence grows
- Maintain emergency fund

**Monitoring Requirements:**
- More frequent checks initially
- Watch for execution issues
- Monitor fees and slippage
- Track real vs paper performance

### Making the Transition

**Step 1: Validate in Paper Trading**
- Test strategy for minimum 2-4 weeks
- Achieve consistent positive results
- Understand strategy behavior
- Document performance metrics

**Step 2: Start Small in Real Trading**
- Use 10-25% of intended capital initially
- Test with one bot first
- Monitor closely for first week
- Compare real vs paper performance

**Step 3: Gradual Scaling**
- Increase position sizes gradually
- Add more bots over time
- Scale based on proven performance
- Maintain risk management rules

**Step 4: Continuous Monitoring**
- Track real vs paper performance
- Adjust for fees and slippage
- Refine strategies based on real results
- Maintain discipline and patience

### Performance Comparison

**Typical Differences:**

**Paper Trading Results:**
- Win Rate: 60%
- Average Profit: $50 per trade
- Monthly Return: 15%

**Real Trading Results (Expected):**
- Win Rate: 55-58% (slightly lower)
- Average Profit: $40-45 per trade (fees/slippage)
- Monthly Return: 10-12% (after fees)

**Why the Difference?**
- Exchange fees: 0.1-0.2% per trade
- Slippage: 0.05-0.1% average
- Execution delays
- Real market conditions

### Red Flags to Watch For

**In Paper Trading:**
- Unrealistic win rates (>70%)
- Perfect execution every time
- No consideration of fees
- Overconfidence in results

**When Switching to Real:**
- Significant performance drop (>30% difference)
- Emotional trading decisions
- Ignoring risk management
- Overtrading to recover losses

### Success Checklist

**Before Going Live:**
- [ ] Paper traded for 2-4+ weeks
- [ ] Consistent positive results
- [ ] Understand strategy behavior
- [ ] Tested in different market conditions
- [ ] Documented performance metrics
- [ ] Set realistic expectations
- [ ] Prepared for lower returns
- [ ] Risk management rules defined

**When Starting Real Trading:**
- [ ] Start with small capital
- [ ] Use proven strategies only
- [ ] Monitor closely initially
- [ ] Track fees and slippage
- [ ] Compare real vs paper performance
- [ ] Maintain discipline
- [ ] Stick to risk management
- [ ] Be patient with results

### Final Thoughts

**Paper Trading is Essential:**
- Never skip paper trading phase
- Use it to build confidence
- Learn platform features
- Validate strategies thoroughly

**Real Trading is Different:**
- Expect lower performance
- Account for fees and slippage
- Prepare for emotional challenges
- Start small and scale gradually

**Key Takeaway:**
Paper trading teaches you the mechanics, but real trading teaches you discipline. Both are valuable, but they serve different purposes. Use paper trading to learn and validate, then use real trading to build actual wealth with proven strategies.',
  null,
  4
FROM public.course_modules cm
WHERE cm.slug = 'orientation-setup'
ON CONFLICT (module_id, slug) DO NOTHING;

-- Add new modules with comprehensive content
INSERT INTO public.course_modules (title, slug, audience, summary, media_url, duration_minutes, order_index)
VALUES
  ('Strategy Development', 'strategy-development', 'Intermediate to Advanced', 'Learn to build, test, and optimize trading strategies from scratch. Master backtesting, forward testing, and strategy refinement.', 'https://cdn.pablobots.net/academy/module4/hero.mp4', 60, 4),
  ('Risk Management Mastery', 'risk-management', 'All traders', 'Deep dive into advanced risk management techniques, portfolio optimization, and protecting your capital.', 'https://cdn.pablobots.net/academy/module5/hero.mp4', 45, 5),
  ('AI & Machine Learning', 'ai-machine-learning', 'Advanced traders', 'Harness the power of AI and ML for trading. Learn to use predictive models, sentiment analysis, and automated optimization.', 'https://cdn.pablobots.net/academy/module6/hero.mp4', 75, 6),
  ('Advanced Techniques', 'advanced-techniques', 'Expert traders', 'Master advanced trading concepts including multi-timeframe analysis, correlation trading, and sophisticated strategies.', 'https://cdn.pablobots.net/academy/module7/hero.mp4', 90, 7)
ON CONFLICT (slug) DO NOTHING;

-- Add lessons for new modules
WITH module_ids AS (
  SELECT slug, id FROM public.course_modules WHERE slug IN ('strategy-development', 'risk-management', 'ai-machine-learning', 'advanced-techniques')
)
INSERT INTO public.module_lessons (module_id, title, slug, type, content_md, media_url, order_index)
SELECT m.id, l.title, l.slug, l.type, l.content_md, l.media_url, l.order_index
FROM module_ids m
JOIN (
  VALUES
    -- Module 4: Strategy Development
    ('strategy-development', 'Strategy Fundamentals', 'fundamentals', 'guide', 
     '## Strategy Fundamentals

Building a successful trading strategy requires understanding core concepts and systematic approach.

### What Makes a Good Strategy?

**Key Characteristics:**
- Clear entry and exit rules
- Defined risk parameters
- Testable and repeatable
- Adaptable to market conditions
- Based on sound logic

### Strategy Components

**1. Entry Conditions:**
- Technical indicators
- Price patterns
- Market structure
- Volume confirmation
- Time-based filters

**2. Exit Conditions:**
- Take profit targets
- Stop loss levels
- Trailing stops
- Time-based exits
- Signal reversals

**3. Risk Management:**
- Position sizing rules
- Maximum drawdown limits
- Risk per trade
- Portfolio exposure limits

### Strategy Types

**Trend Following:**
- Identify and follow market trends
- Enter on trend confirmation
- Exit on trend reversal
- Works best in trending markets

**Mean Reversion:**
- Trade against extremes
- Enter when overextended
- Exit at mean reversion
- Works in ranging markets

**Breakout Trading:**
- Trade breakouts from consolidation
- Enter on breakout confirmation
- Exit on target or stop
- Requires volatility

**Momentum Trading:**
- Follow strong price movements
- Enter on momentum confirmation
- Exit on momentum loss
- High risk, high reward', 
     'https://cdn.pablobots.net/academy/module4/lesson1.mp4', 1),

    ('strategy-development', 'Backtesting Basics', 'backtesting', 'guide',
     '## Backtesting Your Strategies

Backtesting allows you to test strategies on historical data before risking real capital.

### Why Backtesting Matters

**Benefits:**
- Validate strategy logic
- Estimate potential performance
- Identify weaknesses
- Optimize parameters
- Build confidence

**Limitations:**
- Past performance ≠ future results
- Slippage and fees affect real trading
- Market conditions change
- Overfitting risk

### Backtesting Process

**Step 1: Data Preparation**
- Collect historical price data
- Ensure data quality
- Handle missing data
- Adjust for splits/dividends

**Step 2: Strategy Implementation**
- Code strategy logic
- Define entry/exit rules
- Set risk parameters
- Handle edge cases

**Step 3: Execution Simulation**
- Simulate order execution
- Account for slippage
- Include trading fees
- Handle partial fills

**Step 4: Performance Analysis**
- Calculate returns
- Measure risk metrics
- Analyze drawdowns
- Review trade distribution

### Key Metrics

**Performance Metrics:**
- Total Return
- Annualized Return
- Sharpe Ratio
- Sortino Ratio
- Win Rate
- Profit Factor

**Risk Metrics:**
- Maximum Drawdown
- Volatility
- Value at Risk (VaR)
- Maximum Adverse Excursion

### Common Pitfalls

**Overfitting:**
- Strategy works on test data only
- Too many parameters
- Curve fitting to noise
- Solution: Out-of-sample testing

**Look-Ahead Bias:**
- Using future data in past decisions
- Unrealistic execution
- Solution: Strict time-based logic

**Survivorship Bias:**
- Only testing successful assets
- Ignoring delisted assets
- Solution: Include all relevant data', 
     'https://cdn.pablobots.net/academy/module4/lesson2.mp4', 2),

    ('strategy-development', 'Strategy Optimization', 'optimization', 'guide',
     '### Strategy Optimization

Optimizing strategies improves performance while avoiding overfitting.

## Optimization Goals

**What to Optimize:**
- Entry/exit parameters
- Position sizing rules
- Time-based filters
- Risk parameters

**What NOT to Optimize:**
- Core strategy logic (too much)
- Too many parameters simultaneously
- Based on single metric only

## Optimization Methods

**Grid Search:**
- Test parameter combinations
- Systematic approach
- Computationally expensive
- Good for few parameters

**Genetic Algorithms:**
- Evolutionary approach
- Efficient for many parameters
- Finds good solutions
- May miss global optimum

**Walk-Forward Analysis:**
- Test on rolling windows
- More realistic
- Reduces overfitting
- Industry standard

## Parameter Selection

**Start Broad:**
- Test wide parameter ranges
- Identify promising regions
- Narrow down gradually

**Avoid Overfitting:**
- Use out-of-sample data
- Cross-validation
- Multiple time periods
- Realistic expectations

## Robustness Testing

**Stress Testing:**
- Test in different market conditions
- Vary parameters slightly
- Check performance stability
- Ensure strategy is robust

**Monte Carlo Simulation:**
- Randomize trade sequence
- Test thousands of scenarios
- Assess probability of outcomes
- Understand risk distribution', 
     null, 3),

    ('strategy-development', 'Strategy Quiz', 'strategy-quiz', 'quiz',
     '{"questions":[{"question":"What is the main risk of overfitting in backtesting?","options":["Strategy works only on historical data","Strategy is too simple","Strategy uses too many indicators","Strategy is too fast"],"correctIndex":0},{"question":"Which metric measures risk-adjusted returns?","options":["Total Return","Win Rate","Sharpe Ratio","Maximum Drawdown"],"correctIndex":2},{"question":"What is look-ahead bias?","options":["Using future data in past decisions","Looking at too many charts","Trading too frequently","Ignoring stop losses"],"correctIndex":0},{"question":"What is the purpose of walk-forward analysis?","options":["Test on rolling time windows","Optimize all parameters","Increase backtest speed","Reduce trading fees"],"correctIndex":0}]}',
     null, 4),

    -- Module 5: Risk Management Mastery
    ('risk-management', 'Portfolio Risk', 'portfolio-risk', 'guide',
     '## Portfolio Risk Management

Managing risk at the portfolio level is crucial for long-term success.

### Diversification Principles

**Why Diversify:**
- Reduces overall risk
- Smooths returns
- Protects against single asset failure
- Improves risk-adjusted returns

**Diversification Strategies:**
- Across assets (BTC, ETH, alts)
- Across strategies (trend, mean reversion)
- Across timeframes (short, medium, long)
- Across exchanges (if applicable)

### Correlation Analysis

**Understanding Correlation:**
- Measures how assets move together
- Range: -1 to +1
- +1 = Perfect positive correlation
- -1 = Perfect negative correlation
- 0 = No correlation

**Portfolio Correlation:**
- Low correlation = Better diversification
- High correlation = Concentrated risk
- Monitor correlation over time
- Adjust positions accordingly

### Position Correlation

**Managing Correlated Positions:**
- Limit exposure to correlated assets
- Adjust position sizes
- Consider portfolio-level stop loss
- Monitor correlation changes

### Risk Budgeting

**Allocating Risk:**
- Total portfolio risk limit
- Per-strategy risk allocation
- Per-asset risk limits
- Reserve risk for opportunities

**Risk Budget Example:**
- Total portfolio risk: 10% max drawdown
- Strategy 1: 3% allocation
- Strategy 2: 4% allocation
- Strategy 3: 2% allocation
- Reserve: 1% for new opportunities', 
     'https://cdn.pablobots.net/academy/module5/lesson1.mp4', 1),

    ('risk-management', 'Drawdown Management', 'drawdown-management', 'guide',
     '## Drawdown Management

Drawdowns are inevitable. Managing them effectively is key to survival.

### Understanding Drawdowns

**What is Drawdown?**
- Peak-to-trough decline
- Measured from highest equity
- Expressed as percentage
- Part of normal trading

**Types of Drawdowns:**
- **Maximum Drawdown**: Largest peak-to-trough
- **Current Drawdown**: Current decline from peak
- **Average Drawdown**: Typical drawdown size

### Drawdown Limits

**Setting Limits:**
- Daily drawdown limit: 2-5%
- Weekly drawdown limit: 5-10%
- Monthly drawdown limit: 10-20%
- Maximum drawdown: 20-30%

**Auto-Stop Rules:**
- Stop trading on limit breach
- Review and analyze cause
- Adjust strategy if needed
- Resume only after approval

### Recovery Strategies

**During Drawdowns:**
- Reduce position sizes
- Increase selectivity
- Review strategy performance
- Avoid revenge trading

**After Drawdowns:**
- Analyze what went wrong
- Identify improvements
- Test changes thoroughly
- Resume gradually', 
     'https://cdn.pablobots.net/academy/module5/lesson2.mp4', 2),

    ('risk-management', 'Risk Management Quiz', 'risk-quiz', 'quiz',
     '{"questions":[{"question":"What does a correlation of -1 mean?","options":["Perfect positive correlation","Perfect negative correlation","No correlation","High volatility"],"correctIndex":1},{"question":"What is the recommended maximum drawdown limit?","options":["5-10%","10-20%","20-30%","30-40%"],"correctIndex":2},{"question":"Why is diversification important?","options":["Increases returns","Reduces overall risk","Simplifies trading","Reduces fees"],"correctIndex":1},{"question":"What should you do during a drawdown?","options":["Increase position sizes","Reduce position sizes","Stop all trading","Ignore it"],"correctIndex":1}]}',
     null, 3),

    -- Module 6: AI & Machine Learning
    ('ai-machine-learning', 'ML Basics for Trading', 'ml-basics', 'guide',
     '## Machine Learning Basics for Trading

Machine learning can enhance trading strategies by identifying patterns and making predictions.

### What is ML in Trading?

**Applications:**
- Price prediction
- Signal generation
- Risk assessment
- Portfolio optimization
- Sentiment analysis

### ML Model Types

**Supervised Learning:**
- Classification: Predict direction (up/down)
- Regression: Predict price/value
- Requires labeled training data
- Most common in trading

**Unsupervised Learning:**
- Clustering: Group similar patterns
- Anomaly detection: Find outliers
- Market regime identification
- No labeled data needed

**Reinforcement Learning:**
- Learn through trial and error
- Optimize trading decisions
- Adapt to market changes
- Advanced application

### Feature Engineering

**Technical Features:**
- Price-based: RSI, MACD, Bollinger Bands
- Volume-based: Volume indicators, OBV
- Volatility: ATR, standard deviation
- Momentum: Rate of change, momentum

**Market Features:**
- Order book depth
- Trade flow
- Market microstructure
- Cross-asset correlations

### Model Training

**Data Preparation:**
- Clean and normalize data
- Handle missing values
- Feature selection
- Train/validation/test split

**Training Process:**
- Choose algorithm
- Set hyperparameters
- Train on historical data
- Validate on out-of-sample data', 
     'https://cdn.pablobots.net/academy/module6/lesson1.mp4', 1),

    ('ai-machine-learning', 'Using AI Predictions', 'ai-predictions', 'guide',
     '## Using AI Predictions in Trading

Integrating ML predictions into trading strategies requires careful implementation.

### Prediction Integration

**Confidence Thresholds:**
- Only trade on high-confidence predictions
- Set minimum confidence level (e.g., 70%)
- Adjust based on backtesting
- Monitor prediction accuracy

### Combining with Traditional Signals

**Hybrid Approach:**
- Use ML for confirmation
- Combine with technical analysis
- Weight predictions appropriately
- Maintain risk management

### Model Monitoring

**Performance Tracking:**
- Prediction accuracy over time
- Model drift detection
- Retraining triggers
- A/B testing different models

### Pablo AI/ML Features

**Available Features:**
- Automated model training
- Real-time predictions
- Confidence scoring
- Performance metrics
- Auto-retraining

**Best Practices:**
- Start with paper trading
- Monitor closely initially
- Adjust confidence thresholds
- Review and refine regularly', 
     'https://cdn.pablobots.net/academy/module6/lesson2.mp4', 2),

    ('ai-machine-learning', 'AI Optimization', 'ai-optimization', 'guide',
     '### AI-Powered Strategy Optimization

Leverage AI to automatically optimize your trading strategies.

## How It Works

**Analysis Process:**
1. Collect bot performance data
2. Analyze win rate, PnL, metrics
3. Identify optimization opportunities
4. Generate recommendations
5. Apply with approval

**Optimization Areas:**
- Entry/exit parameters
- Position sizing
- Risk parameters
- Time-based filters

## Using Auto-Optimization

**Enabling:**
1. Go to Bot Settings
2. Enable "AI Optimization"
3. Set confidence threshold
4. Choose auto-apply or manual review

**Monitoring:**
- Review recommendations
- Check confidence scores
- Analyze expected improvements
- Track applied optimizations

## Best Practices

**Start Conservative:**
- Use manual approval initially
- Review each recommendation
- Test in paper trading first
- Gradually increase automation

**Regular Review:**
- Check optimization results
- Verify improvements
- Adjust thresholds if needed
- Learn from outcomes', 
     null, 3),

    ('ai-machine-learning', 'AI Quiz', 'ai-quiz', 'quiz',
     '{"questions":[{"question":"What is supervised learning?","options":["Learning without labels","Learning with labeled data","Learning through trial and error","Learning from clustering"],"correctIndex":1},{"question":"What should you set for ML prediction confidence?","options":["As low as possible","50% minimum","High threshold (70%+)","100% always"],"correctIndex":2},{"question":"What is model drift?","options":["Model moving slowly","Model performance degrading over time","Model being too fast","Model using too much data"],"correctIndex":1},{"question":"What is the recommended approach when starting with AI optimization?","options":["Fully automated","Manual approval","No optimization","Random changes"],"correctIndex":1}]}',
     null, 4),

    -- Module 7: Advanced Techniques
    ('advanced-techniques', 'Multi-Timeframe Analysis', 'multi-timeframe', 'guide',
     '## Multi-Timeframe Analysis

Using multiple timeframes provides better context and improves trade quality.

### Timeframe Hierarchy

**Common Timeframes:**
- **Higher Timeframe (HTF)**: Trend direction (4H, Daily)
- **Entry Timeframe**: Trade execution (15M, 1H)
- **Lower Timeframe**: Precise entries (5M, 15M)

**Example Setup:**
- Daily: Overall trend
- 4H: Intermediate trend
- 1H: Entry signals
- 15M: Execution timing

### HTF Bias

**Trend Alignment:**
- Trade only in HTF trend direction
- Increases win rate
- Reduces false signals
- Better risk/reward

**Implementation:**
- Determine HTF trend (EMA, trend lines)
- Only take trades in trend direction
- Ignore counter-trend signals
- Use HTF levels for targets/stops

### Timeframe Confluence

**Multiple Confirmations:**
- HTF trend alignment
- Entry timeframe signal
- Lower timeframe confirmation
- Increases probability

**Example:**
- Daily: Uptrend
- 4H: Bullish structure
- 1H: Buy signal
- 15M: Entry confirmation', 
     'https://cdn.pablobots.net/academy/module7/lesson1.mp4', 1),

    ('advanced-techniques', 'Correlation Trading', 'correlation-trading', 'guide',
     '## Correlation Trading Strategies

Trading based on asset correlations can provide unique opportunities.

### Understanding Correlations

**Asset Relationships:**
- BTC and major alts often move together
- Some pairs have inverse correlation
- Correlations change over time
- Market regime affects correlations

### Trading Correlations

**Pairs Trading:**
- Trade price divergence
- Long one asset, short correlated asset
- Profit from convergence
- Market-neutral approach

**Momentum Spillover:**
- Strong move in one asset
- Often spills to correlated assets
- Trade the lagging asset
- Quick profit opportunity

### Monitoring Correlations

**Tools:**
- Correlation matrices
- Rolling correlation windows
- Visual correlation charts
- Real-time monitoring

**Key Metrics:**
- Current correlation
- Historical correlation range
- Correlation stability
- Breakout detection', 
     'https://cdn.pablobots.net/academy/module7/lesson2.mp4', 2),

    ('advanced-techniques', 'Advanced Strategies', 'advanced-strategies', 'guide',
     '### Advanced Trading Strategies

Sophisticated strategies for experienced traders.

## Grid Trading

**How It Works:**
- Place buy orders below price
- Place sell orders above price
- Profit from range-bound markets
- Automated order management

**Best For:**
- Range-bound markets
- High volatility assets
- Consistent income generation
- Requires monitoring

## Arbitrage

**Types:**
- Exchange arbitrage: Price differences
- Triangular arbitrage: Cross-pair opportunities
- Statistical arbitrage: Mean reversion
- Requires fast execution

**Considerations:**
- Transaction costs
- Execution speed
- Capital requirements
- Market access

## Market Making

**Strategy:**
- Provide liquidity
- Profit from bid-ask spread
- Manage inventory risk
- Requires sophisticated systems

**Requirements:**
- Deep market understanding
- Advanced risk management
- Fast execution
- Significant capital', 
     null, 3),

    ('advanced-techniques', 'Advanced Quiz', 'advanced-quiz', 'quiz',
     '{"questions":[{"question":"What is HTF bias?","options":["Trading against the trend","Trading only in higher timeframe trend direction","Using only high timeframes","Ignoring trends"],"correctIndex":1},{"question":"What is pairs trading?","options":["Trading two assets together","Trading price divergence between correlated assets","Trading only pairs","Trading with a partner"],"correctIndex":1},{"question":"What market condition is best for grid trading?","options":["Strong trends","Range-bound markets","High volatility only","Low liquidity"],"correctIndex":1},{"question":"What is required for arbitrage?","options":["Slow execution","High transaction costs","Fast execution","Large spreads"],"correctIndex":2}]}',
     null, 4)
) AS l(module_slug, title, slug, type, content_md, media_url, order_index)
ON m.slug = l.module_slug
ON CONFLICT (module_id, slug) DO NOTHING;

-- Update module durations based on lesson count
UPDATE public.course_modules cm
SET duration_minutes = (
  SELECT COALESCE(SUM(
    CASE 
      WHEN type = 'video' THEN 10
      WHEN type = 'guide' THEN 15
      WHEN type = 'quiz' THEN 5
      ELSE 10
    END
  ), 0)
  FROM public.module_lessons ml
  WHERE ml.module_id = cm.id
)
WHERE duration_minutes = 0 OR duration_minutes IS NULL;

