# Required Production Secrets for Deployment

## Critical Secrets (Required for Basic Functionality)

These secrets are **absolutely required** for the application to function properly in production:

### Security Secrets
- `PROD_JWT_SECRET` - Used for JWT token signing and verification
  - **Requirement**: Must be a strong, random string (minimum 32 characters)
  - **Example**: Generate with: `openssl rand -hex 32`
  - **Impact if missing**: Authentication will not work

- `PROD_SESSION_SECRET` - Used for session management and cookies
  - **Requirement**: Must be a strong, random string (minimum 32 characters)  
  - **Example**: Generate with: `openssl rand -hex 32`
  - **Impact if missing**: User sessions will not work properly

- `PROD_CSRF_SECRET` - Used for CSRF protection
  - **Requirement**: Must be a strong, random string (minimum 32 characters)
  - **Example**: Generate with: `openssl rand -hex 32`
  - **Impact if missing**: CSRF protection will be disabled

### Database Connection
- `PROD_DATABASE_URL` - PostgreSQL database connection string
  - **Requirement**: Valid PostgreSQL connection URL
  - **Example**: `postgresql://username:password@host:port/database`
  - **Impact if missing**: Application will not be able to store/retrieve data

## Recommended Secrets (For Full Functionality)

### Supabase Configuration
- `PROD_SUPABASE_URL` - Supabase project URL
- `PROD_SUPABASE_ANON_KEY` - Supabase anonymous key
- `PROD_SUPABASE_SERVICE_KEY` - Supabase service role key

### Frontend Configuration
- `PROD_FRONTEND_URL` - Production frontend URL
  - **Example**: `https://your-app.replit.app`

### Monitoring & Alerts
- `PROD_ALERT_EMAIL` - Email for security alerts
  - **Example**: `admin@yourcompany.com`

## How to Add Secrets to Replit Deployment

1. **Open your Replit project**
2. **Navigate to the Deployments pane** (rocket icon in sidebar)
3. **Select your deployment** or create a new one
4. **Go to Environment Variables section**
5. **Add each secret** with the exact name and value:
   ```
   PROD_JWT_SECRET = your-generated-jwt-secret-here
   PROD_SESSION_SECRET = your-generated-session-secret-here  
   PROD_CSRF_SECRET = your-generated-csrf-secret-here
   PROD_DATABASE_URL = your-postgresql-connection-string
   ```

## Secret Generation Commands

Use these commands to generate secure secrets:

```bash
# Generate JWT Secret
openssl rand -hex 32

# Generate Session Secret  
openssl rand -hex 32

# Generate CSRF Secret
openssl rand -hex 32
```

## Deployment Environment Detection

The application automatically detects production environment when `NODE_ENV=production`. Replit Deployments automatically set this environment variable.

## Graceful Degradation

With the updated configuration:
- ✅ **Application will start** even with missing secrets
- ⚠️ **Warnings will be logged** for missing secrets
- ❌ **Limited functionality** until secrets are properly configured
- 🔧 **Easy to fix** by adding secrets to Deployment settings

## Verification

After adding secrets, check the deployment logs for:
- ✅ "All secrets loaded successfully" 
- ⚠️ Any remaining warnings about missing optional secrets

## Troubleshooting

**If deployment still fails:**
1. Verify secret names match exactly (case-sensitive)
2. Ensure no extra spaces in secret values
3. Check deployment logs for specific error messages
4. Restart deployment after adding secrets

**Common Issues:**
- Wrong secret names (missing `PROD_` prefix)
- Weak secrets (too short or not random enough)
- Invalid database URL format
- Network connectivity to database