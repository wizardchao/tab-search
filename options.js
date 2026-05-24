const DEFAULTS = {
  mode: 'doubleTapModifier',
  modifier: 'Alt',
  triggerKey: 'Space',
  doubleTapInterval: 400,
};

const MODIFIER_LABELS = {
  Alt: 'Option',
  Meta: 'Cmd',
  Control: 'Ctrl',
  Shift: 'Shift',
};

const TRIGGER_LABELS = {
  Space: 'Space',
  KeyJ: 'J',
  KeyK: 'K',
  KeyS: 'S',
  Slash: '/',
  Period: '.',
  Backquote: '`',
};

const modeRadios = document.querySelectorAll('input[name="mode"]');
const modeOptions = document.querySelectorAll('.mode-option');
const modifierEl = document.getElementById('modifier');
const triggerKeyEl = document.getElementById('triggerKey');
const triggerField = document.getElementById('trigger-field');
const intervalEl = document.getElementById('interval');
const previewEl = document.getElementById('preview');
const saveBtn = document.getElementById('save');
const resetBtn = document.getElementById('reset');
const toast = document.getElementById('toast');

function getMode() {
  return document.querySelector('input[name="mode"]:checked').value;
}

function updateUI() {
  const mode = getMode();
  triggerField.classList.toggle('hidden', mode === 'doubleTapModifier');
  modeOptions.forEach(el => {
    el.classList.toggle('active', el.dataset.mode === mode);
  });
  updatePreview();
}

function updatePreview() {
  const mod = MODIFIER_LABELS[modifierEl.value] || modifierEl.value;
  if (getMode() === 'doubleTapModifier') {
    previewEl.innerHTML = `<kbd>${mod}</kbd> <kbd>${mod}</kbd>`;
  } else {
    const key = TRIGGER_LABELS[triggerKeyEl.value] || triggerKeyEl.value;
    previewEl.innerHTML = `<kbd>${mod}</kbd> + <kbd>${key}</kbd> <kbd>${key}</kbd>`;
  }
}

function loadSettings() {
  chrome.storage.sync.get('shortcutSettings', (result) => {
    const s = result.shortcutSettings || DEFAULTS;
    document.querySelector(`input[name="mode"][value="${s.mode}"]`).checked = true;
    modifierEl.value = s.modifier;
    triggerKeyEl.value = s.triggerKey;
    intervalEl.value = s.doubleTapInterval;
    updateUI();
  });
}

function showToast(text) {
  toast.textContent = text;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2000);
}

modeOptions.forEach(el => {
  el.addEventListener('click', () => {
    el.querySelector('input[type="radio"]').checked = true;
    updateUI();
  });
});

modifierEl.addEventListener('change', updatePreview);
triggerKeyEl.addEventListener('change', updatePreview);

saveBtn.addEventListener('click', () => {
  const s = {
    mode: getMode(),
    modifier: modifierEl.value,
    triggerKey: triggerKeyEl.value,
    doubleTapInterval: Math.min(800, Math.max(200, parseInt(intervalEl.value) || 400)),
  };
  chrome.storage.sync.set({ shortcutSettings: s }, () => showToast('Saved!'));
});

resetBtn.addEventListener('click', () => {
  document.querySelector(`input[name="mode"][value="${DEFAULTS.mode}"]`).checked = true;
  modifierEl.value = DEFAULTS.modifier;
  triggerKeyEl.value = DEFAULTS.triggerKey;
  intervalEl.value = DEFAULTS.doubleTapInterval;
  updateUI();
  chrome.storage.sync.set({ shortcutSettings: DEFAULTS }, () => showToast('Reset to default!'));
});

loadSettings();
