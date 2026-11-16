// Fetch-based gateway suitable for Workers. Domain handlers must be the guarded
// callable equivalents; never register exported *Handler helpers directly.
const httpStatus = {
  'invalid-argument': 400, unauthenticated: 401, 'permission-denied': 403,
  'not-found': 404, 'already-exists': 409, 'failed-precondition': 412,
  'resource-exhausted': 429, unavailable: 503, 'deadline-exceeded': 504, internal: 500,
};
export function createGateway({ handlers, verifyToken, allowedOrigins, maxBytes = 65536 }) {
  const registry = new Map(Object.entries(handlers));
  const origins = new Set(allowedOrigins);
  return async function handle(request) {
    const origin = request.headers.get('Origin');
    const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', Vary: 'Origin' };
    const reply = (status, body) => new Response(JSON.stringify(body), { status, headers });
    if (origin && !origins.has(origin)) return reply(403, { error: { code: 'permission-denied', message: 'Origin is not allowed' } });
    if (origin) headers['Access-Control-Allow-Origin'] = origin;
    const match = new URL(request.url).pathname.match(/^\/api\/([A-Za-z][A-Za-z0-9_]*)$/);
    if (!match || !registry.has(match[1])) return reply(404, { error: { code: 'not-found', message: 'Unknown operation' } });
    if (request.method === 'OPTIONS') {
      headers['Access-Control-Allow-Methods'] = 'POST';
      headers['Access-Control-Allow-Headers'] = 'Authorization, Content-Type';
      return new Response(null, { status: 204, headers });
    }
    if (request.method !== 'POST') return reply(405, { error: { code: 'invalid-argument', message: 'Use POST' } });
    try {
      const fail = (code, message) => { throw Object.assign(new Error(message), { code }); };
      if (request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/json') fail('invalid-argument', 'JSON required');
      if (Number(request.headers.get('Content-Length')) > maxBytes) fail('resource-exhausted', 'Request is too large');
      const reader = request.body?.getReader();
      let size = 0, text = '', decoder = new TextDecoder();
      if (reader) {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            size += value.byteLength;
            if (size > maxBytes) { await reader.cancel(); fail('resource-exhausted', 'Request is too large'); }
            text += decoder.decode(value, { stream: true });
          }
          text += decoder.decode();
        } finally { reader.releaseLock(); }
      }
      let body;
      try { body = JSON.parse(text); } catch { fail('invalid-argument', 'Invalid JSON'); }
      if (!body || typeof body !== 'object' || Array.isArray(body) || !Object.hasOwn(body, 'data') || Object.keys(body).some(k => k !== 'data')) fail('invalid-argument', 'Expected data envelope');
      const operation = registry.get(match[1]);
      let auth = null;
      const authorization = request.headers.get('Authorization');
      if (authorization) {
        const bearer = authorization.match(/^Bearer ([^\s]+)$/);
        if (!bearer) fail('unauthenticated', 'Invalid authorization');
        // verifyToken must cryptographically verify project, issuer, expiry,
        // signature and disabled/revoked account state; decoding is insufficient.
        auth = await verifyToken(bearer[1]);
        if (!auth?.uid || !auth.token) fail('unauthenticated', 'Invalid session');
      }
      if (!operation.public && !auth) fail('unauthenticated', 'Sign in first');
      const context = { auth, rawRequest: { ip: request.headers.get('CF-Connecting-IP'), headers: Object.fromEntries(request.headers) } };
      return reply(200, { data: await operation.run(body.data, context) });
    } catch (error) {
      const code = Object.hasOwn(httpStatus, error.code) ? error.code : 'internal';
      return reply(httpStatus[code], { error: { code, message: code === 'internal' ? 'Unable to complete request' : error.message } });
    }
  };
}
