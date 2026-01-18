# Frontend Deployment Guide - Vercel

## Quick Start

### 1. Push to GitHub
```bash
git add .
git commit -m "Prepare frontend for Vercel deployment"
git push origin main
```

### 2. Deploy to Vercel

#### Option A: Vercel Dashboard (Recommended)
1. Go to [vercel.com](https://vercel.com) and sign in with GitHub
2. Click "New Project"
3. Import your GitHub repository: `hashmith-zluri/zluri_bootcamp`
4. Configure project:
   - **Framework Preset**: Vite
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`

#### Option B: Vercel CLI
```bash
npm i -g vercel
cd frontend
vercel --prod
```

### 3. Configure Environment Variables
In Vercel dashboard → Settings → Environment Variables, add:

```env
VITE_API_BASE_URL=https://zluribootcamp-production.up.railway.app/api/v1
```

### 4. Deploy
Vercel will automatically build and deploy your frontend.

## Testing Your Deployment

### 1. Get Your Vercel URL
Your app will be available at: `https://your-project-name.vercel.app`

### 2. Test Functionality
1. **Login Page**: Should load correctly
2. **Authentication**: Test login with your credentials
3. **API Connection**: Should connect to your Railway backend
4. **Database Operations**: Submit and approve queries

### 3. Check Network Tab
- Open browser DevTools → Network tab
- Verify API calls go to: `https://zluribootcamp-production.up.railway.app/api/v1`

## Troubleshooting

### Common Issues

#### 1. API Connection Errors
- Check `VITE_API_BASE_URL` environment variable
- Verify Railway backend is running
- Check CORS settings in backend

#### 2. Build Failures
- Check Node.js version compatibility
- Verify all dependencies are in package.json
- Check Vercel build logs

#### 3. Routing Issues (404 on refresh)
- Vercel.json handles SPA routing automatically
- Check if vercel.json is properly configured

### Environment Variables
- Use `VITE_` prefix for all frontend environment variables
- Set in Vercel dashboard, not in .env files
- Redeploy after changing environment variables

## Custom Domain (Optional)
1. In Vercel dashboard → Settings → Domains
2. Add your custom domain
3. Configure DNS records as shown

## Security Notes
- Environment variables are public in frontend builds
- Don't store sensitive data in frontend environment variables
- Use HTTPS (automatic on Vercel)
- Enable proper CORS on backend