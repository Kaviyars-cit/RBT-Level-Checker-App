# Enhancement Feature - Setup Guide

## Problem Identified
The enhancement feature was failing because:
1. The Supabase function `enhance-questions` was trying to use `LOVABLE_API_KEY` environment variable
2. This API key was not configured, causing all enhancement requests to fail

## Solution Implemented
✅ Created a backend endpoint (`/api/enhance-questions`) to handle question enhancements
✅ Updated frontend to call the backend endpoint instead of Supabase function
✅ Added dotenv support for environment variable management
✅ Created `.env` file in backend directory for configuration

## What You Need to Do Now

### Step 1: Get an API Key
You have two options:

**Option A: Use Lovable AI Gateway** (Recommended)
- Go to https://lovable.dev
- Sign up and get your API key
- Use this key as `LOVABLE_API_KEY`

**Option B: Use Alternative AI Gateway**
- Use any compatible AI gateway provider that supports the Gemini 2.5 Flash Lite model
- Get your API key from the provider

### Step 2: Configure the API Key
1. Open `backend/.env` file
2. Find this line: `LOVABLE_API_KEY=`
3. Paste your API key like this:
   ```
   LOVABLE_API_KEY=your_api_key_here
   ```
4. Save the file

### Step 3: Start the Backend Server
Open a terminal in the project directory:

Windows (Command Prompt):
```bash
cd backend
npm run dev
```

Windows (PowerShell):
```powershell
cd backend
npm run dev
```

The server should start on `http://localhost:5000`

### Step 4: Test the Enhancement
1. Ensure the backend server is running (from Step 3)
2. Go to the enhancement page in your browser at `http://localhost:8080/enhance`
3. Click "Enhance All Questions"
4. The enhancements should now work!

## Troubleshooting

### "Failed to enhance" error still appears
**Check 1**: Backend server is running
- Look for "🚀 Server started on http://localhost:5000" message in terminal

**Check 2**: API key is correctly configured
- Go to `backend/.env` and verify `LOVABLE_API_KEY` is set
- Make sure there are no extra spaces or special characters

**Check 3**: API key is valid
- If using Lovable API, make sure you have credits in your account
- If using another provider, verify the API key format is correct

**Check 4**: Network connectivity
- Make sure both frontend (port 8080) and backend (port 5000) are accessible
- Check browser console for network errors

### Backend crashes on startup
**Solution**: 
1. Make sure you ran `npm install` in the backend folder
2. Check that `.env` file is in the `backend` directory, not the root directory
3. Check the terminal output for specific error messages

### Still having issues?
1. Check the browser's Network tab (F12 → Network) to see what response the `/api/enhance-questions` endpoint is sending
2. Check the backend terminal for error messages
3. Look for "LOVABLE_API_KEY is not configured" message - if you see this, the API key is not set correctly

## Files Modified
- `backend/routes/aiRoutes.js` - Added `/api/enhance-questions` endpoint
- `src/pages/EnhancePage.tsx` - Updated to call backend instead of Supabase
- `backend/.env` - Created with configuration template
- `backend/server.js` - Added dotenv loading
- `backend/package.json` - Added dotenv dependency
