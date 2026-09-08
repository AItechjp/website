(() => {
  'use strict';

  const STORAGE_KEY = 'webdesk.todo.v1';
  const $ = (id) => document.getElementById(id);
  const els = {
    form: $('todoForm'), title: $('todoTitle'), note: $('todoNote'), category: $('todoCategory'), priority: $('todoPriority'), due: $('todoDue'),
    list: $('todoList'), empty: $('todoEmpty'), search: $('todoSearch'), tabs: $('filterTabs'),
    total: $('statTotal'), open: $('statOpen'), today: $('statToday'), done: $('statDone'),
    exportBtn: $('exportBtn'), importInput: $('importInput'), clearDone: $('clearDoneBtn'),
    dialog: $('editDialog'), editForm: $('editForm'), editId: $('editId'), editTitle: $('editTitle'), editNote: $('editNote'), editCategory: $('editCategory'), editPriority: $('editPriority'), editDue: $('editDue'), cancelEdit: $('cancelEdit')
  };

  let tasks = loadTasks();
  let filter = 'all';

  function loadTasks() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      if (!Array.isArray(raw)) return [];
      return raw.filter(validTask).slice(0, 2000);
    } catch { return []; }
  }

  function validTask(t) {
    return t && typeof t.id === 'string' && typeof t.title === 'string' && typeof t.done === 'boolean';
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }

  function uid() {
    return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  function esc(value = '') {
    return String(value).replace(/[&<>'"]/g, (ch) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[ch]));
  }

  function localInputToIso(value) {
    if (!value) return '';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toISOString();
  }

  function isoToLocalInput(value) {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function dayBounds(now = new Date()) {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(start); end.setDate(end.getDate() + 1);
    return [start.getTime(), end.getTime()];
  }

  function isToday(task) {
    if (!task.due || task.done) return false;
    const ms = Date.parse(task.due); if (!Number.isFinite(ms)) return false;
    const [start, end] = dayBounds();
    return ms >= start && ms < end;
  }

  function isOverdue(task) {
    if (!task.due || task.done) return false;
    const ms = Date.parse(task.due);
    return Number.isFinite(ms) && ms < Date.now();
  }

  function formatDue(value) {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat('ja-JP', { month:'numeric', day:'numeric', weekday:'short', hour:'2-digit', minute:'2-digit' }).format(d);
  }

  function priorityLabel(p) { return p === 'high' ? '高' : p === 'low' ? '低' : '中'; }

  function matches(task) {
    const q = els.search.value.trim().toLocaleLowerCase('ja');
    if (q && !`${task.title} ${task.note || ''} ${task.category || ''}`.toLocaleLowerCase('ja').includes(q)) return false;
    if (filter === 'active') return !task.done;
    if (filter === 'today') return isToday(task);
    if (filter === 'overdue') return isOverdue(task);
    if (filter === 'done') return task.done;
    return true;
  }

  function render() {
    const visible = tasks.filter(matches).sort((a, b) => {
      if (a.done !== b.done) return Number(a.done) - Number(b.done);
      if (a.due && b.due) return Date.parse(a.due) - Date.parse(b.due);
      if (a.due) return -1;
      if (b.due) return 1;
      return Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0);
    });

    els.list.innerHTML = visible.map((task) => {
      const overdue = isOverdue(task);
      const due = formatDue(task.due);
      return `<article class="todo-item${task.done ? ' done' : ''}" data-id="${esc(task.id)}">
        <button class="check-btn" data-action="toggle" type="button" aria-label="${task.done ? '未完了に戻す' : '完了にする'}">${task.done ? '✓' : ''}</button>
        <div>
          <div class="todo-title">${esc(task.title)}</div>
          ${task.note ? `<div class="todo-note">${esc(task.note)}</div>` : ''}
          <div class="todo-tags">
            <span class="todo-tag ${esc(task.priority || 'medium')}">優先度 ${priorityLabel(task.priority)}</span>
            ${task.category ? `<span class="todo-tag">${esc(task.category)}</span>` : ''}
            ${due ? `<span class="todo-tag${overdue ? ' high' : ''}">${overdue ? '期限切れ · ' : '期限 · '}${esc(due)}</span>` : ''}
          </div>
        </div>
        <div class="todo-actions"><button class="mini-btn" data-action="edit" type="button" title="編集" aria-label="編集">✎</button><button class="mini-btn" data-action="delete" type="button" title="削除" aria-label="削除">×</button></div>
      </article>`;
    }).join('');
    els.empty.hidden = visible.length !== 0;

    els.total.textContent = tasks.length;
    els.open.textContent = tasks.filter((t) => !t.done).length;
    els.today.textContent = tasks.filter(isToday).length;
    els.done.textContent = tasks.filter((t) => t.done).length;
  }

  function addTask(event) {
    event.preventDefault();
    const title = els.title.value.trim();
    if (!title) return;
    tasks.unshift({
      id: uid(), title, note: els.note.value.trim(), category: els.category.value.trim(), priority: els.priority.value,
      due: localInputToIso(els.due.value), done: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    });
    save(); els.form.reset(); els.priority.value = 'medium'; render(); els.title.focus();
  }

  function openEdit(task) {
    els.editId.value = task.id;
    els.editTitle.value = task.title;
    els.editNote.value = task.note || '';
    els.editCategory.value = task.category || '';
    els.editPriority.value = task.priority || 'medium';
    els.editDue.value = isoToLocalInput(task.due);
    els.dialog.showModal();
  }

  function handleListClick(event) {
    const button = event.target.closest('[data-action]');
    const item = event.target.closest('.todo-item');
    if (!button || !item) return;
    const index = tasks.findIndex((t) => t.id === item.dataset.id);
    if (index < 0) return;
    const action = button.dataset.action;
    if (action === 'toggle') {
      tasks[index].done = !tasks[index].done;
      tasks[index].updatedAt = new Date().toISOString();
      if (tasks[index].done) tasks[index].completedAt = new Date().toISOString(); else delete tasks[index].completedAt;
      save(); render();
    } else if (action === 'edit') {
      openEdit(tasks[index]);
    } else if (action === 'delete') {
      if (confirm(`「${tasks[index].title}」を削除しますか？`)) { tasks.splice(index, 1); save(); render(); }
    }
  }

  function saveEdit(event) {
    event.preventDefault();
    const index = tasks.findIndex((t) => t.id === els.editId.value);
    if (index < 0) return els.dialog.close();
    const title = els.editTitle.value.trim(); if (!title) return;
    Object.assign(tasks[index], { title, note: els.editNote.value.trim(), category: els.editCategory.value.trim(), priority: els.editPriority.value, due: localInputToIso(els.editDue.value), updatedAt: new Date().toISOString() });
    save(); els.dialog.close(); render();
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), tasks }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = `webdesk-todo-${new Date().toISOString().slice(0,10)}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  async function importJson(file) {
    if (!file) return;
    try {
      if (file.size > 2_000_000) throw new Error('ファイルが大きすぎます');
      const data = JSON.parse(await file.text());
      const incoming = Array.isArray(data) ? data : data.tasks;
      if (!Array.isArray(incoming)) throw new Error('Todo JSONではありません');
      const cleaned = incoming.filter(validTask).slice(0, 2000).map((t) => ({
        id: t.id || uid(), title: String(t.title).slice(0,120), note: String(t.note || '').slice(0,1000), category: String(t.category || '').slice(0,30),
        priority: ['high','medium','low'].includes(t.priority) ? t.priority : 'medium', due: t.due || '', done: Boolean(t.done), createdAt: t.createdAt || new Date().toISOString(), updatedAt: t.updatedAt || new Date().toISOString(), ...(t.completedAt ? { completedAt:t.completedAt } : {})
      }));
      if (!cleaned.length && incoming.length) throw new Error('有効なタスクがありません');
      if (confirm(`${cleaned.length}件を読み込み、現在のTodoを置き換えますか？`)) { tasks = cleaned; save(); render(); }
    } catch (error) { alert(`読み込みできませんでした：${error.message}`); }
    finally { els.importInput.value = ''; }
  }

  els.form.addEventListener('submit', addTask);
  els.list.addEventListener('click', handleListClick);
  els.search.addEventListener('input', render);
  els.tabs.addEventListener('click', (event) => {
    const button = event.target.closest('[data-filter]'); if (!button) return;
    filter = button.dataset.filter;
    els.tabs.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b === button)); render();
  });
  els.editForm.addEventListener('submit', saveEdit);
  els.cancelEdit.addEventListener('click', () => els.dialog.close());
  els.exportBtn.addEventListener('click', exportJson);
  els.importInput.addEventListener('change', () => importJson(els.importInput.files?.[0]));
  els.clearDone.addEventListener('click', () => {
    const count = tasks.filter((t) => t.done).length;
    if (count && confirm(`完了済み${count}件を削除しますか？`)) { tasks = tasks.filter((t) => !t.done); save(); render(); }
  });

  window.addEventListener('storage', (event) => { if (event.key === STORAGE_KEY) { tasks = loadTasks(); render(); } });
  render();
})();
