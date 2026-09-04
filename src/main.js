const { invoke } = window.__TAURI__.core;

const emojis = [
  '😊','😂','🤣','😍','😘','😭','😢','😡',
  '🎉','🎊','🎈','🎁','💝','✨','⭐','🌟',
  '📝','📚','📖','✏️','📌','📎','🔖','📑',
  '💼','👔','🎓','🏆','🥇','🏅','⚡','🔥',
  '❤️','💙','💚','💛','🤍','🖤','💪','👍',
  '🚀','🎯','💡','🔔','📢','✅','❌','⏰',
  '🌈','☀️','🌙','⭐','💫','🌺','🌸','🌼',
  '🍎','🍊','🍋','🍌','🍇','🍓','🍕','🎂'
];

let currentFolder = null;
let currentNote = null;
let allFolders = [];
let allNotes = {};

window.addEventListener('load', async () => {
  initEmojiPicker();
  setupToolbar();
  setupButtons();
  await loadFolders();
});

function initEmojiPicker() {
  const grid = document.getElementById('emojiGrid');
  emojis.forEach(emoji => {
    const btn = document.createElement('button');
    btn.className = 'emoji-item';
    btn.textContent = emoji;
    btn.onclick = () => {
      insertAtCursor(emoji);
      document.getElementById('emojiPicker').style.display = 'none';
    };
    grid.appendChild(btn);
  });
}

function insertAtCursor(text) {
  const editor = document.getElementById('editor');
  editor.focus();
  const sel = window.getSelection();
  if (sel.rangeCount > 0) {
    const range = sel.getRangeAt(0);
    const node = document.createTextNode(text);
    range.insertNode(node);
    range.setStartAfter(node);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
  }
  saveCurrentNote();
}

function setupButtons() {
  document.getElementById('addFolderBtn').addEventListener('click', async () => {
    const name = await customPrompt('Nom du dossier :');
    if (!name || !name.trim()) return;
    await invoke('create_folder', { name: name.trim() });
    allFolders = await invoke('get_folders');
    renderFolders();
  });

  document.getElementById('emojiBtn').addEventListener('click', e => {
    e.stopPropagation();
    const picker = document.getElementById('emojiPicker');
    picker.style.display = picker.style.display === 'none' ? 'block' : 'none';
  });

  document.getElementById('tableBtn').addEventListener('click', async () => {
    const rows = parseInt(await customPrompt('Lignes :', '3')) || 3;
    const cols = parseInt(await customPrompt('Colonnes :', '3')) || 3;
    const table = document.createElement('table');
    for (let i = 0; i < rows; i++) {
      const tr = document.createElement('tr');
      for (let j = 0; j < cols; j++) {
        const cell = document.createElement(i === 0 ? 'th' : 'td');
        cell.contentEditable = 'true';
        cell.textContent = i === 0 ? `Colonne ${j+1}` : '';
        tr.appendChild(cell);
      }
      table.appendChild(tr);
    }
    const editor = document.getElementById('editor');
    const sel = window.getSelection();
    if (sel.rangeCount > 0) sel.getRangeAt(0).insertNode(table);
    else editor.appendChild(table);
    saveCurrentNote();
  });

  document.getElementById('clearBtn').addEventListener('click', async () => {
    const editor = document.getElementById('editor');
    editor.innerHTML = '<p>' + editor.textContent + '</p>';
    saveCurrentNote();
  });

  document.getElementById('editor').addEventListener('input', () => {
    updateStats();
    clearTimeout(window.saveTimeout);
    window.saveTimeout = setTimeout(saveCurrentNote, 1000);
  });

  document.addEventListener('click', e => {
    if (!e.target.closest('#emojiBtn') && !e.target.closest('#emojiPicker'))
      document.getElementById('emojiPicker').style.display = 'none';
  });

  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'n') { e.preventDefault(); createNote(); }
    if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); saveCurrentNote(); }
  });

  window.addEventListener('beforeunload', saveCurrentNote);
}

function setupToolbar() {
  document.getElementById('toolbar').addEventListener('click', e => {
    const btn = e.target.closest('[data-command]');
    if (!btn) return;
    const editor = document.getElementById('editor');
    editor.focus();
    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    const selected = range.toString();

    switch (btn.dataset.command) {
      case 'bold': { const s = document.createElement('strong'); s.textContent = selected || 'Gras'; range.deleteContents(); range.insertNode(s); break; }
      case 'italic': { const s = document.createElement('em'); s.textContent = selected || 'Italique'; range.deleteContents(); range.insertNode(s); break; }
      case 'bulletList': { const ul = document.createElement('ul'); const li = document.createElement('li'); li.textContent = selected || 'Item'; ul.appendChild(li); range.deleteContents(); range.insertNode(ul); break; }
      case 'orderedList': { const ol = document.createElement('ol'); const li = document.createElement('li'); li.textContent = selected || 'Item'; ol.appendChild(li); range.deleteContents(); range.insertNode(ol); break; }
      case 'heading1': { const h = document.createElement('h1'); h.textContent = selected || 'Titre'; range.deleteContents(); range.insertNode(h); break; }
      case 'heading2': { const h = document.createElement('h2'); h.textContent = selected || 'Titre'; range.deleteContents(); range.insertNode(h); break; }
    }
    saveCurrentNote();
  });
}

async function loadFolders() {
  try {
    allFolders = await invoke('get_folders');
    if (allFolders.length === 0) {
      await invoke('create_folder', { name: 'Notes' });
      allFolders = ['Notes'];
    }
    renderFolders();
    await selectFolder(allFolders[0]);
  } catch (e) {
    console.error('loadFolders error:', e);
  }
}

