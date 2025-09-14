/* global firebase */

// --- 1) Configure your Firebase project ---
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Init (compat)
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const storage = firebase.storage();

// --- 2) Questions (render ALL at once) ---
const questions = [
  'What color best matches your mood today?',
  'Name a city you want to visit next.',
  'Pick a plant that represents you.',
  'What word do you want to hear more often?',
  'A sound you love in one phrase:',
  'Your perfect morning in 5 words:',
  'A tiny habit you\'re proud of:',
  'A food that feels like home:',
  'A superpower (realistic) you want:',
  'A book or show you recommend (title only):',
  'A place you feel calm:',
  'Describe the sky right now:',
  'Something you\'re learning:',
  'A phrase that motivates you:',
  'Name a texture you like:',
  'A smell you remember:',
  'One thing you want to make:',
  'A song for focus (title only):',
  'A tiny kindness you noticed:',
  'Three words for this week:'
];

// anonymous local user id
const uid = (() => {
  const key = 'crowd20_uid';
  let v = localStorage.getItem(key);
  if (!v){ v = 'u_' + Math.random().toString(36).slice(2,10); localStorage.setItem(key, v); }
  return v;
})();

const els = {
  app: document.getElementById('app'),
  saveJsonBtn: document.getElementById('saveJsonBtn'),
  saveCsvBtn: document.getElementById('saveCsvBtn'),
  resetBtn: document.getElementById('resetBtn'),
};

const sections = []; // {feed, textarea, fileInput, btn, hint, countEl, uploadingEl, previewImg, objectUrl}

function answersRef(i){ return db.ref(`questions/q${i}/answers`); }
function storagePath(i, file){
  const ext = (file.name && file.name.includes('.')) ? file.name.split('.').pop().toLowerCase() : 'jpg';
  return `question_uploads/q${i}/${Date.now()}_${uid}.${ext}`;
}

