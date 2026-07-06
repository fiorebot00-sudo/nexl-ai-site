// nexl-ai-site worker: static assets + the Gravity Assist daily-challenge API.
// Assets are served for any path that matches a file; everything else lands here.
// API lives under /api/gravity/daily. Scores are public, stakes are low — the
// only guards are shape validation, one-best-per-tag, and a size cap.

const TAG_RE = /^[A-Z0-9]{3}$/;
const DAY_RE = /^\d{8}$/;
const MAX_ENTRIES = 500;
// History policy (Mike, 2026-07-06): each day is a NEW board — GET only ever
// serves TODAY, no public access to past days. Past boards are retained in KV
// indefinitely (no TTL) as a private archive; read them with:
//   npx wrangler kv key get "d:YYYYMMDD" --namespace-id 7b00460f13754478a0591768c9c64a84 --remote

const CORS = {
  'Access-Control-Allow-Origin': '*',            // dev builds run off the mini; scores are public
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

function utcDay(offsetDays) {
  const d = new Date(Date.now() + (offsetDays || 0) * 86400000);
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

async function daily(req, env, url) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  if (req.method === 'GET') {
    const day = utcDay();                        // today only — history is private
    const board = (await env.GA_DAILY.get('d:' + day, 'json')) || [];
    return json({ day, count: board.length, top: board.slice(0, 20) });
  }

  if (req.method === 'POST') {
    let b;
    try { b = await req.json(); } catch (e) { return json({ error: 'bad json' }, 400); }
    const day = String(b.day || '');
    const tag = String(b.tag || '').toUpperCase();
    const score = Math.floor(Number(b.score));
    if (!DAY_RE.test(day)) return json({ error: 'bad day' }, 400);
    // only today (or UTC-yesterday, for midnight stragglers) is writable
    if (day !== utcDay() && day !== utcDay(-1)) return json({ error: 'day closed' }, 400);
    if (!TAG_RE.test(tag)) return json({ error: 'bad tag' }, 400);
    if (!Number.isFinite(score) || score < 0 || score > 1e6) return json({ error: 'bad score' }, 400);

    const key = 'd:' + day;
    const board = (await env.GA_DAILY.get(key, 'json')) || [];
    const mine = board.find(e => e.tag === tag);
    if (mine) { if (score > mine.score) { mine.score = score; mine.t = Date.now(); } }
    else board.push({ tag, score, t: Date.now() });
    board.sort((a, z) => z.score - a.score || a.t - z.t);
    if (board.length > MAX_ENTRIES) board.length = MAX_ENTRIES;
    await env.GA_DAILY.put(key, JSON.stringify(board));   // no TTL: private archive keeps every day

    const rank = board.findIndex(e => e.tag === tag) + 1;
    return json({ day, rank: rank || null, count: board.length, top: board.slice(0, 20) });
  }

  return json({ error: 'method' }, 405);
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === '/api/gravity/daily') return daily(req, env, url);
    if (url.pathname.startsWith('/api/')) return json({ error: 'not found' }, 404);
    return env.ASSETS.fetch(req);
  },
};
