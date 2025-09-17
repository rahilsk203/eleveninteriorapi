@echo off
REM Eleven Interior API - Windows Setup Script

echo 🚀 Starting Eleven Interior API Setup...

REM Check if wrangler is installed
where wrangler >nul 2>nul
if errorlevel 1 (
    echo ❌ Wrangler CLI not found. Installing...
    npm install -g wrangler
)

REM Check if user is logged in to Cloudflare
echo 🔐 Checking Cloudflare authentication...
wrangler whoami >nul 2>nul
if errorlevel 1 (
    echo 📋 Please login to Cloudflare:
    wrangler auth login
)

REM Install dependencies
echo 📦 Installing dependencies...
npm install

REM Create D1 database
echo 🗄️ Creating D1 database...
wrangler d1 create eleven-interior-db > db_output.txt
for /f "tokens=2 delims=:" %%a in ('findstr "database_id" db_output.txt') do set DATABASE_ID=%%a
set DATABASE_ID=%DATABASE_ID:"=%
set DATABASE_ID=%DATABASE_ID:,=%
set DATABASE_ID=%DATABASE_ID: =%

if not "%DATABASE_ID%"=="" (
    echo ✅ Database created with ID: %DATABASE_ID%
    
    REM Update wrangler.toml with the database ID
    powershell -Command "(Get-Content wrangler.toml) -replace 'your-database-id-here', '%DATABASE_ID%' | Set-Content wrangler.toml"
    echo ✅ Updated wrangler.toml with database ID
) else (
    echo ❌ Failed to create database
    del db_output.txt
    pause
    exit /b 1
)

del db_output.txt

REM Run migrations
echo 🔄 Running database migrations...
wrangler d1 migrations apply eleven-interior-db --local
wrangler d1 migrations apply eleven-interior-db --remote
echo ✅ Database migrations completed

REM Setup environment variables
echo 🔧 Setting up environment variables...
echo Please enter your Cloudinary configuration:

set /p CLOUDINARY_CLOUD_NAME="Cloudinary Cloud Name: "
echo %CLOUDINARY_CLOUD_NAME% | wrangler secret put CLOUDINARY_CLOUD_NAME

set /p CLOUDINARY_API_KEY="Cloudinary API Key: "
echo %CLOUDINARY_API_KEY% | wrangler secret put CLOUDINARY_API_KEY

set /p CLOUDINARY_API_SECRET="Cloudinary API Secret: "
echo %CLOUDINARY_API_SECRET% | wrangler secret put CLOUDINARY_API_SECRET

REM Generate secure secrets
echo 🔐 Generating secure secrets...

REM Generate random JWT secret (32 bytes hex)
powershell -Command "[System.Web.Security.Membership]::GeneratePassword(64, 0)" > jwt_secret.txt
set /p JWT_SECRET=<jwt_secret.txt
echo %JWT_SECRET% | wrangler secret put JWT_SECRET
echo ✅ JWT Secret generated and set
del jwt_secret.txt

REM Generate random admin API key (16 bytes hex)
powershell -Command "[System.Web.Security.Membership]::GeneratePassword(32, 0)" > admin_key.txt
set /p ADMIN_API_KEY=<admin_key.txt
echo %ADMIN_API_KEY% | wrangler secret put ADMIN_API_KEY
echo ✅ Admin API Key generated: %ADMIN_API_KEY%
echo 💾 Please save this API key securely!
del admin_key.txt

REM Set environment
echo production | wrangler secret put ENVIRONMENT

REM Test deployment to staging
echo 🧪 Testing deployment to staging...
wrangler deploy --env staging

REM Create .env.example file for reference
echo # Cloudinary Configuration > .env.example
echo CLOUDINARY_CLOUD_NAME=your-cloud-name >> .env.example
echo CLOUDINARY_API_KEY=your-api-key >> .env.example
echo CLOUDINARY_API_SECRET=your-api-secret >> .env.example
echo. >> .env.example
echo # Security >> .env.example
echo JWT_SECRET=your-jwt-secret >> .env.example
echo ADMIN_API_KEY=your-admin-api-key >> .env.example
echo. >> .env.example
echo # Environment >> .env.example
echo ENVIRONMENT=production >> .env.example

echo ✅ Created .env.example file

REM Create API test script
echo @echo off > test-api.bat
echo REM Simple API test script >> test-api.bat
echo set API_URL=https://eleven-interior-api.workers.dev >> test-api.bat
echo set ADMIN_API_KEY=%ADMIN_API_KEY% >> test-api.bat
echo. >> test-api.bat
echo echo 🧪 Testing Eleven Interior API... >> test-api.bat
echo. >> test-api.bat
echo echo Testing health endpoint... >> test-api.bat
echo curl -s "%%API_URL%%/health" >> test-api.bat
echo. >> test-api.bat
echo echo Testing inquiry submission... >> test-api.bat
echo curl -s -X POST "%%API_URL%%/api/v1/inquiries" -H "Content-Type: application/json" -d "{\"name\": \"Test User\", \"email\": \"test@example.com\", \"phone\": \"1234567890\", \"location\": \"Test City\", \"project_description\": \"This is a test inquiry for API testing purposes.\"}" >> test-api.bat
echo. >> test-api.bat
echo echo Testing admin inquiries endpoint... >> test-api.bat
echo curl -s -H "X-API-Key: %%ADMIN_API_KEY%%" "%%API_URL%%/api/v1/admin/inquiries?limit=5" >> test-api.bat
echo. >> test-api.bat
echo echo ✅ API tests completed! >> test-api.bat

echo ✅ Created test-api.bat script

echo.
echo 🎉 Setup completed successfully!
echo.
echo 📋 Next steps:
echo 1. Update your domain configuration in wrangler.toml if needed
echo 2. Deploy to production: wrangler deploy --env production
echo 3. Test your API endpoints using the test-api.bat script
echo 4. Save your Admin API Key: %ADMIN_API_KEY%
echo.
echo 🔗 Useful commands:
echo - Start development: npm run dev
echo - Deploy to production: wrangler deploy --env production
echo - View database: npm run db:studio
echo - Test API: test-api.bat
echo.
echo ✨ Your Eleven Interior API is ready!

pause