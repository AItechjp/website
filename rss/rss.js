(() => {
  'use strict';
  const ENDPOINT = 'https://dcvtubivtextycifngtk.supabase.co/functions/v1/security-rss';
  const els = {
    list: document.querySelector('#feed-list'), empty: document.querySelector('#empty-state'), status: document.querySelector('#feed-status'),
    search: document.querySelector('#search'), refresh: document.querySelector('#refresh-btn'), unreadToggle: document.querySelector('#unread-toggle'),
    chips: document.querySelector('#source-chips'), sources: document.querySelector('#source-list'), count: document.querySelector('#stat-count'),
    unread: document.querySelector('#stat-unread'), sourceCount: document.querySelector('#stat-sources'), lastRefresh: document.querySelector('#stat-refresh'),
    generated: document.querySelector('#generated-at')
  };
  const readKey = 'webdesk:rss:read:v1';
  const state = { items: [], sources: [], sourceStates: [], source: 'all', query: '', unreadOnly: false, read: new Set(JSON.parse(sessionStorage.getItem(readKey) || '[]')) };

  const escapeHtml = (value='') => String(value).replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  const fmtTime = iso => new Intl.DateTimeFormat('ja-JP',{hour:'2-digit',minute:'2-digit'}).format(new Date(iso));
  const relative = iso => {
    const d = Date.now() - Date.parse(iso); const mins = Math.max(0, Math.floor(d/60000));
    if (mins < 1) return 'たった今'; if (mins < 60) return `${mins}分前`; return `${Math.floor(mins/60)}時間${mins%60}分前`;
  };
  const ttl = iso => {
    const d = Date.parse(iso) - Date.now(); if (d <= 0) return '期限切れ';
    const mins = Math.ceil(d/60000); return mins < 60 ? `あと${mins}分` : `あと${Math.floor(mins/60)}時間${mins%60}分`;
  };

  function persistRead(){ sessionStorage.setItem(readKey, JSON.stringify([...state.read].slice(-500))); }
  function filtered(){
    const q = state.query.trim().toLowerCase();
    return state.items.filter(item => {
      if (state.source !== 'all' && item.source_id !== state.source) return false;
      if (state.unreadOnly && state.read.has(item.id)) return false;
      if (q && !`${item.title} ${item.summary} ${item.source_name}`.toLowerCase().includes(q)) return false;
      return Date.parse(item.expires_at) > Date.now();
    });
  }
  function renderStats(){
    const live = state.items.filter(x => Date.parse(x.expires_at) > Date.now());
    els.count.textContent = live.length;
    els.unread.textContent = live.filter(x => !state.read.has(x.id)).length;
    els.sourceCount.textContent = state.sources.length || '6';
  }
  function renderChips(){
    const counts = new Map(); state.items.forEach(x => counts.set(x.source_id,(counts.get(x.source_id)||0)+1));
    const all = `<button class="chip ${state.source==='all'?'active':''}" data-source="all">すべて <b>${state.items.length}</b></button>`;
    els.chips.innerHTML = all + state.sources.map(s => `<button class="chip ${state.source===s.id?'active':''}" data-source="${escapeHtml(s.id)}">${escapeHtml(s.name)} <b>${counts.get(s.id)||0}</b></button>`).join('');
  }
  function renderSources(){
    const byId = new Map(state.sourceStates.map(x => [x.source_id,x]));
    els.sources.innerHTML = state.sources.map(s => {
      const x = byId.get(s.id); const ok = x?.last_ok_at && !x?.last_error;
      const checked = x?.last_checked_at ? relative(x.last_checked_at) : '未取得';
      return `<div class="source-row"><strong><span><i class="status-dot ${ok?'ok':x?.last_error?'bad':''}"></i>${escapeHtml(s.name)}</span><span>${escapeHtml(s.lang.toUpperCase())}</span></strong><span>${checked} / ${x?.item_count ?? 0}件</span>${x?.last_error?`<span class="source-error">${escapeHtml(x.last_error)}</span>`:''}</div>`;
    }).join('');
  }
  function renderFeed(){
    const items = filtered();
    els.list.innerHTML = items.map(item => {
      const read = state.read.has(item.id);
      return `<article class="feed-item ${read?'read':''}" data-id="${escapeHtml(item.id)}">
        <div class="feed-top"><div><div class="feed-source">${escapeHtml(item.source_name)}</div><h3><a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer" data-open>${escapeHtml(item.title)}</a></h3></div><span class="small">${fmtTime(item.published_at)}</span></div>
        ${item.summary?`<p>${escapeHtml(item.summary)}</p>`:''}
        <div class="feed-meta"><span>${relative(item.published_at)}</span><span class="ttl">${ttl(item.expires_at)}で削除</span><span>${read?'既読':'未読'}</span></div>
      </article>`;
    }).join('');
    els.empty.classList.toggle('hidden', items.length > 0);
    renderStats(); renderChips();
  }
  function setBusy(busy){ els.refresh.disabled = busy; els.refresh.textContent = busy ? '更新中…' : '更新'; }

  async function load(force=false){
    setBusy(true); els.status.textContent = force ? 'フィードを再取得しています…' : '最新情報を読み込んでいます…';
    try {
      const res = await fetch(`${ENDPOINT}${force?'?refresh=1':''}`, {cache:'no-store'});
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json(); if (!data.ok) throw new Error(data.detail || data.error || 'backend error');
      state.items = Array.isArray(data.items) ? data.items : [];
      state.sources = Array.isArray(data.sources) ? data.sources : [];
      state.sourceStates = Array.isArray(data.states) ? data.states : [];
      els.status.textContent = data.refreshed ? '外部RSSを取得して更新しました' : 'キャッシュ済みの最新情報を表示中';
      els.lastRefresh.textContent = data.generatedAt ? fmtTime(data.generatedAt) : '—';
      els.generated.textContent = data.generatedAt ? `応答 ${new Date(data.generatedAt).toLocaleString('ja-JP')}` : '—';
      renderSources(); renderFeed();
    } catch (err) {
      console.error(err); els.status.textContent = `取得エラー: ${err.message}`; els.list.innerHTML=''; els.empty.textContent='RSSサービスへ接続できませんでした。少し後に更新してください。'; els.empty.classList.remove('hidden');
    } finally { setBusy(false); }
  }

  els.search.addEventListener('input', e => { state.query = e.target.value; renderFeed(); });
  els.refresh.addEventListener('click', () => load(true));
  els.unreadToggle.addEventListener('click', () => { state.unreadOnly = !state.unreadOnly; els.unreadToggle.textContent = state.unreadOnly ? '未読のみ ✓' : '未読のみ'; renderFeed(); });
  els.chips.addEventListener('click', e => { const b=e.target.closest('[data-source]'); if(!b)return; state.source=b.dataset.source; renderFeed(); });
  els.list.addEventListener('click', e => { const link=e.target.closest('[data-open]'); if(!link)return; const item=e.target.closest('.feed-item'); if(item){ state.read.add(item.dataset.id); persistRead(); requestAnimationFrame(renderFeed); } });
  setInterval(() => { if (state.items.length) renderFeed(); }, 60000);
  setInterval(() => load(false), 5*60*1000);
  load(false);
})();
