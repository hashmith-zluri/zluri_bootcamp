# Railway Deployment Guide

## Quick Start

### 1. Push to GitHub
```bash
git add .
git commit -m "Prepare for Railway deployment"
git push origin main
```

### 2. Deploy to Railway
1. Go to [railway.app](https://railway.app) and sign in with GitHub
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose your repository
5. Railway will automatically detect it's a Node.js project

### 3. Configure Environment Variables
In Railway dashboard, go to your project → Variables tab and add these variables.

**Important**: Use your actual values from your local `.env` files:

```env
NODE_ENV=production
PORT=4000

# Database Configuration
DATABASE_URL=your-neon-postgresql-connection-string

# JWT Configuration  
JWT_SECRET=your-jwt-secret-key
JWT_EXPIRES_IN=1h

# MongoDB Atlas Configuration
ATLAS_MONGO1_URL=your-mongodb-atlas-connection-string
ATLAS_MONGO1_DATABASE=your-mongo-database-name

# Slack Configuration
SLACK_ENABLED=true
SLACK_BOT_TOKEN=your-slack-bot-token
SLACK_SIGNING_SECRET=your-slack-signing-secret
SLACK_APPROVAL_CHANNEL=your-slack-channel-id
SLACK_ADMIN_EMAIL=your-admin-email
```

### 4. Deploy
1. Railway will automatically build and deploy
2. You'll get a URL like `https://your-app-name.railway.app`
3. Test the health endpoint: `https://your-app-name.railway.app/health`

### 5. Update Frontend
Update your frontend to use the deployed backend URL:

```javascript
const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://your-app-name.railway.app/api/v1'
  : 'http://localhost:4000/api/v1';
```

## Troubleshooting

### Common Issues
- **Build Failures**: Check Railway logs for specific errors
- **Database Connection**: Verify your DATABASE_URL is correct
- **Environment Variables**: Ensure all required variables are set

### Getting Help
- Railway Docs: [docs.railway.app](https://docs.railway.app)
- Railway Discord: [railway.app/discord](https://railway.app/discord)

## Security Notes
- Never commit `.env` files to Git
- Use Railway's environment variables for all secrets
- Enable HTTPS (automatic on Railway)
- Monitor your application logs