import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
// Add required scopes
provider.addScope('https://www.googleapis.com/auth/spreadsheets');
provider.addScope('https://www.googleapis.com/auth/drive.file');

let isSigningIn = false;
let cachedAccessToken: string | null = null;

// Initialize auth state listener.
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      // Check for valid persisted token first if remember me was true
      const storedToken = localStorage.getItem('g_access_token');
      const expiresAtStr = localStorage.getItem('g_token_expires_at');
      const rememberMe = localStorage.getItem('g_remember_me') !== 'false'; // default true if not set

      if (storedToken && expiresAtStr && rememberMe) {
        const expiresAt = parseInt(expiresAtStr, 10);
        if (Date.now() < expiresAt) {
          cachedAccessToken = storedToken;
        } else {
          // Token expired
          cachedAccessToken = null;
          localStorage.removeItem('g_access_token');
          localStorage.removeItem('g_token_expires_at');
        }
      }

      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        // No valid token found and not in sign in process
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      localStorage.removeItem('g_access_token');
      localStorage.removeItem('g_token_expires_at');
      if (onAuthFailure) onAuthFailure();
    }
  });
};

// Must be called from a button click or user interaction
export const googleSignIn = async (rememberMe: boolean = true): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token from Firebase Auth');
    }

    cachedAccessToken = credential.accessToken;
    
    // Store token and expiration (1 hour lifespan for Google access token)
    const expiresAt = Date.now() + 3600 * 1000;
    
    localStorage.setItem('g_remember_me', rememberMe ? 'true' : 'false');
    if (rememberMe) {
      localStorage.setItem('g_access_token', cachedAccessToken);
      localStorage.setItem('g_token_expires_at', expiresAt.toString());
    } else {
      localStorage.removeItem('g_access_token');
      localStorage.removeItem('g_token_expires_at');
    }

    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const getTokenExpiresAt = (): number | null => {
  const expiresAtStr = localStorage.getItem('g_token_expires_at');
  if (expiresAtStr) {
    return parseInt(expiresAtStr, 10);
  }
  return null;
};

export const logout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
  localStorage.removeItem('g_access_token');
  localStorage.removeItem('g_token_expires_at');
  localStorage.removeItem('g_remember_me');
};
