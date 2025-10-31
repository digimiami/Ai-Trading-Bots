/**
 * PM2 Ecosystem Configuration
 * Manages both the web app and bot scheduler cron job
 */

module.exports = {
  apps: [
    // Web Application
    {
      name: 'pablobots',
      script: 'npm',
      args: 'run preview',
      cwd: '/var/www/Ai-Trading-Bots',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production'
      },
      error_file: '/var/log/pm2/pablobots-error.log',
      out_file: '/var/log/pm2/pablobots-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true
    },
    
    // Bot Scheduler Cron Job (runs every 5 minutes)
    {
      name: 'bot-scheduler-cron',
      script: '/var/www/Ai-Trading-Bots/scripts/bot-scheduler-cron.cjs',
      cwd: '/var/www/Ai-Trading-Bots',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      
      env: {
        NODE_ENV: 'production'
      },
      error_file: '/var/log/pm2/bot-scheduler-cron-error.log',
      out_file: '/var/log/pm2/bot-scheduler-cron-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      
      // Kill timeout for long-running scripts
      kill_timeout: 30000
    }
  ]
};

