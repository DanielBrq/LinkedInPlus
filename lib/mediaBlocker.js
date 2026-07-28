const CSS_BG_NONE = '*{background-image:none!important}';

let saved = [];
let styleSheet = null;

function hijack(proto, prop) {
  const desc = Object.getOwnPropertyDescriptor(proto, prop);
  if (!desc || !desc.configurable) return;
  saved.push({ proto, prop, desc });
  Object.defineProperty(proto, prop, {
    get: desc.get,
    set() { this.removeAttribute(prop); },
    configurable: true,
    enumerable: desc.enumerable,
  });
}

export function enableMediaBlocking() {
  if (saved.length) return;
  hijack(HTMLImageElement.prototype, 'src');
  hijack(HTMLImageElement.prototype, 'srcset');
  hijack(HTMLVideoElement.prototype, 'src');
  hijack(HTMLVideoElement.prototype, 'poster');
  hijack(HTMLSourceElement.prototype, 'src');
  hijack(HTMLSourceElement.prototype, 'srcset');
  if (!styleSheet) {
    styleSheet = Object.assign(document.createElement('style'), {
      id: 'lc-media-blocker',
      textContent: CSS_BG_NONE,
    });
    document.head.appendChild(styleSheet);
  }
}

export function disableMediaBlocking() {
  for (const { proto, prop, desc } of saved) {
    Object.defineProperty(proto, prop, desc);
  }
  saved = [];
  if (styleSheet) {
    styleSheet.remove();
    styleSheet = null;
  }
}
