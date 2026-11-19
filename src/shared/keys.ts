export type ClassifierConfig = {
  apiKey: string
  model: string
  filters: string
  negativeFilters: string
  threshold: number
  timeoutMs?: number
}

export type StorageSchema = {
  classifier_config: ClassifierConfig
  collector_enabled: boolean
  classifier_data_migrated: boolean
}

export const STORAGE_KEYS = {
  classifierConfig: 'classifier_config',
  collectorEnabled: 'collector_enabled',
  migrationFlag: 'classifier_data_migrated',
} as const satisfies Record<string, keyof StorageSchema>

export type StorageKey = keyof StorageSchema
