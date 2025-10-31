#!/usr/bin/env node

/**
 * PM2 Cron Job for Bot Scheduler
 * Runs the bot scheduler every 5 minutes using node-cron or setInterval
 * This script runs continuously and executes the scheduler on schedule
 */

const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

// Get script directory
const SCRIPT_DIR = __dirname;
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, '..');
const BASH_SCRIPT = path.join(SCRIPT_DIR, 'call-bot-scheduler.sh');

// Check if bash script exists
if (!fs.existsSync(BASH_SCRIPT)) {
  console.error(`❌ Error: Bash script not found at ${BASH_SCRIPT}`);
  process.exit(1);
}

// Make sure bash script is executable
fs.chmodSync(BASH_SCRIPT, '755');

/**
 * Execute the bot scheduler script
 */
function executeScheduler() {
  const timestamp = new Date().toISOString();
  console.log(`\n🔄 [${timestamp}] Executing bot scheduler...`);
  
  const child = exec(`bash "${BASH_SCRIPT}"`, {
    cwd: PROJECT_ROOT,
    env: {
      ...process.env,
      PATH: process.env.PATH
    }
  }, (error, stdout, stderr) => {
    if (error) {
      console.error(`❌ [${timestamp}] Error executing bot scheduler: ${error.message}`);
      return;
    }
    
    if (stderr) {
      console.warn(`⚠️  [${timestamp}] Warnings: ${stderr}`);
    }
    
    if (stdout) {
      console.log(`📊 [${timestamp}] Output:\n${stdout}`);
    }
  });

  // Log output in real-time
  child.stdout.on('data', (data) => {
    process.stdout.write(data);
  });

  child.stderr.on('data', (data) => {
    process.stderr.write(data);
  });

  child.on('exit', (code) => {
    if (code !== 0) {
      console.error(`❌ [${timestamp}] Bot scheduler exited with code ${code}`);
    } else {
      console.log(`✅ [${timestamp}] Bot scheduler completed successfully`);
    }
  });
}

// Try to use node-cron if available, otherwise use setInterval
let cron;
try {
  cron = require('node-cron');
  
  // Schedule to run every 5 minutes
  console.log('🚀 Starting PM2 Bot Scheduler Cron Job...');
  console.log('📅 Schedule: Every 5 minutes (*/5 * * * *)');
  console.log('⏱️  First execution will happen immediately...\n');
  
  // Execute immediately on startup
  executeScheduler();
  
  // Schedule every 5 minutes
  cron.schedule('*/5 * * * *', () => {
    executeScheduler();
  });
  
  console.log('✅ PM2 Bot Scheduler Cron Job is running and will execute every 5 minutes');
  console.log('🔄 The process will run continuously - do not exit this process');
  
} catch (e) {
  // Fallback to setInterval if node-cron is not installed
  console.warn('⚠️  node-cron not found, using setInterval fallback');
  console.log('💡 Install node-cron for better cron support: npm install node-cron');
  console.log('🚀 Starting PM2 Bot Scheduler with setInterval (every 5 minutes)...\n');
  
  // Execute immediately
  executeScheduler();
  
  // Run every 5 minutes (300000 ms)
  setInterval(() => {
    executeScheduler();
  }, 5 * 60 * 1000);
  
  console.log('✅ PM2 Bot Scheduler is running with setInterval (every 5 minutes)');
}

// Keep the process alive
process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});
