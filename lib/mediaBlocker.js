const CSS_BG_NONE = '*{background-image:none!important}';

let scriptEl = null;
let styleSheet = null;

const HIJACK_CODE = `
(function(){
  var S=[];var P=[HTMLImageElement.prototype,HTMLVideoElement.prototype,HTMLSourceElement.prototype];
  var Q=['src','srcset'];function H(p,q){var d=Object.getOwnPropertyDescriptor(p,q);if(!d||!d.configurable)return;
  S.push({p:p,q:q,d:d});Object.defineProperty(p,q,{get:d.get,set:function(){this.removeAttribute(q)},configurable:true,enumerable:d.enumerable})}
  P.forEach(function(p){Q.forEach(function(q){H(p,q)})});H(HTMLVideoElement.prototype,'poster');
  window.__lcMediaBlocker=S;
})();
`;

export function enableMediaBlocking() {
  if (scriptEl) return;
  scriptEl = Object.assign(document.createElement('script'), {
    id: 'lc-media-blocker',
    textContent: HIJACK_CODE,
  });
  document.documentElement.appendChild(scriptEl);
  if (!styleSheet) {
    styleSheet = Object.assign(document.createElement('style'), {
      id: 'lc-media-blocker-css',
      textContent: CSS_BG_NONE,
    });
    document.head.appendChild(styleSheet);
  }
}

export function disableMediaBlocking() {
  if (scriptEl) {
    scriptEl.remove();
    scriptEl = null;
  }
  const cleanup = document.createElement('script');
  cleanup.textContent = '(function(){var s=window.__lcMediaBlocker;if(s){s.forEach(function(x){Object.defineProperty(x.p,x.q,x.d)});delete window.__lcMediaBlocker}})()';
  document.documentElement.appendChild(cleanup);
  cleanup.remove();
  if (styleSheet) {
    styleSheet.remove();
    styleSheet = null;
  }
}
