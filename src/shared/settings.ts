import { DEFAULT_MODEL } from './constants'
import { STORAGE_KEYS, type ClassifierConfig } from './keys'
import { get, getAll, remove, set } from './storage'

export const DEFAULT_CLASSIFIER_CONFIG: ClassifierConfig = {
  apiKey: '',
  model: DEFAULT_MODEL,
  filters: '',
  negativeFilters: '',
  threshold: 65,
}

const OBSOLETE_KEYS = [
  'job_index',
  'ai_config',
  'ai_presets',
  'ai_active_preset',
  'save_matches',
  'hide_non_relevant',
  'not_interested_enabled',
  'display_config',
  'block_media',
]

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const asString = (value: unknown): string => (typeof value === 'string' ? value : '')

function clampThreshold(value: unknown): number {
  const threshold = Number(value)
  return Number.isFinite(threshold)
    ? Math.max(0, Math.min(100, threshold))
    : DEFAULT_CLASSIFIER_CONFIG.threshold
}

async function migrateLegacyData(): Promise<void> {
  if (await get(STORAGE_KEYS.migrationFlag)) return

  const all = await getAll()
  const presets = isRecord(all['ai_presets']) ? all['ai_presets'] : {}
  const activeKey = all['ai_active_preset']
  const active = typeof activeKey === 'string' ? presets[activeKey] : undefined
  const firstPreset = Object.values(presets).find(isRecord)
  const oldConfig = isRecord(active)
    ? active
    : (firstPreset ?? (isRecord(all['ai_config']) ? all['ai_config'] : {}))

  if (!all['classifier_config']) {
    const locationFilter = asString(oldConfig['locationFilter'])
    await set(STORAGE_KEYS.classifierConfig, {
      apiKey: asString(oldConfig['apiKey']),
      model: asString(oldConfig['model']) || DEFAULT_MODEL,
      filters: [asString(oldConfig['filters']), locationFilter && `Location: ${locationFilter}`]
        .filter(Boolean)
        .join('\n'),
      negativeFilters: asString(oldConfig['negativeFilters']),
      threshold: DEFAULT_CLASSIFIER_CONFIG.threshold,
    })
  }

  const obsolete = Object.keys(all).filter((key) => key.startsWith('job_'))
  await remove([...obsolete, ...OBSOLETE_KEYS])
  await set(STORAGE_KEYS.migrationFlag, true)
}

export async function getEnabled(): Promise<boolean> {
  return (await get(STORAGE_KEYS.collectorEnabled)) !== false
}

export async function saveEnabled(enabled: boolean): Promise<void> {
  await set(STORAGE_KEYS.collectorEnabled, Boolean(enabled))
}

export async function getClassifierConfig(): Promise<ClassifierConfig> {
  await migrateLegacyData()
  const config = { ...DEFAULT_CLASSIFIER_CONFIG, ...(await get(STORAGE_KEYS.classifierConfig)) }
  return { ...config, threshold: clampThreshold(config.threshold) }
}

export async function saveClassifierConfig(config: Partial<ClassifierConfig>): Promise<void> {
  await migrateLegacyData()
  await set(STORAGE_KEYS.classifierConfig, {
    ...DEFAULT_CLASSIFIER_CONFIG,
    ...config,
    threshold: clampThreshold(config.threshold),
  })
}
