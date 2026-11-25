const env = import.meta.env || {};

export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

/** True when all Firebase keys are present and Demo Mode isn't forced. */
export const hasFirebase =
  env.VITE_DEMO_MODE !== 'true' && Object.values(firebaseConfig).every(Boolean);

export const tmdbKey = env.VITE_TMDB_API_KEY || '';
/** True when a TMDB key is present. Without it, browsing uses the built-in demo catalog. */
export const hasTmdb = Boolean(tmdbKey);

export const PROFILE_IDS = ['parent', 'kid1', 'kid2'];

export const DEFAULT_PROFILES = [
  { id: 'parent', name: 'Parent', avatar: 'director' },
  { id: 'kid1', name: 'Kid 1', avatar: 'popcorn' },
  { id: 'kid2', name: 'Kid 2', avatar: 'clapper' },
];

export const CERTS = ['G', 'PG', 'PG-13'];
