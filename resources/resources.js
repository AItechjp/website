const SUPABASE_URL = 'https://dcvtubivtextycifngtk.supabase.co';
const PUBLISHABLE_KEY = 'sb_publishable_IcEN-3GgzcLCHiyNLyRiCQ_RpkAhCGI';
const ENDPOINT = `${SUPABASE_URL}/rest/v1/resource_usage_public?id=eq.1&select=id,database_bytes,storage_bytes,storage_objects,auth_users_total,auth_users_30d,public_rows_estimate,checked_at`;

const MB = 1024 * 1024;
const GB = 1024 * 1024 * 1024;
const LIMITS = {
  database: 500 * MB,
  storage: 1 * GB,
  mau: 50000,
};

const $ = (id) => document.getElementById(id);
const state = { timer: null, loading: false };

function formatBytes(bytes) {
  const n = Number(bytes || 0);
  if (n >= GB) return `${(n / GB).toFixed(n >= 10 * GB ? 1 : 2)} GB`;
  if (n >= MB) return `${(n / MB).toFixed(n >= 10 * MB ? 1 : 2)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${n} B`;
}

function percent(value, limit) {
  return Math.max(0, Math.min(100, (Number(value || 0) / limit) * 100));
}

function setProgress(barId, value, limit) {
  const p = percent(value, limit);
  const bar = $(barId);
  bar.style.width = `${Math.max(p, value > 0 ? 0.8 : 0)}%`;
  bar.classList.toggle('warn', p >= 70 && p < 90);
  bar.classList.toggle('danger', p >= 90);
  return p;
}

function formatPercent(p) {
  if (p === 0) return '0.00% used';
  if (p < 0.01) return '<0.01% used';
  return `${p.toFixed(p < 10 ? 2 : 1)}% used`;
}

function formatTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return new Intl.DateTimeFormat('ja-JP', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(d);
}

function setHealthy(ok, message) {
  $('healthOrb').className = `health-orb ${ok ? 'ok' : 'bad'}`;
  $('healthText').textContent = ok ? 'All live metrics online' : 'Snapshot unavailable';
  $('healthSub').textContent = message;
  $('snapshotStatus').innerHTML = `<span class="status-dot ${ok ? 'ok' : 'bad'}"></span>${ok ? 'ONLINE' : 'ERROR'}`;
}

function render(row) {
  const db = Number(row.database_bytes || 0);
  const storage = Number(row.storage_bytes || 0);
  const mau = Number(row.auth_users_30d || 0);

  $('dbValue').textContent = formatBytes(db);
  const dbP = setProgress('dbBar', db, LIMITS.database);
  $('dbPercent').textContent = formatPercent(dbP);
  $('dbRemain').textContent = `${formatBytes(Math.max(0, LIMITS.database - db))} remaining`;

  $('storageValue').textContent = formatBytes(storage);
  const storageP = setProgress('storageBar', storage, LIMITS.storage);
  $('storagePercent').textContent = formatPercent(storageP);
  $('storageRemain').textContent = `${formatBytes(Math.max(0, LIMITS.storage - storage))} remaining`;

  $('mauValue').textContent = mau.toLocaleString('ja-JP');
  const mauP = setProgress('mauBar', mau, LIMITS.mau);
  $('mauPercent').textContent = formatPercent(mauP);

  $('rowsValue').textContent = Number(row.public_rows_estimate || 0).toLocaleString('ja-JP');
  $('lastUpdated').textContent = formatTime(row.checked_at);
  $('liveCount').textContent = '4 / 8';
  setHealthy(true, `Snapshot ${formatTime(row.checked_at)}`);
}

async function refresh() {
  if (state.loading) return;
  state.loading = true;
  $('refreshBtn').classList.add('loading');
  $('refreshBtn').textContent = '更新中…';
  try {
    const res = await fetch(ENDPOINT, {
      headers: { apikey: PUBLISHABLE_KEY },
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const rows = await res.json();
    if (!Array.isArray(rows) || !rows[0]) throw new Error('No snapshot');
    render(rows[0]);
  } catch (error) {
    console.error(error);
    setHealthy(false, '自動更新に失敗しました');
  } finally {
    state.loading = false;
    $('refreshBtn').classList.remove('loading');
    $('refreshBtn').textContent = '今すぐ更新';
  }
}

function startAutoRefresh() {
  clearInterval(state.timer);
  state.timer = setInterval(() => {
    if (document.visibilityState === 'visible') refresh();
  }, 60000);
}

$('refreshBtn').addEventListener('click', refresh);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') refresh();
});

refresh();
startAutoRefresh();
