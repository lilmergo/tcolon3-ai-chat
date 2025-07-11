import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

// Initialize Firebase Admin SDK
const initializeFirebaseAdmin = () => {
  if (getApps().length === 0) {
    try {
      if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
        // Use service account key from environment variable
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
        initializeApp({
          credential: cert(serviceAccount),
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
          storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
        });
      } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        // Use service account key file path
        initializeApp({
          credential: cert(process.env.GOOGLE_APPLICATION_CREDENTIALS),
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
          storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
        });
      } else {
        // Fallback: Use application default credentials
        initializeApp({
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
          storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
        });
      }
    } catch (error) {
      console.error('Failed to initialize Firebase Admin SDK:', error);
      throw new Error('Firebase Admin SDK initialization failed');
    }
  }

  return getApps()[0];
};

// Initialize the admin app
const adminApp = initializeFirebaseAdmin();

// Export admin services
export const adminDb = getFirestore(adminApp);
export const adminStorage = getStorage(adminApp);

// Helper function to verify Firebase Auth token
export async function verifyAuthToken(token: string) {
  try {
    const { getAuth } = await import('firebase-admin/auth');
    const auth = getAuth(adminApp);
    const decodedToken = await auth.verifyIdToken(token);
    return decodedToken;
  } catch (error) {
    console.error('Error verifying auth token:', error);
    throw new Error('Invalid authentication token');
  }
}

// Helper function to get user from request headers
export async function getUserFromRequest(request: Request): Promise<{ uid: string; email?: string } | null> {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    const decodedToken = await verifyAuthToken(token);
    
    return {
      uid: decodedToken.uid,
      email: decodedToken.email,
    };
  } catch (error) {
    console.error('Error getting user from request:', error);
    return null;
  }
}
