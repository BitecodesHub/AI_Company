#!/usr/bin/env node
/**
 * pnpm setup:check — validates a fresh setup and prints clear remediation.
 *
 * Dependency-free (Node built-ins only) so it runs before `pnpm install`
 * finishes wiring app deps. Checks: required env vars, DB + Redis reachability,
 * and the single AI provider (OpenRouter key OR local Ollama). Exits non-zero if
 * a REQUIRED check fails; warnings (optional services) do not fail the run.
 */
import net from 'node:net';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// ── Load .env (without overriding the real environment) ──────────────────────
function loadEnv() {
  const path = resolve(ROOT, '.env');
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let val = m[2];
    const q = val[0];
    if (q === '"' || q === "'") { const end = val.indexOf(q, 1); val = end === -1 ? val.slice(1) : val.slice(1, end); }
    else { const hash = val.search(/(?:^|\s)#/); if (hash !== -1) val = val.slice(0, hash); val = val.trim(); }
    if (process.env[m[1]] === undefined) process.env[m[1]] = val;
  }
}
loadEnv();

const results = [];
const ok = (name, detail) => results.push({ name, status: 'ok', detail });
const warn = (name, detail, fix) => results.push({ name, status: 'warn', detail, fix });
const fail = (name, detail, fix) => results.push({ name, status: 'fail', detail, fix });

function tcpCheck(host, port, timeoutMs = 2500) {
  return new Promise((res) => {
    const socket = new net.Socket();
    const done = (v) => { socket.destroy(); res(v); };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
    socket.connect(port, host);
  });
}

function parseHostPort(url, defaultPort) {
  try { const u = new URL(url); return { host: u.hostname, port: Number(u.port) || defaultPort }; }
  catch { return null; }
}

async function httpOk(url, timeoutMs = 3000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try { const r = await fetch(url, { signal: ctrl.signal }); return r.ok || r.status === 401 || r.status === 405; }
  catch { return false; }
  finally { clearTimeout(t); }
}

// ── 1. Required env vars ─────────────────────────────────────────────────────
const REQUIRED = ['DATABASE_URL', 'AUTH_SECRET', 'ENCRYPTION_KEY'];
for (const key of REQUIRED) {
  const v = process.env[key];
  if (!v || /CHANGE_ME|changeme|GENERATE/i.test(v)) {
    fail(`env ${key}`, v ? 'placeholder value' : 'missing', `Set ${key} in .env (see .env.example).`);
  } else ok(`env ${key}`);
}

// ── 2. Database ──────────────────────────────────────────────────────────────
const dbUrl = process.env.DATABASE_URL;
if (dbUrl) {
  const hp = parseHostPort(dbUrl, 5432);
  if (hp && (await tcpCheck(hp.host, hp.port))) ok('database', `${hp.host}:${hp.port} reachable`);
  else fail('database', `cannot reach ${hp?.host}:${hp?.port}`, 'Start Postgres (docker compose up postgres -d) and check DATABASE_URL.');
}

// ── 3. Redis (optional) ──────────────────────────────────────────────────────
const redisUrl = process.env.REDIS_URL;
if (!redisUrl) warn('redis', 'REDIS_URL not set', 'Set REDIS_URL to enable queues/rate-limit.');
else {
  const hp = parseHostPort(redisUrl, 6379);
  if (hp && (await tcpCheck(hp.host, hp.port))) ok('redis', `${hp.host}:${hp.port} reachable`);
  else warn('redis', `cannot reach ${hp?.host}:${hp?.port}`, 'Start Redis (docker compose up redis -d) — optional for core flows.');
}

// ── 4. AI provider (one path) ────────────────────────────────────────────────
const mode = process.env.AI_GATEWAY_MODE;
const provider = (process.env.AI_PROVIDER || 'openrouter').toLowerCase();
if (mode === 'mock') {
  ok('ai provider', 'AI_GATEWAY_MODE=mock (no live provider needed)');
} else if (provider === 'openrouter') {
  const key = process.env.OPENROUTER_API_KEY;
  if (key && !/CHANGE_ME/i.test(key)) ok('ai provider', 'openrouter key present');
  else fail('ai provider', 'AI_PROVIDER=openrouter but OPENROUTER_API_KEY missing', 'Set OPENROUTER_API_KEY, or set AI_GATEWAY_MODE=mock for offline.');
} else if (provider === 'ollama') {
  const base = (process.env.OLLAMA_BASE_URL || 'http://localhost:11434').replace(/\/$/, '');
  if (await httpOk(`${base}/api/tags`)) ok('ai provider', `ollama reachable at ${base}`);
  else fail('ai provider', `ollama not reachable at ${base}`, 'Run `ollama serve` and `ollama pull <DEFAULT_MODEL>`, or set AI_GATEWAY_MODE=mock.');
} else if (provider === 'litellm') {
  const base = (process.env.LITELLM_BASE_URL || 'http://localhost:4001').replace(/\/$/, '');
  if (await httpOk(`${base}/health`)) ok('ai provider', `litellm reachable at ${base}`);
  else warn('ai provider', `litellm not reachable at ${base}`, 'Start the LiteLLM container or switch AI_PROVIDER.');
}

// ── 5. Embeddings (informational) ────────────────────────────────────────────
const emb = (process.env.EMBEDDING_PROVIDER || 'ollama').toLowerCase();
if (emb === 'none') warn('embeddings', 'EMBEDDING_PROVIDER=none — knowledge/memory recall disabled');
else ok('embeddings', `${emb} / ${process.env.EMBEDDING_MODEL || '(default)'}`);

// ── Report ───────────────────────────────────────────────────────────────────
const icon = { ok: '✓', warn: '⚠', fail: '✗' };
let failed = 0;
console.log('\nBitecodes setup check\n─────────────────────');
for (const r of results) {
  if (r.status === 'fail') failed++;
  const line = `${icon[r.status]} ${r.name}${r.detail ? ` — ${r.detail}` : ''}`;
  console.log(line);
  if (r.fix && r.status !== 'ok') console.log(`    → ${r.fix}`);
}
console.log('─────────────────────');
if (failed > 0) {
  console.log(`\n${failed} required check(s) failed. Fix the items above, then re-run \`pnpm setup:check\`.\n`);
  process.exit(1);
}
console.log('\nAll required checks passed. You are ready to start the stack.\n');