function renderFolders() {
  const list = document.getElementById('foldersList');
  list.innerHTML = '';
  allFolders.forEach(folder => {
    const el = document.createElement('div');
    el.className = `folder-item ${folder === currentFolder ? 'active' : ''}`;
    el.innerHTML = `
      <span class="folder-name">${folder}</span>
      <div class="folder-actions">
        <button class="btn-icon" onclick="event.stopPropagation(); deleteFolder('${folder}')" title="Supprimer">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </div>
    `;
    el.addEventListener('click', () => selectFolder(folder));
    list.appendChild(el);
  });
}

async function selectFolder(folder) {
  await saveCurrentNote();
  currentFolder = folder;
  currentNote = null;
  renderFolders();
  try {
    const notes = await invoke('get_notes', { folder });
    allNotes[folder] = notes;
    renderTabs();
    if (notes.length > 0) await selectNote(notes[0]);
    else clearEditor();
  } catch(e) {
    console.error('selectFolder error:', e);
  }
}

async function deleteFolder(folder) {
  if (!confirm(`Supprimer "${folder}" ? (doit être vide)`)) return;
  await invoke('delete_folder', { name: folder });
  allFolders = await invoke('get_folders');
  renderFolders();
  if (allFolders.length > 0) await selectFolder(allFolders[0]);
}

function renderTabs() {
  const bar = document.getElementById('tabsBar');
  bar.innerHTML = '';
  const notes = allNotes[currentFolder] || [];
  notes.forEach(note => {
    const tab = document.createElement('button');
    tab.className = `tab ${note === currentNote ? 'active' : ''}`;
    tab.innerHTML = `
      <span>${note}</span>
      <span class="close-tab" onclick="event.stopPropagation(); closeTab('${note}')">×</span>
    `;
    tab.addEventListener('click', () => selectNote(note));
    bar.appendChild(tab);
  });

  const addBtn = document.createElement('button');
  addBtn.className = 'btn-icon';
  addBtn.style.marginLeft = 'auto';
  addBtn.title = 'Nouvelle note';
  addBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;
  addBtn.addEventListener('click', createNote);
  bar.appendChild(addBtn);
}

async function selectNote(name) {
  await saveCurrentNote();
  currentNote = name;
  try {
    const content = await invoke('read_note', { folder: currentFolder, name });
    document.getElementById('editor').innerHTML = content;
    renderTabs();
    updateStats();
  } catch(e) {
    console.error('selectNote error:', e);
  }
}

async function createNote() {
  const name = await customPrompt('Nom de la note :');
  if (!name || !name.trim()) return;
  await invoke('save_note', { folder: currentFolder, name: name.trim(), content: '' });
  const notes = await invoke('get_notes', { folder: currentFolder });
  allNotes[currentFolder] = notes;
  renderTabs();
  await selectNote(name.trim());
}

function closeTab(name) {
  const notes = allNotes[currentFolder] || [];
  const idx = notes.indexOf(name);
  const next = notes[idx - 1] || notes[idx + 1];
  if (next) selectNote(next);
  else { clearEditor(); currentNote = null; renderTabs(); }
}

async function saveCurrentNote() {
  if (!currentNote || !currentFolder) return;
  const content = document.getElementById('editor').innerHTML;
  try {
    await invoke('save_note', { folder: currentFolder, name: currentNote, content });
  } catch(e) {
    console.error('save error:', e);
  }
}

function clearEditor() {
  document.getElementById('editor').innerHTML = '';
  updateStats();
}

function updateStats() {
  const text = document.getElementById('editor').textContent;
  const words = text.trim().split(/\s+/).filter(w => w.length > 0).length;
  document.getElementById('wordCount').textContent = `${words} mot${words > 1 ? 's' : ''}`;
  document.getElementById('charCount').textContent = `${text.length} caractère${text.length > 1 ? 's' : ''}`;
}

// Override prompt avec une boite custom
window.customPrompt = function(message, defaultValue = '') {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.3);z-index:9999;display:flex;align-items:center;justify-content:center;';
    overlay.innerHTML = `
      <div style="background:white;border-radius:12px;padding:24px;min-width:320px;box-shadow:0 20px 60px rgba(0,0,0,0.15);">
        <p style="font-family:Inter,sans-serif;font-size:15px;margin-bottom:16px;font-weight:500;">${message}</p>
        <input id="customInput" type="text" value="${defaultValue}" style="width:100%;padding:10px;border:1px solid #e5e5e5;border-radius:8px;font-size:14px;font-family:Inter,sans-serif;outline:none;margin-bottom:16px;">
        <div style="display:flex;gap:12px;justify-content:flex-end;">
          <button id="cancelBtn" style="padding:8px 16px;border:none;background:#f0f0f0;border-radius:8px;cursor:pointer;font-family:Inter,sans-serif;">Annuler</button>
          <button id="confirmBtn" style="padding:8px 16px;border:none;background:#007aff;color:white;border-radius:8px;cursor:pointer;font-family:Inter,sans-serif;">OK</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    const input = document.getElementById('customInput');
    input.focus();
    input.select();
    document.getElementById('confirmBtn').onclick = () => { document.body.removeChild(overlay); resolve(input.value); };
    document.getElementById('cancelBtn').onclick = () => { document.body.removeChild(overlay); resolve(null); };
    input.onkeydown = (e) => { if (e.key === 'Enter') document.getElementById('confirmBtn').click(); if (e.key === 'Escape') document.getElementById('cancelBtn').click(); };
  });
};
