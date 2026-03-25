# 🚀 Deployment Guide

## Table of Contents
- [Local Development](#local-development)
- [Deploy to Vercel](#deploy-to-vercel)
- [Environment Variables](#environment-variables)
- [Performance Optimization](#performance-optimization)
- [Monitoring & Analytics](#monitoring--analytics)
- [Troubleshooting](#troubleshooting)

---

## Local Development

### Prerequisites
- Node.js 18 or higher
- npm, pnpm, or yarn
- Git

### Setup

```bash
# Clone and install
git clone <your-repo-url>
cd figma-markdown-app
npm install

# Create environment file
cp .env.example .env.local

# Start development server
npm run dev
```

The app will be available at `http://localhost:3000`

### Development Commands

```bash
# Start dev server with hot reload
npm run dev

# Type check TypeScript
npm run type-check

# Run linter
npm run lint

# Build for production
npm run build

# Start production server locally
npm start
```

---

## Deploy to Vercel

Vercel is the **recommended platform** for this Next.js app. Deployment takes <2 minutes.

### Option 1: Connect Git Repository (Recommended)

1. Push your code to GitHub/GitLab/Bitbucket
2. Go to [vercel.com](https://vercel.com/new)
3. Click **"New Project"** → **"Import Git Repository"**
4. Select your repository
5. Vercel auto-detects Next.js and configures build settings
6. Click **"Deploy"**

**Automatic deployments:**
- Every push to `main` branch auto-deploys to production
- Pull requests get preview deployments
- Rollbacks are one-click

### Option 2: Vercel CLI

```bash
# Install Vercel CLI globally
npm i -g vercel

# Deploy from project directory
vercel

# Production deployment
vercel --prod

# View deployments
vercel list

# Promote preview to production
vercel promote <deployment-url>
```

### Option 3: Docker / Custom Server

```bash
# Build Docker image
docker build -t figma-markdown-app .

# Run container
docker run -p 3000:3000 figma-markdown-app

# Custom server (Express, etc.)
npm run build
NODE_ENV=production npm start
```

---

## Environment Variables

### Required Variables

Create `.env.local` (for local development) or add to Vercel dashboard:

```bash
# Figma API (Optional - users can provide their own token in UI)
FIGMA_API_TOKEN=your_token_here

# Deployment environment
NODE_ENV=production
```

### Vercel Environment Setup

1. Go to your Vercel project settings
2. Navigate to **Settings** → **Environment Variables**
3. Add variables for each environment:
   - **Production** (main branch)
   - **Preview** (pull requests)
   - **Development** (local)

Example:

```
FIGMA_API_TOKEN = figd_xxxxxxxxxx (Production)
NODE_ENV = production
```

### Secure Token Handling

- ✅ Store tokens in Vercel dashboard, **never commit** to git
- ✅ Use `.env.local` for local development (add to `.gitignore`)
- ✅ Tokens in this app are **temporary** and **browser-only**
- ✅ No backend storage of tokens

---

## Performance Optimization

### Build Optimization

```javascript
// next.config.js - Already configured

{
  reactStrictMode: true,        // Catch errors in development
  swcMinify: true,              // SWC minifier for faster builds
  compress: true,               // Gzip compression
}
```

### Image Optimization

Figma thumbnails are fetched on-demand:
- Images are cached in browser
- Chrome DevTools → Network → See cache behavior
- Consider CDN for production (Vercel provides this)

### Code Splitting

Next.js automatically code-splits:
- Client component: `app/page.tsx`
- Each route gets its own bundle
- Dynamic imports for heavy libraries

### Caching Strategy

```
Static (HTML): 3600 seconds (Vercel smart cache)
API Responses: Browser cache only (Figma API)
Assets: Immutable (versioned filenames)
```

---

## Monitoring & Analytics

### Vercel Analytics

Vercel provides free Web Vitals monitoring:

1. Go to project **Dashboard** → **Analytics**
2. View:
   - First Contentful Paint (FCP)
   - Largest Contentful Paint (LCP)
   - Cumulative Layout Shift (CLS)
   - Real User Monitoring (RUM)

### Error Tracking

```bash
# Check build logs
vercel logs <deployment-url>

# Real-time logs
vercel logs --follow
```

### Custom Monitoring (Optional)

Add third-party monitoring:

```typescript
// app/page.tsx - Optional instrumentation

if (process.env.NODE_ENV === 'production') {
  // Send error to monitoring service
  // Example: Sentry, LogRocket, Datadog
}
```

---

## Troubleshooting

### Build Fails

**Error: "Module not found"**
```bash
# Clear cache and rebuild
rm -rf node_modules .next
npm install
npm run build
```

**Error: "TypeScript compilation error"**
```bash
npm run type-check    # Find type errors locally
npm run build         # Try building again
```

### Slow Deployment

- Vercel build cache expires after 7 days
- Large dependencies cause slow builds
- Solution: Check `node_modules` size
  ```bash
  npm ls --depth=0
  npm audit fix
  ```

### API Errors

**"Figma API error 401"**
- Token is invalid or expired
- Get new token from [Figma Settings](https://www.figma.com/settings/tokens)

**"CORS error from Figma"**
- Figma API allows browser requests with valid token
- Check browser DevTools → Console for detailed error

### Local Dev Issues

**Port 3000 already in use**
```bash
# Use different port
npm run dev -- -p 3001

# Kill existing process
lsof -ti:3000 | xargs kill -9
```

**Module cache not updating**
```bash
# Clear Next.js cache
rm -rf .next
npm run dev
```

---

## Advanced Deployment

### Custom Domain

1. Add domain to Vercel project
2. Vercel provides nameservers
3. Update domain registrar DNS settings
4. SSL certificate auto-provisioned (30 days)

### Regional Deployment

```json
// vercel.json
{
  "regions": ["iad1", "sfo1", "lhr1"],  // US, California, London
  "functions": {
    "api/**/*.ts": {
      "maxDuration": 60
    }
  }
}
```

### CI/CD Pipeline

GitHub Actions workflow included (`.github/workflows/ci-cd.yml`):
- Runs tests on PR
- Auto-deploys on merge to main
- Rollback capability

### Database Integration (Future)

If you add a backend:

```typescript
// Example with Supabase
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)
```

---

## Security Checklist

- ✅ HTTPS enabled (auto on Vercel)
- ✅ Environment variables not committed
- ✅ CSP headers configured
- ✅ CORS properly configured
- ✅ Input validation on all API calls
- ✅ No sensitive data in logs
- ✅ Rate limiting (if adding backend)
- ✅ Token rotation recommended every 90 days

---

## Support

- 📖 [Vercel Docs](https://vercel.com/docs)
- 🆘 [Vercel Support](https://vercel.com/support)
- 💬 [GitHub Issues](https://github.com/yourusername/figma-markdown-app/issues)

---

**Happy deploying! 🚀**
