const CSS_BG_NONE = '*{background-image:none!important}'
const saved: { prototype: object; property: string; descriptor: PropertyDescriptor }[] = []
let style: HTMLStyleElement | null = null

function blockProperty(prototype: object, property: string): void {
  const descriptor = Object.getOwnPropertyDescriptor(prototype, property)
  if (!descriptor?.configurable) return
  saved.push({ prototype, property, descriptor })
  Object.defineProperty(prototype, property, {
    get: descriptor.get,
    set(this: Element) { this.removeAttribute(property) },
    configurable: true,
    enumerable: descriptor.enumerable,
  })
}

export function setMediaBlocking(enabled: boolean): void {
  if (enabled) {
    if (saved.length) return
    blockProperty(HTMLImageElement.prototype, 'src')
    blockProperty(HTMLImageElement.prototype, 'srcset')
    blockProperty(HTMLVideoElement.prototype, 'src')
    blockProperty(HTMLVideoElement.prototype, 'poster')
    blockProperty(HTMLSourceElement.prototype, 'src')
    blockProperty(HTMLSourceElement.prototype, 'srcset')
    style ??= Object.assign(document.createElement('style'), { id: 'lc-media-blocker', textContent: CSS_BG_NONE })
    if (!style.isConnected) (document.head || document.documentElement).appendChild(style)
    return
  }
  for (const { prototype, property, descriptor } of saved) {
    Object.defineProperty(prototype, property, descriptor)
  }
  saved.length = 0
  style?.remove()
  style = null
}
