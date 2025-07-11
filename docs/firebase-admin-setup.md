# Firebase Admin SDK Setup

## Overview
The Firebase Admin SDK is required for server-side operations in the advanced chat features. This includes:
- Authenticating API requests
- Reading/writing to Firestore from server-side
- Managing user permissions
- Handling file uploads to Firebase Storage

## Setup Instructions

### Step 1: Generate Service Account Key

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project (`ai-chat-cloneathon`)
3. Click the gear icon → **Project Settings**
4. Go to the **Service Accounts** tab
5. Click **Generate New Private Key**
6. Click **Generate Key** to download the JSON file

### Step 2: Configure Environment Variables

You have two options for providing the service account credentials:

#### Option A: Environment Variable (Recommended for Production)
1. Open the downloaded JSON file
2. Copy the entire JSON content
3. Add it to your `.env.local` file:
```env
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"ai-chat-cloneathon",...}
```

#### Option B: File Path (Alternative)
1. Place the JSON file in your project root (e.g., `firebase-admin-key.json`)
2. Add the file path to your `.env.local`:
```env
GOOGLE_APPLICATION_CREDENTIALS=./firebase-admin-key.json
```
3. **Important**: Add the file to `.gitignore` to prevent committing secrets:
```gitignore
firebase-admin-key.json
*.json
```

### Step 3: Update .env.local

Make sure your `.env.local` file includes all required variables:

```env
# Firebase Client Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=ai-chat-cloneathon.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=ai-chat-cloneathon
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=ai-chat-cloneathon.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Firebase Admin SDK (choose one option)
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
# OR
# GOOGLE_APPLICATION_CREDENTIALS=./firebase-admin-key.json

# API Keys
OPENROUTER_API_KEY=your_openrouter_key
# OPENAI_API_KEY=your_openai_key  # No longer required - using OpenRouter for all LLM operations
SERPER_API_KEY=your_serper_key

# Application
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

### Step 4: Security Considerations

1. **Never commit service account keys to version control**
2. **Use environment variables in production**
3. **Rotate keys regularly**
4. **Limit service account permissions** to only what's needed

### Step 5: Verify Setup

1. Restart your development server: `npm run dev`
2. Try using the advanced chat features
3. Check the console for any authentication errors

## Troubleshooting

### Error: "Could not load the default credentials"
- Make sure you've set either `FIREBASE_SERVICE_ACCOUNT_KEY` or `GOOGLE_APPLICATION_CREDENTIALS`
- Verify the JSON format is valid
- Check that the file path is correct (if using file option)

### Error: "Missing or insufficient permissions"
- Verify your service account has the correct roles:
  - Firebase Admin SDK Administrator Service Agent
  - Cloud Datastore User
  - Storage Admin (for file uploads)

### Error: "Invalid service account"
- Make sure you downloaded the key from the correct Firebase project
- Verify the JSON content is complete and not truncated

## Production Deployment

For production deployment (e.g., Vercel):
1. Use the environment variable option (Option A)
2. Set `FIREBASE_SERVICE_ACCOUNT_KEY` in your deployment platform's environment variables
3. Never include the service account key in your codebase
4. Consider using platform-specific secret management solutions
