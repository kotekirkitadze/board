/* Contrib Board - a small vanilla-JS kanban for tracking issue work.
   State lives in localStorage; no build step, no dependencies. */

(function () {
  'use strict';

  const KEY = 'contrib-board:v1';
  const $  = (sel, root) => (root || document).querySelector(sel);

  const board    = $('#board');
  const countsEl = $('#counts');
  const searchEl = $('#search');
  const editor   = $('#editor');
  const form     = $('#editor-form');
  const toastEl  = $('#toast');

  let state = load();
  let query = '';
  let editingId = null;
  let dragId = null;
  let undoStack = [];

  /* ---------- state ---------- */

  function blankState() {
    return {
      owner: 'aivazashvili on drupal.org',
      synced: '2026-08-17',
      cards: SAMPLE_CARDS.map((c) => Object.assign({}, c)),
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return blankState();
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.cards)) return blankState();
      parsed.cards = parsed.cards.filter(isCard).map(normalize);
      return parsed;
    } catch (err) {
      console.warn('Could not read saved board, starting fresh.', err);
      return blankState();
    }
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (err) {
      toast('Could not save to localStorage');
      console.warn(err);
    }
  }

  function isCard(c) { return c && typeof c === 'object' && typeof c.title === 'string'; }

  /* map a saved card onto a column that still exists */
  function resolveColumn(id) {
    if (COLUMNS.some((col) => col.id === id)) return id;
    const alias = COLUMN_ALIASES[id];
    if (alias && COLUMNS.some((col) => col.id === alias)) return alias;
    return COLUMNS[0].id;
  }

  /* the issue field accepts a bare number or a pasted issue URL */
  function parseIssue(raw) {
    const s = str(raw).replace(/^#/, '');
    if (!s) return { issue: '', url: '' };
    if (/^(https?:\/\/|\/\/)/i.test(s) || /^[\w.-]+\.[a-z]{2,}\//i.test(s)) {
      const digits = s.match(/(\d{4,})\D*$/);
      return { issue: digits ? digits[1] : '', url: httpUrl(s) };
    }
    return { issue: s, url: '' };
  }

  /* only ever hand http(s) to an href */
  function httpUrl(raw) {
    const s = str(raw);
    if (!s) return '';
    if (/^https?:\/\//i.test(s)) return s;
    if (/^\/\//.test(s)) return 'https:' + s;
    if (/^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(s)) return 'https://' + s;
    return '';
  }

  /* the issue number links to the URL field and nothing else;
     with no URL it stays plain text */
  function issueHref(card) {
    return card.url;
  }

  function normalize(c) {
    const parsed = parseIssue(c.issue);
    return {
      id: c.id || uid(),
      column: resolveColumn(c.column),
      project: str(c.project),
      issue: parsed.issue,
      url: httpUrl(c.url) || parsed.url,
      role: str(c.role),
      title: str(c.title),
      flagText: str(c.flagText), flagTone: FLAG_COLORS[c.flagTone] ? c.flagTone : 'warn',
      last: str(c.last), next: str(c.next),
    };
  }

  function str(v) { return typeof v === 'string' ? v.trim() : ''; }
  function uid() { return 'c' + Math.random().toString(36).slice(2, 9); }

  function snapshot(label) {
    undoStack.push({ label: label, cards: JSON.parse(JSON.stringify(state.cards)) });
    if (undoStack.length > 30) undoStack.shift();
  }

  function undo() {
    const prev = undoStack.pop();
    if (!prev) return toast('Nothing to undo');
    state.cards = prev.cards;
    save();
    render();
    toast('Undid: ' + prev.label);
  }

  function cardsIn(colId) { return state.cards.filter((c) => c.column === colId); }
  function byId(id) { return state.cards.find((c) => c.id === id); }

  /* Rebuild the flat card list so it always reads column by column. */
  function reorder(colId, ids) {
    const kept = ids.map(byId).filter(Boolean);
    const rest = state.cards.filter((c) => c.column !== colId);
    const out = [];
    COLUMNS.forEach((col) => {
      if (col.id === colId) out.push.apply(out, kept);
      else out.push.apply(out, rest.filter((c) => c.column === col.id));
    });
    state.cards = out;
  }

  /* ---------- rendering ---------- */

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (ch) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
    ));
  }

  /* escape + highlight the active filter */
  function hl(s) {
    const safe = esc(s);
    if (!query) return safe;
    const rx = new RegExp('(' + query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig');
    return safe.replace(rx, '<mark>$1</mark>');
  }

  function matches(card) {
    if (!query) return true;
    const hay = [card.title, card.project, card.issue, card.url, card.role,
                 card.flagText, card.last, card.next]
      .join(' ').toLowerCase();
    return hay.indexOf(query.toLowerCase()) !== -1;
  }

  function cardEl(card) {
    const el = document.createElement('article');
    el.className = 'card';
    el.dataset.id = card.id;
    el.draggable = true;
    el.tabIndex = 0;
    el.setAttribute('role', 'button');
    el.setAttribute('aria-label', card.title);
    if (!matches(card)) el.classList.add('dim');

    let html = '';
    if (card.project || card.issue || card.role || card.url) {
      html += '<div class="card-top">';
      if (card.project) {
        html += '<span class="tag" style="--tag-h:' + tagHue(card.project) + '">' + hl(card.project) + '</span>';
      }
      if (card.issue || card.url) {
        const href = issueHref(card);
        const label = card.issue ? '#' + hl(card.issue) : 'link';
        html += href
          ? '<a class="issue" href="' + esc(href) + '" target="_blank" rel="noopener noreferrer" title="' +
            esc(href) + '">' + label + '</a>'
          : '<span class="issue">' + label + '</span>';
      }
      if (card.role) html += '<span class="role">' + hl(card.role) + '</span>';
      html += '</div>';
    }

    html += '<h3 class="card-title">' + hl(card.title) + '</h3>';

    if (card.flagText) {
      html += '<span class="flag" style="--flag-c:' + (FLAG_COLORS[card.flagTone] || FLAG_COLORS.warn) +
              '">' + hl(card.flagText) + '</span>';
    }

    const rows = [];
    if (card.last) rows.push(['LAST', card.last, '']);
    if (card.next) rows.push(['NEXT', card.next, ' next-t']);
    if (rows.length) {
      html += '<dl class="meta">' + rows.map((r) =>
        '<dt>' + hl(r[0]) + '</dt><dd class="' + r[2].trim() + '">' + hl(r[1]) + '</dd>'
      ).join('') + '</dl>';
    }

    el.innerHTML = html;
    return el;
  }

  /* stable, readable chip color per project name */
  const TAG_HUES = [205, 168, 142, 38, 330, 268, 16, 188, 96, 300];
  function tagHue(name) {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
    return TAG_HUES[h % TAG_HUES.length];
  }

  function columnEl(col, peak) {
    const list = cardsIn(col.id);
    const el = document.createElement('section');
    el.className = 'col';
    el.dataset.col = col.id;
    el.style.setProperty('--col-c', col.color);

    const head = document.createElement('div');
    head.className = 'col-head';
    head.innerHTML =
      '<span class="col-dot"></span>' +
      '<span class="col-name">' + esc(col.title) + '</span>' +
      '<span class="col-count">' + list.length + '</span>' +
      '<button class="col-add" type="button" title="Add card to ' + esc(col.title) + '">+</button>';
    head.querySelector('.col-add').addEventListener('click', () => openEditor(null, col.id));

    /* how full this column is next to the busiest one */
    const bar = document.createElement('div');
    bar.className = 'col-bar';
    bar.innerHTML = '<i style="width:' + (peak ? Math.round((list.length / peak) * 100) : 0) + '%"></i>';

    const body = document.createElement('div');
    body.className = 'col-body';
    body.dataset.col = col.id;

    if (!list.length) {
      const empty = document.createElement('div');
      empty.className = 'col-empty';
      empty.textContent = 'Nothing here - drop a card or press +';
      body.appendChild(empty);
    } else {
      list.forEach((c) => body.appendChild(cardEl(c)));
    }

    el.appendChild(head);
    el.appendChild(bar);
    el.appendChild(body);
    return el;
  }

  function render() {
    const scroll = board.scrollLeft;
    const peak = COLUMNS.reduce((m, col) => Math.max(m, cardsIn(col.id).length), 0);
    board.innerHTML = '';
    COLUMNS.forEach((col) => board.appendChild(columnEl(col, peak)));
    board.scrollLeft = scroll;
    renderCounts();
    fillProjectList();
  }

  function renderCounts() {
    countsEl.innerHTML = '';
    COLUMNS.forEach((col) => {
      const n = cardsIn(col.id).length;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = n ? '' : 'is-empty';
      b.style.setProperty('--dot', col.color);
      b.innerHTML = esc(col.name) + ' <b>' + n + '</b>';
      b.addEventListener('click', () => {
        const target = board.querySelector('[data-col="' + col.id + '"]');
        if (target) target.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
      });
      countsEl.appendChild(b);
    });
  }

  function fillProjectList() {
    const seen = [];
    state.cards.forEach((c) => { if (c.project && seen.indexOf(c.project) === -1) seen.push(c.project); });
    $('#projects').innerHTML = seen.map((p) => '<option value="' + esc(p) + '"></option>').join('');
  }

  function renderMeta() {
    $('#board-owner').textContent = state.owner || 'local board';
    $('#board-synced').textContent = state.synced || '—';
  }

  /* ---------- editor ---------- */

  function openEditor(id, columnId) {
    editingId = id || null;
    const card = id ? byId(id) : null;

    $('#f-column').innerHTML = COLUMNS
      .map((c) => '<option value="' + c.id + '">' + esc(c.title) + '</option>').join('');

    $('#editor-title').textContent = card ? 'Edit card' : 'New card';
    $('#btn-delete').hidden = !card;

    form.reset();
    const src = card || { column: columnId || COLUMNS[0].id, flagTone: 'warn' };
    ['title', 'project', 'issue', 'url', 'role', 'flagText', 'flagTone',
     'last', 'next', 'column'].forEach((name) => {
      if (form.elements[name]) form.elements[name].value = src[name] || '';
    });
    if (!src.flagTone) form.elements.flagTone.value = 'warn';
    form.elements.column.value = src.column || COLUMNS[0].id;

    showEditor();
    form.elements.title.focus();
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (typeof form.reportValidity === 'function' && !form.reportValidity()) return;

    const data = {};
    ['title', 'project', 'issue', 'url', 'role', 'flagText', 'flagTone',
     'last', 'next', 'column'].forEach((name) => {
      data[name] = form.elements[name].value.trim();
    });
    if (!data.title) return;

    snapshot(editingId ? 'edit card' : 'add card');

    let savedId;
    if (editingId) {
      const card = byId(editingId);
      const moved = card.column !== data.column;
      Object.assign(card, normalize(Object.assign({ id: card.id }, data)));
      savedId = card.id;
      if (moved) {
        // land it at the bottom of its new column
        reorder(card.column, cardsIn(card.column).map((c) => c.id)
          .filter((id) => id !== card.id).concat(card.id));
      }
      toast('Card updated');
    } else {
      const card = normalize(Object.assign({ id: uid() }, data));
      state.cards.push(card);
      reorder(card.column, cardsIn(card.column).map((c) => c.id));
      savedId = card.id;
      toast('Card added');
    }

    editingId = null;
    closeEditor();
    save();
    render();
    flash(savedId);
  });

  $('#btn-delete').addEventListener('click', () => {
    if (!editingId) return;
    const card = byId(editingId);
    if (!card || !confirm('Delete "' + card.title + '"?')) return;
    snapshot('delete card');
    state.cards = state.cards.filter((c) => c.id !== editingId);
    editingId = null;
    save();
    render();
    closeEditor();
    toast('Card deleted - Ctrl+Z to undo');
  });

  Array.prototype.forEach.call(document.querySelectorAll('[data-close]'), (b) => {
    b.addEventListener('click', () => closeEditor());
  });

  /* <dialog> support is not universal - without it the element renders inline,
     so fall back to an [open] attribute plus our own backdrop. */
  const nativeDialog = typeof editor.showModal === 'function';

  function showEditor() {
    if (nativeDialog) {
      if (!editor.open) editor.showModal();     // native ::backdrop covers the page
    } else {
      editor.setAttribute('open', '');
      document.body.classList.add('modal-open'); // our own backdrop instead
    }
  }

  function closeEditor() {
    editingId = null;
    if (nativeDialog && editor.open) editor.close();
    else editor.removeAttribute('open');
    document.body.classList.remove('modal-open');
  }

  function editorOpen() { return editor.hasAttribute('open') || editor.open === true; }

  function flash(id) {
    if (!id) return;
    const el = board.querySelector('.card[data-id="' + id + '"]');
    if (el) el.classList.add('flash');
  }

  /* ---------- card interaction ---------- */

  board.addEventListener('click', (e) => {
    if (e.target.closest('.issue')) return;          // let issue links open
    const card = e.target.closest('.card');
    if (card) openEditor(card.dataset.id);
  });

  board.addEventListener('keydown', (e) => {
    const card = e.target.closest('.card');
    if (!card) return;
    const id = card.dataset.id;

    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openEditor(id); return; }

    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      const c = byId(id);
      if (!c || !confirm('Delete "' + c.title + '"?')) return;
      snapshot('delete card');
      state.cards = state.cards.filter((x) => x.id !== id);
      save(); render();
      toast('Card deleted - Ctrl+Z to undo');
      return;
    }

    /* Ctrl/Cmd + arrows: move the card between or within columns */
    if (!(e.ctrlKey || e.metaKey)) return;
    const c = byId(id);
    if (!c) return;
    const colIndex = COLUMNS.findIndex((col) => col.id === c.column);

    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const nextIndex = colIndex + (e.key === 'ArrowRight' ? 1 : -1);
      if (nextIndex < 0 || nextIndex >= COLUMNS.length) return;
      snapshot('move card');
      c.column = COLUMNS[nextIndex].id;
      reorder(c.column, cardsIn(c.column).map((x) => x.id));
      save(); render(); refocus(id);
      toast('Moved to ' + COLUMNS[nextIndex].name);
    }

    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const ids = cardsIn(c.column).map((x) => x.id);
      const i = ids.indexOf(id);
      const j = i + (e.key === 'ArrowDown' ? 1 : -1);
      if (j < 0 || j >= ids.length) return;
      snapshot('reorder card');
      ids.splice(j, 0, ids.splice(i, 1)[0]);
      reorder(c.column, ids);
      save(); render(); refocus(id);
    }
  });

  function refocus(id) {
    const el = board.querySelector('.card[data-id="' + id + '"]');
    if (el) el.focus();
  }

  /* ---------- drag and drop ---------- */

  board.addEventListener('dragstart', (e) => {
    const card = e.target.closest('.card');
    if (!card) return;
    dragId = card.dataset.id;
    card.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', dragId);
  });

  board.addEventListener('dragend', () => {
    dragId = null;
    clearDropUi();
  });

  board.addEventListener('dragover', (e) => {
    const body = e.target.closest('.col-body');
    if (!body || !dragId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    Array.prototype.forEach.call(board.querySelectorAll('.col'), (c) => c.classList.remove('is-over'));
    body.closest('.col').classList.add('is-over');

    const marker = dropMarker();
    const after = cardAfter(body, e.clientY);
    if (after) body.insertBefore(marker, after);
    else body.appendChild(marker);
  });

  board.addEventListener('dragleave', (e) => {
    const col = e.target.closest('.col');
    if (col && !col.contains(e.relatedTarget)) col.classList.remove('is-over');
  });

  board.addEventListener('drop', (e) => {
    const body = e.target.closest('.col-body');
    if (!body || !dragId) return;
    e.preventDefault();

    const colId = body.dataset.col;
    const card = byId(dragId);
    if (!card) return;

    const ids = Array.prototype.map.call(body.children, (el) =>
      el.classList.contains('drop-line') ? '__here__' : el.dataset.id
    ).filter(Boolean);

    let target = ids.filter((id) => id !== dragId);
    const at = target.indexOf('__here__');
    target = target.filter((id) => id !== '__here__');
    target.splice(at === -1 ? target.length : at, 0, dragId);

    snapshot('move card');
    card.column = colId;
    reorder(colId, target);
    save();
    clearDropUi();
    render();
    refocus(dragId);
    dragId = null;
  });

  function dropMarker() {
    let m = board.querySelector('.drop-line');
    if (!m) { m = document.createElement('div'); m.className = 'drop-line'; }
    return m;
  }

  function clearDropUi() {
    const m = board.querySelector('.drop-line');
    if (m) m.remove();
    Array.prototype.forEach.call(board.querySelectorAll('.col'), (c) => c.classList.remove('is-over'));
    Array.prototype.forEach.call(board.querySelectorAll('.dragging'), (c) => c.classList.remove('dragging'));
  }

  /* which card should sit below the pointer */
  function cardAfter(body, y) {
    const cards = Array.prototype.filter.call(body.querySelectorAll('.card'), (c) => !c.classList.contains('dragging'));
    for (let i = 0; i < cards.length; i++) {
      const box = cards[i].getBoundingClientRect();
      if (y < box.top + box.height / 2) return cards[i];
    }
    return null;
  }

  /* ---------- toolbar ---------- */

  $('#btn-add').addEventListener('click', () => openEditor(null, COLUMNS[0].id));

  searchEl.addEventListener('input', () => { query = searchEl.value.trim(); render(); });

  const menuBtn = $('#btn-menu');
  const menuPop = $('#menu-pop');

  menuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = menuPop.hidden;
    menuPop.hidden = !open;
    menuBtn.setAttribute('aria-expanded', String(open));
  });

  document.addEventListener('click', () => {
    menuPop.hidden = true;
    menuBtn.setAttribute('aria-expanded', 'false');
  });

  menuPop.addEventListener('click', (e) => {
    const act = e.target.dataset.act;
    if (!act) return;
    menuPop.hidden = true;

    if (act === 'export') exportJson();
    if (act === 'import') $('#file-input').click();
    if (act === 'sync') {
      state.synced = new Date().toISOString().slice(0, 10);
      save(); renderMeta(); toast('Marked synced ' + state.synced);
    }
    if (act === 'reset') {
      if (!confirm('Replace the board with the sample cards?')) return;
      snapshot('reset board');
      state = blankState(); save(); renderMeta(); render();
      toast('Sample board restored');
    }
    if (act === 'clear') {
      if (!confirm('Delete every card on this board?')) return;
      snapshot('clear board');
      state.cards = []; save(); render();
      toast('Board cleared - Ctrl+Z to undo');
    }
  });

  function exportJson() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'contrib-board-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast('Exported JSON');
  }

  $('#file-input').addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        const cards = Array.isArray(parsed) ? parsed : parsed.cards;
        if (!Array.isArray(cards)) throw new Error('no cards array');
        snapshot('import board');
        state.cards = cards.filter(isCard).map(normalize);
        if (parsed.owner) state.owner = parsed.owner;
        if (parsed.synced) state.synced = parsed.synced;
        save(); renderMeta(); render();
        toast('Imported ' + state.cards.length + ' cards');
      } catch (err) {
        toast('That file is not a valid board export');
        console.warn(err);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  /* ---------- global keys ---------- */

  document.addEventListener('keydown', (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);

    if (e.key === '/' && !typing) { e.preventDefault(); searchEl.focus(); searchEl.select(); return; }
    if (e.key === 'n' && !typing && !e.ctrlKey && !e.metaKey) { e.preventDefault(); openEditor(null, COLUMNS[0].id); return; }
    if (e.key === 'Escape' && editorOpen()) { e.preventDefault(); closeEditor(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !editorOpen()) { e.preventDefault(); undo(); return; }
    if (e.key === 'Escape' && !editorOpen() && searchEl.value) {
      searchEl.value = ''; query = ''; render();
    }
  });

  editor.addEventListener('close', () => {
    editingId = null;
    document.body.classList.remove('modal-open');
  });

  /* click the backdrop to dismiss */
  editor.addEventListener('mousedown', (e) => { if (e.target === editor) closeEditor(); });

  /* ---------- toast ---------- */

  let toastTimer = null;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.hidden = true; }, 2200);
  }

  /* ---------- boot ---------- */

  renderMeta();
  render();
})();
