#!/bin/bash

# Eleven Interior API - Quick Setup Script
# This script automates the initial setup process

set -e

echo "🚀 Starting Eleven Interior API Setup..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo -e "${RED}❌ Wrangler CLI not found. Installing...${NC}"
    npm install -g wrangler
fi

# Check if user is logged in to Cloudflare
echo -e "${YELLOW}🔐 Checking Cloudflare authentication...${NC}"
if ! wrangler whoami &> /dev/null; then
    echo -e "${YELLOW}📋 Please login to Cloudflare:${NC}"
    wrangler auth login
fi

# Install dependencies
echo -e "${YELLOW}📦 Installing dependencies...${NC}"
npm install

# Create D1 database
echo -e "${YELLOW}🗄️ Creating D1 database...${NC}"
DB_OUTPUT=$(wrangler d1 create eleven-interior-db)
DATABASE_ID=$(echo "$DB_OUTPUT" | grep "database_id" | cut -d'"' -f4)

if [ -n "$DATABASE_ID" ]; then
    echo -e "${GREEN}✅ Database created with ID: $DATABASE_ID${NC}"
    
    # Update wrangler.toml with the database ID
    sed -i.bak "s/your-database-id-here/$DATABASE_ID/g" wrangler.toml
    echo -e "${GREEN}✅ Updated wrangler.toml with database ID${NC}"
else
    echo -e "${RED}❌ Failed to create database${NC}"
    exit 1
fi

# Run migrations
echo -e "${YELLOW}🔄 Running database migrations...${NC}"
wrangler d1 migrations apply eleven-interior-db --local
wrangler d1 migrations apply eleven-interior-db --remote
echo -e "${GREEN}✅ Database migrations completed${NC}"

# Setup environment variables
echo -e "${YELLOW}🔧 Setting up environment variables...${NC}"

echo -e "${YELLOW}Please enter your Cloudinary configuration:${NC}"

read -p "Cloudinary Cloud Name: " CLOUDINARY_CLOUD_NAME
echo "$CLOUDINARY_CLOUD_NAME" | wrangler secret put CLOUDINARY_CLOUD_NAME

read -p "Cloudinary API Key: " CLOUDINARY_API_KEY
echo "$CLOUDINARY_API_KEY" | wrangler secret put CLOUDINARY_API_KEY

read -sp "Cloudinary API Secret: " CLOUDINARY_API_SECRET
echo
echo "$CLOUDINARY_API_SECRET" | wrangler secret put CLOUDINARY_API_SECRET

# Generate secure secrets
echo -e "${YELLOW}🔐 Generating secure secrets...${NC}"

JWT_SECRET=$(openssl rand -hex 32)
echo "$JWT_SECRET" | wrangler secret put JWT_SECRET
echo -e "${GREEN}✅ JWT Secret generated and set${NC}"

ADMIN_API_KEY=$(openssl rand -hex 16)
echo "$ADMIN_API_KEY" | wrangler secret put ADMIN_API_KEY
echo -e "${GREEN}✅ Admin API Key generated: $ADMIN_API_KEY${NC}"
echo -e "${YELLOW}💾 Please save this API key securely!${NC}"

# Set environment
echo "production" | wrangler secret put ENVIRONMENT

# Test deployment to staging
echo -e "${YELLOW}🧪 Testing deployment to staging...${NC}"
wrangler deploy --env staging

# Check if deployment was successful
STAGING_URL="https://eleven-interior-api.workers.dev"
if curl -s "$STAGING_URL/health" | grep -q "healthy"; then
    echo -e "${GREEN}✅ Staging deployment successful!${NC}"
    echo -e "${GREEN}🌐 Staging URL: $STAGING_URL${NC}"
else
    echo -e "${RED}❌ Staging deployment failed${NC}"
    exit 1
fi

# Create .env.example file for reference
cat > .env.example << EOL
# Cloudinary Configuration
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# Security
JWT_SECRET=your-jwt-secret
ADMIN_API_KEY=your-admin-api-key

# Environment
ENVIRONMENT=production
EOL

echo -e "${GREEN}✅ Created .env.example file${NC}"

# Create API test script
cat > test-api.sh << 'EOL'
#!/bin/bash

# Simple API test script
API_URL="https://eleven-interior-api.workers.dev"
ADMIN_API_KEY="your-admin-api-key-here"

echo "🧪 Testing Eleven Interior API..."

# Test health endpoint
echo "Testing health endpoint..."
curl -s "$API_URL/health" | jq '.'

# Test inquiry submission
echo "Testing inquiry submission..."
curl -s -X POST "$API_URL/api/v1/inquiries" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "phone": "1234567890",
    "location": "Test City",
    "project_description": "This is a test inquiry for API testing purposes."
  }' | jq '.'

# Test admin endpoint (requires API key)
echo "Testing admin inquiries endpoint..."
curl -s -H "X-API-Key: $ADMIN_API_KEY" \
  "$API_URL/api/v1/admin/inquiries?limit=5" | jq '.'

echo "✅ API tests completed!"
EOL

chmod +x test-api.sh
echo -e "${GREEN}✅ Created test-api.sh script${NC}"

echo -e "${GREEN}🎉 Setup completed successfully!${NC}"
echo
echo -e "${YELLOW}📋 Next steps:${NC}"
echo "1. Update your domain configuration in wrangler.toml if needed"
echo "2. Deploy to production: wrangler deploy --env production"
echo "3. Test your API endpoints using the test-api.sh script"
echo "4. Save your Admin API Key: $ADMIN_API_KEY"
echo
echo -e "${GREEN}🔗 Useful commands:${NC}"
echo "- Start development: npm run dev"
echo "- Deploy to production: wrangler deploy --env production"
echo "- View database: npm run db:studio"
echo "- Test API: ./test-api.sh"
echo
echo -e "${GREEN}✨ Your Eleven Interior API is ready!${NC}"