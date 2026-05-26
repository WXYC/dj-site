(() => {
  const ENDPOINT_MATCH = '/flowsheet/djs-on-air';
  const PLACEHOLDER_NAME = '\u{1F9EA} fake-live (console)';
  const AUTH_SESSION = '/auth/get-session';
  const REDUCER_PATH = 'flowsheetApi';
  const QUERY_CACHE_KEY = 'whoIsLive(undefined)';
  const PATCH_ACTION = REDUCER_PATH + '/queries/queryResultPatched';

  if (window._unfakeLive) {
    console.warn('[fake-live] already installed; call window._unfakeLive() first');
    return 'already installed';
  }

  function findReduxStore() {
    let anyFiber = null;
    (function scanDom(el) {
      if (anyFiber) return;
      for (const k of Object.keys(el)) {
        if (k.startsWith('__reactFiber')) { anyFiber = el[k]; return; }
      }
      for (const c of el.children) { scanDom(c); if (anyFiber) return; }
    })(document.body);
    if (!anyFiber) return null;
    let root = anyFiber;
    while (root.return) root = root.return;
    const seen = new WeakSet();
    const stack = [root];
    while (stack.length) {
      const f = stack.pop();
      if (!f || seen.has(f)) continue;
      seen.add(f);
      const s = f.memoizedProps && f.memoizedProps.store;
      if (s && typeof s.dispatch === 'function' && typeof s.getState === 'function') return s;
      if (f.child) stack.push(f.child);
      if (f.sibling) stack.push(f.sibling);
    }
    return null;
  }

  const store = findReduxStore();
  if (!store) {
    console.warn('[fake-live] no Redux store found; aborting.');
    return 'no store';
  }
  window.__wxycStore = store;

  const originalFetch = window.fetch.bind(window);

  // SYNCHRONOUS cache injection — patches the query state directly. No network round-trip,
  // no OFF-AIR flash. Idempotent: only writes when the user is not already in the cache.
  function injectIntoCache(myId) {
    const entry = store.getState()[REDUCER_PATH].queries[QUERY_CACHE_KEY];
    const current = entry && entry.data;
    if (!current) return;
    const djs = Array.isArray(current.djs) ? current.djs : [];
    if (djs.some(d => d && d.id === myId)) return;
    const newDjs = [{ id: myId, dj_name: PLACEHOLDER_NAME }, ...djs];
    const newOnAir = newDjs.map(d => 'DJ ' + d.dj_name).join(', ');
    store.dispatch({
      type: PATCH_ACTION,
      payload: {
        queryCacheKey: QUERY_CACHE_KEY,
        patches: [
          { op: 'replace', path: ['djs'], value: newDjs },
          { op: 'replace', path: ['onAir'], value: newOnAir },
        ],
      },
    });
  }

  return fetch(AUTH_SESSION, { credentials: 'include' })
    .then(r => r.json())
    .then(session => {
      const myId = session && session.user && session.user.id;
      if (!myId) { console.warn('[fake-live] no user id'); return 'no user'; }

      // Patch fetch so any polling refetch arrives already-injected. RTK Query's
      // `_e` structural-equality short-circuit means subsequent identical responses
      // don't trigger re-renders — no flicker.
      window.fetch = async function patched(input, init) {
        const url = typeof input === 'string' ? input : (input && input.url) || '';
        const method = ((init && init.method) || (typeof input === 'object' && input && input.method) || 'GET').toUpperCase();
        const isWhoIsLive = url.indexOf(ENDPOINT_MATCH) !== -1 && method === 'GET';
        const res = await originalFetch(input, init);
        if (isWhoIsLive && res.ok) {
          const original = await res.clone().json().catch(() => null);
          const list = Array.isArray(original) ? original : [];
          if (!list.some(d => d && d.id === myId)) {
            const augmented = [{ id: myId, dj_name: PLACEHOLDER_NAME }, ...list];
            return new Response(JSON.stringify(augmented), {
              status: res.status,
              statusText: res.statusText,
              headers: res.headers,
            });
          }
        }
        return res;
      };

      // Defense in depth: any code path that mutates the cache to drop our user
      // (leaveShow optimistic update, race with an unpatched fetch, etc.) gets
      // re-corrected on the next store tick. The check is O(1) on the djs array.
      const unsubStore = store.subscribe(() => {
        const entry = store.getState()[REDUCER_PATH].queries[QUERY_CACHE_KEY];
        if (entry && entry.data && Array.isArray(entry.data.djs)
            && !entry.data.djs.some(d => d && d.id === myId)) {
          injectIntoCache(myId);
        }
      });

      window._unfakeLive = () => {
        window.fetch = originalFetch;
        unsubStore();
        delete window._unfakeLive;
        // Restore real state by invalidating WhoIsLive — next refetch uses the real fetch.
        store.dispatch({ type: REDUCER_PATH + '/invalidateTags', payload: ['WhoIsLive'] });
        console.log('[fake-live] uninstalled.');
      };

      // Immediate synchronous cache update — UI flips this tick.
      injectIntoCache(myId);
      // Also invalidate so the next poll round-trip also injects (defends against any timing edge case).
      store.dispatch({ type: REDUCER_PATH + '/invalidateTags', payload: ['WhoIsLive'] });

      console.log('[fake-live] installed for user ' + myId + ' (sync + reactive + intercept)');
      return 'installed';
    })
    .catch(err => { console.warn('[fake-live]', err); return 'err: ' + err.message; });
})()
