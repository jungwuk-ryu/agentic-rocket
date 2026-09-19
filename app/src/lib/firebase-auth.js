import { getApps, initializeApp } from "firebase/app";
import {
  GoogleAuthProvider,
  getAuth,
  onIdTokenChanged,
  signInWithPopup,
  signOut,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBZvq0PG9caLE6xQoYUxWHvyJ5KhbTsk14",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "daytona-70675.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "daytona-70675",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "daytona-70675.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "703604626473",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:703604626473:web:e3abbfbbf1c5aa02d3b838",
};

const firebaseApp =
  getApps().find((app) => app.options.projectId === firebaseConfig.projectId) ||
  initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });

export function observeGoogleAuth(listener) {
  return onIdTokenChanged(auth, listener);
}

export function isGoogleUser(user) {
  return Boolean(user?.providerData?.some(({ providerId }) => providerId === "google.com"));
}

export async function currentFirebaseIdToken() {
  return auth.currentUser && isGoogleUser(auth.currentUser)
    ? auth.currentUser.getIdToken()
    : null;
}

async function authPayload(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || "The sign-in request could not be completed.");
    error.status = response.status;
    throw error;
  }
  return payload;
}

export async function restoreDemoAdministrator() {
  const response = await fetch("/api/auth/session", {
    credentials: "same-origin",
    cache: "no-store",
  });
  const payload = await authPayload(response);
  return payload.viewer?.authType === "demo" ? payload.viewer : null;
}

export async function signInWithDemoAdministrator(password) {
  const response = await fetch("/api/auth/demo", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ password }),
  });
  return (await authPayload(response)).viewer;
}

export async function signOutDemoAdministrator() {
  const response = await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "same-origin",
  });
  await authPayload(response);
}

export async function signInWithGoogle() {
  if (auth.currentUser && !isGoogleUser(auth.currentUser)) await signOut(auth);
  return signInWithPopup(auth, provider);
}

export async function signOutFromGoogle() {
  await signOut(auth);
}
