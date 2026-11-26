const env = import.meta.env || {};

export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

/** True when all Firebase keys are present. Without them, names and ratings stay on one device. */
export const hasFirebase =
  env.VITE_DEMO_MODE !== 'true' && Object.values(firebaseConfig).every(Boolean);

export const tmdbKey = env.VITE_TMDB_API_KEY || '';
/** True when a TMDB key is present. Without it, the app uses a built-in list of 150 movies with no posters. */
export const hasTmdb = Boolean(tmdbKey);

export const CERTS = ['G', 'PG', 'PG-13', 'R'];

export const pref = {
  get(key, fallback) {
    try { const v = localStorage.getItem(`fmn-${key}`); return v == null ? fallback : JSON.parse(v); } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(`fmn-${key}`, JSON.stringify(value)); } catch { /* fine without it */ }
  },
};
