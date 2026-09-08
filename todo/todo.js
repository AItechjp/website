(() => {
  'use strict';

  const STORAGE_KEY = 'webdesk.todo.v1';
  const SETTINGS_KEY = 'webdesk.todo.settings.v1';
  const MAX_TASKS = 2000;
  const VALID_PRIORITIES = new Set(['high', 'medium', 'low']);
  const VALID_FILTERS = new Set(['all', 'active', 'today', 'overdue', 'done']);
  const VALID_SORTS = new Set(['smart', 'due', 'newest', 'oldest']);
  const $ = (id) => document.getElementById(id);

  const els = {
    form: $('todoForm'), title: $('todoTitle'), note: $('todoNote'), category: $('todoCategory'), priority: $('todoPriority'), due: $('todoDue'), options: $('taskOptions'),
    list: $('todoList'), empty: $('todoEmpty'), emptyTitle: $('emptyTitle'), emptyText: $('emptyText'), search: $('todoSearch'), tabs: $('filterTabs'), sort: $('sortSelect'),
    total: $('statTotal'), open: $('statOpen'), today: $('statToday'), done: $('statDone'),
    countAll: $('countAll'), countActive: $('countActive'), countToday: $('countToday'), countOverdue: $('countOverdue'), countDone: $('countDone'),
    exportBtn: $('exportBtn'), importInput: $('importInput'), clearDone: $('clearDoneBtn'), saveState: $('saveState'), toast: $('toast'),
    dialog: $('editDialog'), editForm: $('editForm'), editId: $('editId'), editTitle: $('editTitle'), editNote: $('editNote'), editCategory: $('editCategory'), editPriority: $('editPriority'), editDue: $('editDue'), cancelEdit: $('cancelEdit'), closeEdit: $('closeEdit')
  };

  let tasks = loadTasks();
  let settings = loadSettings();
  let filter = VALID_FILTERS.has(settings.filter) ? settings.filter : 'all';
  let sortMode = VALID_SORTS.has(settings.sort) ? settings.sort : 'smart';
  let toastTimer = 0;

  function uid() {
    if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
    return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }

  function safeString(value, max = 1000) {
    return typeof value === 'string' ? value.slice(0, max) : String(value ?? '').slice(0, max);
  }

  function safeIso(value) {
    if (!value) return '';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toISOString();
  }

  function normalizeTask(task, index = 0) {
    if (!task || typeof task !== 'object') return null;
    const title = safeString(task.title, 120).trim();
    if (!title) return null;
    const fallbackTime = new Date(Date.now() - index).toISOString();
    const createdAt = safeIso(task.createdAt) || fallbackTime;
    const updatedAt = safeIso(task.updatedAt) || createdAt;
    const done = Boolean(task.done);
    const completedAt = safeIso(task.completedAt);

    return {
      id: typeof task.id === 'string' && task.id.trim() ? task.id : uid(),
      title,
      note: safeString(task.note, 1000).trim(),
      category: safeString(task.category, 30).trim(),
      priority: VALID_PRIORITIES.has(task.priority) ? task.priority : 'medium',
      due: safeIso(task.due),
      done,
      createdAt,
      updatedAt,
      ...(done && completedAt ? { completedAt } : {})
    };
  }

  function dedupeTasks(items) {
    const seen = new Set();
    return items.filter((task) => {
      if (!task || seen.has(task.id)) return false;
      seen.add(task.id);
      return true;
    });
  }

  function loadTasks() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      if (!Array.isArray(parsed)) return [];
      return dedupeTasks(parsed.slice(0, MAX_TASKS).map(normalizeTask).filter(Boolean));
    } catch {
      return [];
    }
  }

  function loadSettings() {
    try {
      const parsed = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  function persistSettings() {
    settings = { filter, sort: sortMode };
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* non-critical */ }
  }

  function setSaveState(state, text) {
    els.saveState.classList.remove('saving', 'error');
    if (state) els.saveState.classList.add(state);
    els.saveState.lastElementChild.textContent = text;
  }

  function save() {
    setSaveState('saving', '保存中…');
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
      requestAnimationFrame(() => setSaveState('', 'この端末に保存'));
      return true;
    } catch (error) {
      console.error(error);
      setSaveState('error', '保存できません');
      showToast('ブラウザに保存できませんでした。空き容量やプライベートモードを確認してください。', true);
      return false;
    }
  }

  function showToast(message, isError = false) {
    clearTimeout(toastTimer);
    els.toast.textContent = message;
    els.toast.classList.toggle('error', isError);
    els.toast.classList.add('show');
    toastTimer = setTimeout(() => els.toast.classList.remove('show'), 2200);
  }

  function localInputToIso(value) {
    if (!value) return '';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toISOString();
  }

  function isoToLocalInput(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function dayBounds(now = new Date()) {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return [start.getTime(), end.getTime()];
  }

  function dueMs(task) {
    if (!task.due) return NaN;
    return Date.parse(task.due);
  }

  function isToday(task) {
    if (!task.due || task.done) return false;
    const ms = dueMs(task);
    if (!Number.isFinite(ms)) return false;
    const [start, end] = dayBounds();
    return ms >= start && ms < end;
  }

  function isOverdue(task) {
    if (!task.due || task.done) return false;
    const ms = dueMs(task);
    return Number.isFinite(ms) && ms < Date.now();
  }

  function formatDue(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit' }).format(date);
  }

  function priorityLabel(priority) {
    return priority === 'high' ? '高' : priority === 'low' ? '低' : '中';
  }

  function taskMatches(task) {
    const query = els.search.value.trim().toLocaleLowerCase('ja');
    if (query) {
      const haystack = `${task.title} ${task.note} ${task.category}`.toLocaleLowerCase('ja');
      if (!haystack.includes(query)) return false;
    }
    if (filter === 'active') return !task.done;
    if (filter === 'today') return isToday(task);
    if (filter === 'overdue') return isOverdue(task);
    if (filter === 'done') return task.done;
    return true;
  }

  function sortTasks(a, b) {
    const aCreated = Date.parse(a.createdAt) || 0;
    const bCreated = Date.parse(b.createdAt) || 0;
    const aDue = dueMs(a);
    const bDue = dueMs(b);

    if (sortMode === 'newest') return bCreated - aCreated;
    if (sortMode === 'oldest') return aCreated - bCreated;
    if (sortMode === 'due') {
      if (Number.isFinite(aDue) && Number.isFinite(bDue)) return aDue - bDue;
      if (Number.isFinite(aDue)) return -1;
      if (Number.isFinite(bDue)) return 1;
      return bCreated - aCreated;
    }

    if (a.done !== b.done) return Number(a.done) - Number(b.done);
    const aBucket = isOverdue(a) ? 0 : isToday(a) ? 1 : Number.isFinite(aDue) ? 2 : 3;
    const bBucket = isOverdue(b) ? 0 : isToday(b) ? 1 : Number.isFinite(bDue) ? 2 : 3;
    if (aBucket !== bBucket) return aBucket - bBucket;
    if (Number.isFinite(aDue) && Number.isFinite(bDue) && aDue !== bDue) return aDue - bDue;
    return bCreated - aCreated;
  }

  function icon(name) {
    if (name === 'edit') return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg>';
    if (name === 'delete') return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m19 6-1 14H6L5 6"/><path d="M10 11v5M14 11v5"/></svg>';
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>';
  }

  function createTaskElement(task) {
    const article = document.createElement('article');
    article.className = `todo-item${task.done ? ' done' : ''}${isOverdue(task) ? ' is-overdue' : ''}${isToday(task) ? ' is-today' : ''}`;
    article.dataset.id = task.id;

    const check = document.createElement('button');
    check.type = 'button';
    check.className = 'todo-check';
    check.dataset.action = 'toggle';
    check.setAttribute('aria-label', task.done ? '未完了に戻す' : '完了にする');
    check.innerHTML = icon('check');

    const content = document.createElement('div');
    content.className = 'todo-content';
    const title = document.createElement('div');
    title.className = 'todo-title';
    title.textContent = task.title;
    content.appendChild(title);

    if (task.note) {
      const note = document.createElement('div');
      note.className = 'todo-note';
      note.textContent = task.note;
      content.appendChild(note);
    }

    const meta = document.createElement('div');
    meta.className = 'todo-meta';
    const priority = document.createElement('span');
    priority.className = `todo-pill priority-${task.priority}`;
    priority.textContent = `優先度 ${priorityLabel(task.priority)}`;
    meta.appendChild(priority);

    if (task.category) {
      const category = document.createElement('span');
      category.className = 'todo-pill';
      category.textContent = task.category;
      meta.appendChild(category);
    }

    if (task.due) {
      const due = document.createElement('span');
      const overdue = isOverdue(task);
      const today = isToday(task);
      due.className = `todo-pill${overdue ? ' overdue' : today ? ' today' : ''}`;
      due.textContent = `${overdue ? '期限切れ · ' : today ? '今日 · ' : '期限 · '}${formatDue(task.due)}`;
      meta.appendChild(due);
    }
    content.appendChild(meta);

    const actions = document.createElement('div');
    actions.className = 'todo-item-actions';
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'todo-action-btn';
    edit.dataset.action = 'edit';
    edit.setAttribute('aria-label', '編集');
    edit.innerHTML = icon('edit');
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'todo-action-btn delete';
    del.dataset.action = 'delete';
    del.setAttribute('aria-label', '削除');
    del.innerHTML = icon('delete');
    actions.append(edit, del);

    article.append(check, content, actions);
    return article;
  }

  function updateEmptyState(visibleCount) {
    const isSearch = Boolean(els.search.value.trim());
    els.empty.hidden = visibleCount > 0;
    if (visibleCount > 0) return;
    if (tasks.length === 0) {
      els.emptyTitle.textContent = 'まだタスクはありません';
      els.emptyText.textContent = '上の入力欄から、最初のタスクを追加できます。';
    } else if (isSearch) {
      els.emptyTitle.textContent = '検索結果がありません';
      els.emptyText.textContent = '別のキーワードで探してみてください。';
    } else {
      els.emptyTitle.textContent = 'この条件のタスクはありません';
      els.emptyText.textContent = '別のフィルターを選ぶと表示されます。';
    }
  }

  function updateCounts() {
    const total = tasks.length;
    const open = tasks.filter((task) => !task.done).length;
    const today = tasks.filter(isToday).length;
    const overdue = tasks.filter(isOverdue).length;
    const done = tasks.filter((task) => task.done).length;
    els.total.textContent = total;
    els.open.textContent = open;
    els.today.textContent = today;
    els.done.textContent = done;
    els.countAll.textContent = total;
    els.countActive.textContent = open;
    els.countToday.textContent = today;
    els.countOverdue.textContent = overdue;
    els.countDone.textContent = done;
    els.clearDone.disabled = done === 0;
  }

  function render() {
    const visible = tasks.filter(taskMatches).sort(sortTasks);
    const fragment = document.createDocumentFragment();
    visible.forEach((task) => fragment.appendChild(createTaskElement(task)));
    els.list.replaceChildren(fragment);
    updateCounts();
    updateEmptyState(visible.length);
  }

  function addTask(event) {
    event.preventDefault();
    const title = els.title.value.trim();
    if (!title) { els.title.focus(); return; }
    if (tasks.length >= MAX_TASKS) { showToast(`タスクは最大${MAX_TASKS}件までです。`, true); return; }
    const now = new Date().toISOString();
    const task = normalizeTask({ id: uid(), title, note: els.note.value, category: els.category.value, priority: els.priority.value, due: localInputToIso(els.due.value), done: false, createdAt: now, updatedAt: now });
    if (!task) return;
    tasks.unshift(task);
    if (save()) {
      els.form.reset();
      els.priority.value = 'medium';
      els.options.open = false;
      setActiveFilter('all');
      render();
      els.title.focus();
      showToast('タスクを追加しました');
    }
  }

  function openEdit(task) {
    els.editId.value = task.id;
    els.editTitle.value = task.title;
    els.editNote.value = task.note;
    els.editCategory.value = task.category;
    els.editPriority.value = task.priority;
    els.editDue.value = isoToLocalInput(task.due);
    if (typeof els.dialog.showModal === 'function') {
      if (!els.dialog.open) els.dialog.showModal();
    } else {
      els.dialog.setAttribute('open', '');
    }
    requestAnimationFrame(() => els.editTitle.focus());
  }

  function closeEdit() {
    if (typeof els.dialog.close === 'function' && els.dialog.open) els.dialog.close();
    else els.dialog.removeAttribute('open');
  }

  function handleListClick(event) {
    const button = event.target.closest('[data-action]');
    const item = event.target.closest('.todo-item');
    if (!button || !item) return;
    const index = tasks.findIndex((task) => task.id === item.dataset.id);
    if (index < 0) return;
    const task = tasks[index];

    if (button.dataset.action === 'toggle') {
      task.done = !task.done;
      task.updatedAt = new Date().toISOString();
      if (task.done) task.completedAt = new Date().toISOString();
      else delete task.completedAt;
      if (save()) { render(); showToast(task.done ? '完了にしました' : '未完了に戻しました'); }
      return;
    }

    if (button.dataset.action === 'edit') { openEdit(task); return; }

    if (button.dataset.action === 'delete') {
      if (!confirm(`「${task.title}」を削除しますか？`)) return;
      tasks.splice(index, 1);
      if (save()) { render(); showToast('タスクを削除しました'); }
    }
  }

  function saveEdit(event) {
    event.preventDefault();
    const index = tasks.findIndex((task) => task.id === els.editId.value);
    if (index < 0) { closeEdit(); return; }
    const title = els.editTitle.value.trim();
    if (!title) { els.editTitle.focus(); return; }
    const original = tasks[index];
    const updated = normalizeTask({ ...original, title, note: els.editNote.value, category: els.editCategory.value, priority: els.editPriority.value, due: localInputToIso(els.editDue.value), updatedAt: new Date().toISOString() });
    if (!updated) return;
    tasks[index] = updated;
    if (save()) { closeEdit(); render(); showToast('変更を保存しました'); }
  }

  function setActiveFilter(nextFilter) {
    filter = VALID_FILTERS.has(nextFilter) ? nextFilter : 'all';
    els.tabs.querySelectorAll('[data-filter]').forEach((button) => {
      const active = button.dataset.filter === filter;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', String(active));
      button.tabIndex = active ? 0 : -1;
    });
    persistSettings();
  }

  function exportJson() {
    try {
      const payload = { version: 1, exportedAt: new Date().toISOString(), tasks };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `webdesk-todo-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast('JSONを書き出しました');
    } catch {
      showToast('JSONを書き出せませんでした', true);
    }
  }

  async function importJson(file) {
    if (!file) return;
    try {
      if (file.size > 2_000_000) throw new Error('ファイルが大きすぎます');
      const data = JSON.parse(await file.text());
      const incoming = Array.isArray(data) ? data : data?.tasks;
      if (!Array.isArray(incoming)) throw new Error('Todo JSONではありません');
      const cleaned = dedupeTasks(incoming.slice(0, MAX_TASKS).map(normalizeTask).filter(Boolean));
      if (incoming.length && !cleaned.length) throw new Error('有効なタスクがありません');
      if (!confirm(`${cleaned.length}件を読み込み、現在のTodoを置き換えますか？`)) return;
      const previous = tasks;
      tasks = cleaned;
      if (!save()) { tasks = previous; return; }
      render();
      showToast(`${cleaned.length}件を読み込みました`);
    } catch (error) {
      showToast(`読み込みできませんでした：${error.message}`, true);
    } finally {
      els.importInput.value = '';
    }
  }

  function clearCompleted() {
    const count = tasks.filter((task) => task.done).length;
    if (!count) return;
    if (!confirm(`完了済み${count}件を削除しますか？`)) return;
    tasks = tasks.filter((task) => !task.done);
    if (save()) { render(); showToast(`完了済み${count}件を削除しました`); }
  }

  function bindEvents() {
    els.form.addEventListener('submit', addTask);
    els.list.addEventListener('click', handleListClick);
    els.search.addEventListener('input', render);
    els.tabs.addEventListener('click', (event) => {
      const button = event.target.closest('[data-filter]');
      if (!button) return;
      setActiveFilter(button.dataset.filter);
      render();
    });
    els.sort.addEventListener('change', () => {
      sortMode = VALID_SORTS.has(els.sort.value) ? els.sort.value : 'smart';
      persistSettings();
      render();
    });
    els.editForm.addEventListener('submit', saveEdit);
    els.cancelEdit.addEventListener('click', closeEdit);
    els.closeEdit.addEventListener('click', closeEdit);
    els.dialog.addEventListener('click', (event) => { if (event.target === els.dialog) closeEdit(); });
    els.exportBtn.addEventListener('click', exportJson);
    els.importInput.addEventListener('change', () => importJson(els.importInput.files?.[0]));
    els.clearDone.addEventListener('click', clearCompleted);
    window.addEventListener('storage', (event) => {
      if (event.key === STORAGE_KEY) {
        tasks = loadTasks();
        render();
        showToast('別タブの変更を反映しました');
      }
    });
  }

  function init() {
    setActiveFilter(filter);
    els.sort.value = sortMode;
    bindEvents();
    render();
  }

  init();
})();
