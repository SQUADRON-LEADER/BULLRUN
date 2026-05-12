# Vercel Deployment Guide for BULL RUN

## Environment Variables Setup

For the BULL RUN application to build and run on Vercel, you need to configure the following environment variables in your Vercel project dashboard:

### Required Variables:

1. **MONGODB_URI** (Required)
   - Production: MongoDB Atlas connection string (e.g., `mongodb+srv://username:password@cluster.mongodb.net/bullrun`)
   - Local: `mongodb://127.0.0.1:27017/signalist`

2. **BETTER_AUTH_SECRET** (Required)
   - A secure random string for authentication
   - Generate: `openssl rand -base64 32`

3. **BETTER_AUTH_URL** (Required)
   - Production: Your Vercel deployment URL (e.g., `https://bullrun.vercel.app`)
   - Local: `http://localhost:3000`

4. **FINNHUB_API_KEY** (Required for stock data)
   - Server-side API key from https://finnhub.io

5. **NEXT_PUBLIC_FINNHUB_API_KEY** (Optional)
   - Public API key for browser requests (fallback to FINNHUB_API_KEY)

6. **NEXT_PUBLIC_BASE_URL** (Optional)
   - Base URL for frontend (defaults to deployment URL)

### Optional Variables:

- **GEMINI_API_KEY**: For AI-powered features
- **NODEMAILER_EMAIL & NODEMAILER_PASSWORD**: For email notifications

## Setting Up Vercel Environment Variables

### Via Vercel Dashboard:

1. Go to your project: https://vercel.com/dashboard
2. Select your project "BULLRUN"
3. Navigate to "Settings" → "Environment Variables"
4. Add each variable with the appropriate value for `production`, `preview`, and `development` environments
5. Redeploy your application

### Via Vercel CLI:

```bash
vercel env add MONGODB_URI
vercel env add BETTER_AUTH_SECRET
vercel env add BETTER_AUTH_URL
# ... add other variables
vercel redeploy
```

## Local Development

For local development, create a `.env.local` file with your local development variables:

```bash
cp .env.example .env.local
```

Then fill in your values. **Never commit `.env.local` to git** - it's in `.gitignore` for security.

## Production MongoDB Setup

For production, use MongoDB Atlas:

1. Create a free cluster at https://www.mongodb.com/cloud/atlas
2. Create a database user
3. Whitelist Vercel IP ranges or use `0.0.0.0/0` for development
4. Copy the connection string: `mongodb+srv://username:password@cluster.mongodb.net/bullrun`
5. Add to Vercel as `MONGODB_URI` environment variable

## Troubleshooting Build Failures

### Error: "MONGODB_URI must be set within .env"

This means Vercel doesn't have the environment variable configured:
- ✅ Add `MONGODB_URI` to Vercel project settings
- ✅ Redeploy the application
- ❌ Don't try to use `.env.local` or `.env.production` files (Vercel ignores them)

### Error: "BETTER_AUTH_SECRET must be set"

Add `BETTER_AUTH_SECRET` to Vercel environment variables with a secure random value.

### Build works but runtime errors occur

Ensure all required variables are set for the `production` environment in Vercel dashboard (not just `preview`).

## Deployment Status

- Repository: https://github.com/SQUADRON-LEADER/BULLRUN
- Current commits: 25
- Next.js version: 15.5.2
- Build system: Vercel with Turbopack
