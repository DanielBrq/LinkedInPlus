const CSS_BG_NONE = '*{background-image:none!important}';

let styleSheet = null;

function sendMsg(msg) {
  try { chrome.runtime.sendMessage(msg); } catch (e) {}
}

export function enableMediaBlocking() {
  sendMsg({ type: 'MEDIA_BLOCK_ON' });
  if (!styleSheet) {
    styleSheet = Object.assign(document.createElement('style'), {
      id: 'lc-media-blocker-css',
      textContent: CSS_BG_NONE,
    });
    document.head.appendChild(styleSheet);
  }
}

export function disableMediaBlocking() {
  sendMsg({ type: 'MEDIA_BLOCK_OFF' });
  if (styleSheet) {
    styleSheet.remove();
    styleSheet = null;
  }
}
