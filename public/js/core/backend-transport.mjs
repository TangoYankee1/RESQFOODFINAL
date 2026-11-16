// Provider-neutral callable transport. No production URL is enabled yet.
// The caller supplies Firebase auth and the existing emulator callable adapter.
export function createBackendTransport({ backendUrl = '', auth, localCall, fetchImpl = fetch, timeoutMs = 20000 }) {
  let base;
  if (backendUrl) {
    base = new URL(backendUrl);
    if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash) {
      throw new Error('Backend URL must be an HTTPS URL without credentials, query, or fragment');
    }
  }
  return async function call(name, data = {}) {
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(name)) throw new Error('Invalid operation name');
    if (!base) {
      if (!localCall) throw Object.assign(new Error('Backend is not configured'), { code: 'functions/unavailable' });
      return localCall(name, data);
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const token = auth.currentUser ? await auth.currentUser.getIdToken() : null;
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = 'Bearer ' + token;
      const url = new URL(base.href.replace(/\/$/, '') + '/api/' + name);
      const response = await fetchImpl(url.href, {
        method: 'POST', headers, body: JSON.stringify({ data }), signal: controller.signal,
        credentials: 'omit', redirect: 'error',
      });
      let body;
      try { body = await response.json(); } catch {
        throw Object.assign(new Error('Invalid backend response'), { code: 'functions/unavailable' });
      }
      if (!response.ok || body?.error) {
        const error = body?.error || {};
        const code = /^[a-z]+(?:-[a-z]+)*$/.test(error.code || '') ? error.code : 'internal';
        throw Object.assign(new Error(error.message || 'Backend request failed'), {
          code: 'functions/' + code, details: error.details,
        });
      }
      if (!body || !Object.hasOwn(body, 'data')) {
        throw Object.assign(new Error('Invalid backend response'), { code: 'functions/internal' });
      }
      return body.data;
    } catch (error) {
      if (error.code?.startsWith('functions/')) throw error;
      throw Object.assign(new Error(error.name === 'AbortError' ? 'Request timed out' : 'Cannot reach backend'), {
        code: error.name === 'AbortError' ? 'functions/deadline-exceeded' : 'functions/unavailable',
      });
    } finally { clearTimeout(timer); }
  };
}
