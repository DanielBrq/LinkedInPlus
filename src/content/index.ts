import { CSS_PENDING, INITIAL_SCAN_DELAY_MS } from '@/shared/constants'
import { STORAGE_KEYS } from '@/shared/keys'
import { getClassifierConfig, getEnabled } from '@/shared/settings'
import { get, onChange } from '@/shared/storage'
import { createObserver } from './observer'
import { DESCRIPTION_SELECTOR } from './parser'
import { clearProcessedHashes, MSG_CONFIG_UPDATED, processContainer, stopProcessing } from './pipeline'
import { setMediaBlocking } from './mediaBlocker'

const LOG_PREFIX = '[LinkedIn Collector]'
const PENDING_CSS = `.${CSS_PENDING}{outline:2px solid #1976d2!important;outline-offset:-2px;position:relative}.${CSS_PENDING}::after{content:"Analyzing…";position:absolute;top:6px;right:6px;background:#1976d2;color:#fff;font:600 10px/1 -apple-system,BlinkMacSystemFont,sans-serif;padding:3px 7px;border-radius:10px;z-index:9;pointer-events:none}`

async function initContentScript(): Promise<void> {
  try {
    let enabled = await getEnabled()
    let aiConfig = await getClassifierConfig()
    let notInterestedEnabled = (await get(STORAGE_KEYS.notInterestedEnabled)) === true
    setMediaBlocking((await get(STORAGE_KEYS.blockMedia)) === true)

    const style = document.createElement('style')
    style.textContent = PENDING_CSS
    ;(document.head || document.documentElement).appendChild(style)

    const observer = createObserver(DESCRIPTION_SELECTOR, (container) =>
      processContainer(container, { aiConfig, notInterestedEnabled }),
    )
    if (enabled) {
      setTimeout(() => observer.scan(), INITIAL_SCAN_DELAY_MS)
      observer.start()
      console.log(LOG_PREFIX, 'Enabled — AI classification active.')
    }

    onChange(STORAGE_KEYS.classifierConfig, async () => {
      aiConfig = await getClassifierConfig()
      clearProcessedHashes()
      if (enabled) observer.scan()
      console.log(LOG_PREFIX, MSG_CONFIG_UPDATED)
    })

    onChange(STORAGE_KEYS.collectorEnabled, async (value) => {
      enabled = value !== false
      if (enabled) {
        aiConfig = await getClassifierConfig()
        clearProcessedHashes()
        observer.scan()
        observer.start()
      } else {
        observer.stop()
        stopProcessing()
      }
    })
    onChange(STORAGE_KEYS.notInterestedEnabled, (value) => {
      notInterestedEnabled = value === true
    })
    onChange(STORAGE_KEYS.blockMedia, (value) => setMediaBlocking(value === true))
  } catch (error) {
    console.error(LOG_PREFIX, 'Failed to initialize extension:', error)
  }
}

void initContentScript()