// Build UI for all questions
questions.forEach((qText, i) => {
  const card = document.createElement('section');
  card.className = 'card';

  const head = document.createElement('div');
  head.className = 'q-head';
  head.innerHTML = `<div class="q-index">Question ${i+1} of ${questions.length}</div>
                    <div class="q-text">${qText}</div>`;
  card.appendChild(head);

  const inputBox = document.createElement('div');
  inputBox.className = 'input-box';

  // left: textarea (multi answers)
  const textarea = document.createElement('textarea');
  textarea.placeholder = 'Type one or more answers. Put each answer on a new line.';
  textarea.rows = 2;

  // right: vertical controls (file + submit)
  const side = document.createElement('div');
  side.style.display = 'grid';
  side.style.gap = '8px';
  side.style.minWidth = '200px';

  const fileWrap = document.createElement('div');
  fileWrap.className = 'file-wrap';
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/*';
  fileInput.style.width = '100%';
  fileWrap.appendChild(fileInput);

  const btn = document.createElement('button');
  btn.className = 'primary';
  btn.textContent = 'Submit';

  const uploadingEl = document.createElement('div');
  uploadingEl.className = 'hint';
  uploadingEl.style.display = 'none';
  uploadingEl.textContent = 'Uploading image…';

  const previewImg = document.createElement('img');
  previewImg.className = 'preview hide';
  previewImg.alt = 'preview';

  side.appendChild(fileWrap);
  side.appendChild(btn);
  side.appendChild(uploadingEl);
  side.appendChild(previewImg);

  const row = document.createElement('div');
  row.className = 'input-row';
  row.appendChild(textarea);
  row.appendChild(side);

  inputBox.appendChild(row);
  card.appendChild(inputBox);

  const hint = document.createElement('div');
  hint.className = 'hint';
  hint.textContent = 'Tip: Cmd/Ctrl+Enter submits. You can submit text, an image, or both.';
  card.appendChild(hint);

  const feed = document.createElement('div');
  feed.className = 'answers';
  card.appendChild(feed);

  const foot = document.createElement('div');
  foot.className = 'footer';
  const countEl = document.createElement('span');
  countEl.textContent = '0 total';
  foot.appendChild(countEl);
  card.appendChild(foot);

  els.app.appendChild(card);

  sections[i] = { feed, textarea, fileInput, btn, hint, countEl, uploadingEl, previewImg, objectUrl: null };

  // handlers
  btn.addEventListener('click', () => submit(i));
  textarea.addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      submit(i);
    }
  });
  fileInput.addEventListener('change', () => showPreview(i));

  attachFeed(i);
});

// Show instant local preview when a file is selected
function showPreview(i){
  const sec = sections[i];
  // revoke previous local URL
  if (sec.objectUrl){ URL.revokeObjectURL(sec.objectUrl); sec.objectUrl = null; }
  const file = sec.fileInput.files && sec.fileInput.files[0] ? sec.fileInput.files[0] : null;
  if (!file){ sec.previewImg.src = ''; sec.previewImg.classList.add('hide'); return; }
  if (!file.type.startsWith('image/')){ sec.hint.innerHTML = '<span class="warn">Please choose an image file.</span>'; return; }
  const url = URL.createObjectURL(file);
  sec.objectUrl = url;
  sec.previewImg.src = url;
  sec.previewImg.classList.remove('hide');
}

// --- Live listeners for each question
function attachFeed(i){
  const refAns = answersRef(i);

  // Update total count from number of children
  refAns.on('value', snap => {
    sections[i].countEl.textContent = `${snap.numChildren()} total`;
  });

  // Append answers in chronological order
  refAns.orderByChild('ts').limitToLast(200).on('child_added', snap => {
    const data = snap.val();
    if (!data) return;
    addAnswerToList(i, data);
  });
}

function addAnswerToList(i, { text, uid, ts, image_url }){
  const feed = sections[i].feed;
  const row = document.createElement('div');
  row.className = 'answer';

  const badge = document.createElement('span');
  badge.className = 'badge';
  badge.textContent = (uid || 'anon').slice(-4);

  const body = document.createElement('div');
  const phrase = document.createElement('div');
  phrase.className = 'phrase';
  phrase.textContent = text || (image_url ? '(image)' : '');
  body.appendChild(phrase);

  if (image_url){
    const img = document.createElement('img');
    img.className = 'thumb';
    img.src = image_url;
    img.alt = 'uploaded';
    img.loading = 'lazy';
    body.appendChild(img);
  }

  const stamp = document.createElement('div');
  stamp.className = 'stamp';
  stamp.textContent = ts ? new Date(ts).toLocaleString() : '…';

  body.appendChild(stamp);
  row.appendChild(badge);
  row.appendChild(body);
  feed.appendChild(row);
  feed.scrollTop = feed.scrollHeight;
}

// --- Validation
function sanitizePhrase(s){
  let t = (s || '').trim().replace(/\s+/g,' ');
  if (t.length < 2 || t.length > 140) return '';
  const banned = [/\bidiot\b/i, /\bkill\b/i];
  for (const re of banned){ if (re.test(t)) return ''; }
  return t;
}

// --- Submit (supports multi-line text + optional single image)
async function submit(i){
  const sec = sections[i];
  const { textarea, fileInput, btn, hint, uploadingEl, previewImg } = sec;

  const raw = String(textarea.value || '');
  const pieces = raw.split(/[\n;]+/).map(s => sanitizePhrase(s)).filter(Boolean);

  const file = fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;
  const hasImage = !!file;

  if (!pieces.length && !hasImage){
    hint.innerHTML = '<span class="warn">Add at least one short phrase (2–140 chars) or choose an image.</span>';
    return;
  }

  if (hasImage){
    if (!file.type.startsWith('image/')){
      hint.innerHTML = '<span class="warn">Please choose an image file.</span>';
      return;
    }
    if (file.size > 10 * 1024 * 1024){
      hint.innerHTML = '<span class="warn">Image too large (max 10MB).</span>';
      return;
    }
  }

  const batch = pieces.slice(0, 20);
  btn.disabled = true;

  try{
    // Upload (if any) and push entries
    let imageURL = null;
    if (hasImage){
      uploadingEl.style.display = 'block';
      const ref = storage.ref(storagePath(i, file));
      await ref.put(file, { contentType: file.type });
      imageURL = await ref.getDownloadURL();
      uploadingEl.style.display = 'none';
    }

    const refAns = answersRef(i);
    const now = Date.now();

    if (batch.length === 0 && imageURL){
      await refAns.push({ image_url: imageURL, uid, ts: now });
    } else if (batch.length === 1){
      await refAns.push({ text: batch[0], image_url: imageURL || null, uid, ts: now });
    } else {
      let first = true;
      for (const part of batch){
        await refAns.push({ text: part, image_url: (first && imageURL) ? imageURL : null, uid, ts: Date.now() });
        first = false;
      }
      if (imageURL){
        hint.innerHTML = '<span class="ok">Posted multiple answers. Image attached to the first.</span>';
      }
    }

    // Clear inputs + local preview immediately
    textarea.value = '';
    if (fileInput.value){ fileInput.value = ''; }
    if (sec.objectUrl){ URL.revokeObjectURL(sec.objectUrl); sec.objectUrl = null; }
    previewImg.src = ''; previewImg.classList.add('hide');

    // Positive feedback if not set above
    if (!imageURL || batch.length <= 1){
      hint.innerHTML = '<span class="ok">Submitted!</span>';
    }
  }catch(err){
    console.error(err);
    // Surface common errors (e.g., PERMISSION_DENIED)
    const msg = (err && err.code) ? ` (${err.code})` : '';
    hint.innerHTML = `<span class="warn">Send failed${msg}. Check Firebase config/rules and try again.</span>`;
  }finally{
    btn.disabled = false;
    uploadingEl.style.display = 'none';
    textarea.focus();
  }
}

// ---- Save All (JSON / CSV) ----
els.saveJsonBtn?.addEventListener('click', exportJSON);
els.saveCsvBtn?.addEventListener('click', exportCSV);

function fetchAll(){
  return db.ref('questions').once('value').then(snap => {
    const data = snap.val() || {};
    return questions.map((q, i) => {
      const qkey = `q${i}`;
      const arr = data[qkey]?.answers ? Object.values(data[qkey].answers) : [];
      return { question_index: i, question_text: q, answers: arr };
    });
  });
}

async function exportJSON(){
  const all = await fetchAll();
  const blob = new Blob(
    [JSON.stringify({ exported_at:new Date().toISOString(), questions: all }, null, 2)],
    { type:'application/json' }
  );
  downloadBlob(blob, 'crowd-answers.json');
}

async function exportCSV(){
  const all = await fetchAll();
  const rows = [['question_index','question_text','uid','ts','ts_iso','text','image_url']];
  all.forEach(q => {
    q.answers.forEach(a => {
      const ts = a.ts || '';
      const iso = a.ts ? new Date(a.ts).toISOString() : '';
      rows.push([
        q.question_index,
        csvQuote(q.question_text),
        a.uid || '',
        ts,
        iso,
        csvQuote(a.text || ''),
        csvQuote(a.image_url || '')
      ]);
    });
  });
  const csv = rows.map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type:'text/csv' });
  downloadBlob(blob, 'crowd-answers.csv');
}

function csvQuote(s){ return `"${String(s).replace(/"/g,'""')}"`; }
function downloadBlob(blob, filename){
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click();
  a.remove(); URL.revokeObjectURL(url);
}

// ---- Reset (delete all answers for all questions) ----
els.resetBtn?.addEventListener('click', resetAll);

async function resetAll(){
  const sure = confirm('Reset will permanently delete ALL answers for ALL questions.\n\nProceed?');
  if (!sure) return;
  const sure2 = confirm('Are you absolutely sure? This cannot be undone.');
  if (!sure2) return;

  try{
    const ops = questions.map((_, i) => answersRef(i).set(null));
    await Promise.all(ops);

    sections.forEach(sec => {
      sec.feed.innerHTML = '';
      sec.countEl.textContent = '0 total';
      sec.hint.innerHTML = '<span class="ok">All answers cleared.</span>';
      if (sec.fileInput.value){ sec.fileInput.value = ''; }
      if (sec.objectUrl){ URL.revokeObjectURL(sec.objectUrl); sec.objectUrl = null; }
      sec.previewImg.src = ''; sec.previewImg.classList.add('hide');
    });
  }catch(err){
    console.error(err);
    alert('Reset failed. Check your Firebase rules/connection and try again.');
  }
}
