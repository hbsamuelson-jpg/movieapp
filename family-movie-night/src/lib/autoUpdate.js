// Auto-update: when you deploy a new build, every open copy of the app picks it up by itself.
//
// How: each build writes its id to /version.json. The app compares that file with its own id
//   - when it opens,
//   - every time it comes back to the foreground (phone unlocked, tab switched back),
//   - every 5 minutes while open.
// A newer id on open or on return reloads straight away. If it shows up while someone is
// using the app, it offers a one-tap update and applies it the next time the app is reopened.
// Ratings save the moment they are made, so a reload never loses anything.

/* global __BUILD_ID__ */
const CURRENT = __BUILD_ID__;
const RELOADED_FOR = 'fmn-reloaded-for';

export const buildLabel = new Date(Number(CURRENT)).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

async function latestBuild() {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}version.json?t=${Date.now()}`, { cache: 'no-store' });
    return res.ok ? String((await res.json()).build) : null;
  } catch {
    return null; // offline, or hosted somewhere without version.json: just carry on
  }
}

export function applyUpdate() {
  window.location.reload();
}

/** Starts watching. Calls onReady() when an update is waiting for a tap. Returns a stop function. */
export function watchForUpdates(onReady) {
  if (import.meta.env.DEV) return () => {};
  let newer = null;

  const check = async (mayReload) => {
    if (!newer) {
      const latest = await latestBuild();
      if (latest && latest !== CURRENT) newer = latest;
    }
    if (!newer) return;
    // Reload at most once per new build, so a stubborn cache can never cause a reload loop.
    let already = false;
    try { already = sessionStorage.getItem(RELOADED_FOR) === newer; } catch { /* no storage */ }
    if (mayReload && !already) {
      try { sessionStorage.setItem(RELOADED_FOR, newer); } catch { /* no storage */ }
      applyUpdate();
    } else {
      onReady();
    }
  };

  const onVisible = () => document.visibilityState === 'visible' && check(true);
  document.addEventListener('visibilitychange', onVisible);
  const timer = setInterval(() => check(false), 5 * 60 * 1000);
  check(true);
  return () => { document.removeEventListener('visibilitychange', onVisible); clearInterval(timer); };
}
