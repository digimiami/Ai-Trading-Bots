#!/bin/bash

# Nginx Configuration Script for Multiple Domains
# This script sets up nginx to serve the built application from dist folder

set -e

PROJECT_ROOT="/var/www/Ai-Trading-Bots"
NGINX_SITE_CONFIG="/etc/nginx/sites-available/pablobots"
NGINX_SITE_ENABLED="/etc/nginx/sites-enabled/pablobots"

echo "🔧 Setting up Nginx configuration..."
echo "=================================="
echo ""

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then 
    echo "⚠️  This script needs to be run with sudo"
    echo "   Run: sudo bash $0"
    exit 1
fi

# Navigate to project directory
cd "$PROJECT_ROOT" || {
    echo "❌ Failed to navigate to $PROJECT_ROOT"
    exit 1
}

# Check if dist folder exists
if [ ! -d "dist" ]; then
    echo "❌ dist folder not found! Please run 'npm run build' first."
    exit 1
fi

# Create nginx site configuration
echo "📝 Creating nginx site configuration..."
cat > "$NGINX_SITE_CONFIG" << 'EOF'
server {
    listen 80;
    server_name pablobots.com www.pablobots.com 
                 pablobots.live www.pablobots.live 
                 pablobots.online www.pablobots.online
                 pablobots.net www.pablobots.net
                 localhost;

    root /var/www/Ai-Trading-Bots/dist;
    index index.html;

    # Health check (no proxy – if /health returns 200 but / returns 502, another config may be proxying /)
    location = /health {
        access_log off;
        return 200 'ok';
        add_header Content-Type text/plain;
    }

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Serve favicon directly
    location = /favicon.ico {
        try_files /favicon.svg =404;
        expires 1y;
        add_header Cache-Control "public, immutable, max-age=31536000";
        access_log off;
    }

    # Serve favicon.svg directly
    location = /favicon.svg {
        try_files $uri =404;
        expires 1y;
        add_header Cache-Control "public, immutable, max-age=31536000";
        access_log off;
    }

    # Serve static assets directly
    location /assets/ {
        try_files $uri =404;
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # SPA routing - serve index.html for all non-file routes (create-bot, futures-pairs-finder, etc.)
    location / {
        try_files $uri $uri/ @spa;
    }
    location @spa {
        rewrite ^ /index.html last;
    }

    # API proxy to Supabase Edge Functions
    location /api/ {
        proxy_pass https://dkawxgwdqiirgmmjbvhc.supabase.co/functions/v1/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Add API key from environment (if set)
        # proxy_set_header apikey $SUPABASE_ANON_KEY;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF

echo "✅ Nginx configuration created at $NGINX_SITE_CONFIG"
echo ""

# Remove default nginx site if it exists
if [ -L "/etc/nginx/sites-enabled/default" ]; then
    echo "🗑️  Removing default nginx site..."
    rm /etc/nginx/sites-enabled/default
    echo "✅ Default site removed"
    echo ""
fi

# Create symlink to enable site
echo "🔗 Creating symlink to enable site..."
if [ -L "$NGINX_SITE_ENABLED" ]; then
    echo "⚠️  Symlink already exists, removing old one..."
    rm "$NGINX_SITE_ENABLED"
fi
ln -s "$NGINX_SITE_CONFIG" "$NGINX_SITE_ENABLED"
echo "✅ Symlink created"
echo ""

# Test nginx configuration
echo "🧪 Testing nginx configuration..."
if nginx -t; then
    echo "✅ Nginx configuration is valid"
    echo ""
else
    echo "❌ Nginx configuration test failed!"
    exit 1
fi

# Reload or start nginx
echo "🔄 Reloading nginx..."
if systemctl reload nginx 2>/dev/null; then
    echo "✅ Nginx reloaded successfully"
    echo ""
elif ! systemctl is-active --quiet nginx; then
    echo "⚠️  Nginx was not running. Starting nginx..."
    if systemctl start nginx; then
        echo "✅ Nginx started successfully"
        echo ""
    else
        echo "❌ Failed to start nginx. Run: sudo systemctl start nginx"
        exit 1
    fi
else
    echo "❌ Failed to reload nginx"
    exit 1
fi

# Show nginx status
echo "📊 Nginx status:"
systemctl status nginx --no-pager -l || true
echo ""

echo "✅ Nginx configuration complete!"
echo ""
echo "🌐 Your site should now be accessible at:"
echo "   - http://pablobots.com"
echo "   - http://pablobots.live"
echo "   - http://pablobots.online"
echo "   - http://pablobots.net"
echo ""
echo "📝 Next steps:"
echo "   1. Configure DNS A records for all domains to point to your server IP"
echo "   2. Set up SSL certificates (Let's Encrypt recommended)"
echo "   3. Add domains to Supabase redirect URLs"
echo ""
echo "⚠️  If you saw 'conflicting server name' or nginx failed to start:"
echo "   - List enabled sites: ls -la /etc/nginx/sites-enabled/"
echo "   - Remove any duplicate pablobots config (keep only one): sudo rm /etc/nginx/sites-enabled/<other-file>"
echo "   - Start nginx: sudo systemctl start nginx"
echo "   - Enable nginx on boot: sudo systemctl enable nginx"
echo ""

