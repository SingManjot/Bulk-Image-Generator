let prompts = [], running = false, tabId = null;
let cachedParentId = null;

const log = (msg) => {
  const div = document.getElementById('log');
  div.innerHTML += `<p>${msg}</p>`;
  div.scrollTop = div.scrollHeight;
};

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

document.getElementById('txtFile').addEventListener('change', (e) => {
  const reader = new FileReader();
  reader.onload = (ev) => {
    prompts = ev.target.result.split('\n').filter(l => l.trim() !== '');
    log(`✅ Loaded ${prompts.length} prompts`);
  };
  reader.readAsText(e.target.files[0]);
});

document.getElementById('stopBtn').addEventListener('click', () => {
  running = false;
  log('⏹ Stopped.');
  document.getElementById('startBtn').disabled = false;
  document.getElementById('stopBtn').disabled = true;
});

document.getElementById('startBtn').addEventListener('click', async () => {
  const subfolderName = document.getElementById('folderName').value.trim();
  if (!prompts.length) return alert('Load a .txt file first.');
  if (!subfolderName) return alert('Enter a subfolder name.');

  const [tab] = await chrome.tabs.query({ url: 'https://gemini.google.com/*' });
  if (!tab) return alert('Please open gemini.google.com first!');
  tabId = tab.id;

  running = true;
  document.getElementById('startBtn').disabled = true;
  document.getElementById('stopBtn').disabled = false;
  cachedParentId = null;

  const token = await new Promise(res =>
    chrome.identity.getAuthToken({ interactive: true }, res)
  );
  const parentId = await getParentFolderId(token);
  const subFolderId = await getOrCreateSubfolder(subfolderName, parentId, token);

  log(`🚀 Uploading to: AI Generated Images / ${subfolderName}`);

  for (let i = 0; i < prompts.length && running; i++) {
    log(`⏳ [${i+1}/${prompts.length}] ${prompts[i]}`);
    try {
      const res = await chrome.tabs.sendMessage(tabId, {
        action: 'runPrompt',
        prompt: prompts[i]
      });
      if (res?.src) {
        await uploadToDrive(res.src, `image_${i+1}.jpg`, subFolderId, token);
        log(`☁️ Uploaded image ${i+1}`);
      } else if (res?.error) {
        log(`❌ Prompt ${i+1} failed: ${res.error}`);
      }
    } catch (e) {
      log(`❌ Error on prompt ${i+1}: ${e.message}`);
    }
    await sleep(3000);
  }

  log('🎉 All done!');
  running = false;
  document.getElementById('startBtn').disabled = false;
  document.getElementById('stopBtn').disabled = true;
});

async function getParentFolderId(token) {
  if (cachedParentId) return cachedParentId;

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=name='AI Generated Images' and 'root' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    { headers: { Authorization: `Bearer ${token}` } }
  ).then(r => r.json());

  if (res.files.length > 0) {
    cachedParentId = res.files[0].id;
    return cachedParentId;
  }

  log(`📁 Creating "AI Generated Images" folder in Drive root...`);
  const folder = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'AI Generated Images',
      mimeType: 'application/vnd.google-apps.folder'
    })
  }).then(r => r.json());

  cachedParentId = folder.id;
  return cachedParentId;
}

async function getOrCreateSubfolder(name, parentId, token) {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=name='${name}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    { headers: { Authorization: `Bearer ${token}` } }
  ).then(r => r.json());

  if (res.files.length > 0) {
    log(`📂 Found existing folder: "${name}"`);
    return res.files[0].id;
  }

  log(`📁 Creating subfolder: "${name}"`);
  const folder = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId]
    })
  }).then(r => r.json());

  return folder.id;
}

async function uploadToDrive(imgSrc, filename, folderId, token) {
  const blob = await fetch(imgSrc).then(r => r.blob());
  const metadata = JSON.stringify({ name: filename, parents: [folderId] });

  const form = new FormData();
  form.append('metadata', new Blob([metadata], { type: 'application/json' }));
  form.append('file', blob);

  await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form
  });
}
