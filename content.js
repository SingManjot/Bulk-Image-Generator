async function sendPromptAndGetImage(prompt) {
  const inputBox = document.querySelector('div.ql-editor[contenteditable="true"]');
  inputBox.focus();
  inputBox.innerHTML = `<p>${prompt}</p>`;
  inputBox.dispatchEvent(new Event('input', { bubbles: true }));

  await sleep(500);

  const sendBtn = document.querySelector('button.send-button')
               || document.querySelector('button[aria-label*="Send"]');
  sendBtn.click();

  const imgSrc = await waitForGeneratedImage();
  return imgSrc;
}

function waitForGeneratedImage() {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      observer.disconnect();
      reject(new Error('Timed out waiting for image'));
    }, 60000);

    const observer = new MutationObserver(() => {
      const imgs = document.querySelectorAll(
        'model-response img[src*="blob"], model-response img[src*="lh3.google"]'
      );
      const lastImg = imgs[imgs.length - 1];
      if (lastImg && lastImg.complete && lastImg.naturalWidth > 0) {
        clearTimeout(timeout);
        observer.disconnect();
        resolve(lastImg.src);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true
    });
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'runPrompt') {
    sendPromptAndGetImage(msg.prompt)
      .then(src => sendResponse({ src }))
      .catch(err => sendResponse({ error: err.message }));
    return true;
  }
});
