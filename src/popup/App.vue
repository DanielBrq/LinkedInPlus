<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { STORAGE_KEYS, type ClassifierConfig } from '@/shared/keys'
import { getClassifierConfig, saveClassifierConfig, saveEnabled } from '@/shared/settings'
import { useStorage } from '@/shared/useStorage'

const field =
  'mb-2.5 block w-full rounded-md border border-[#3d434b] bg-[#1a1d21] px-2.5 py-[7px] text-[#e1e5ea] focus:outline focus:outline-2 focus:outline-offset-1 focus:outline-[#6db3f2]'

const enabled = useStorage(STORAGE_KEYS.collectorEnabled, true)
const config = reactive<ClassifierConfig>({ apiKey: '', model: '', filters: '', negativeFilters: '', threshold: 65 })
const status = ref('')

onMounted(async () => {
  Object.assign(config, await getClassifierConfig())
})

async function save(): Promise<void> {
  await saveClassifierConfig({
    apiKey: config.apiKey.trim(),
    model: config.model.trim(),
    filters: config.filters.trim(),
    negativeFilters: config.negativeFilters.trim(),
    threshold: config.threshold,
  })
  status.value = 'Configuration saved.'
}
</script>

<template>
  <div class="w-[376px] bg-[#1a1d21] text-sm leading-normal text-[#e1e5ea]">
    <div class="border-b border-[#3d434b] px-4 pb-2.5 pt-3.5">
      <div class="text-[15px] font-bold">LinkedIn Classifier</div>
    </div>
    <main class="px-4 pb-4 pt-3">
      <div
        class="mb-3 flex items-center justify-between rounded-lg border border-[#3d434b] bg-[#23272c] px-3.5 py-2.5"
      >
        <span class="font-semibold">Enable classification</span>
        <label class="relative inline-block h-[22px] w-[38px]">
          <input
            id="enableToggle"
            v-model="enabled"
            type="checkbox"
            class="peer absolute opacity-0"
            @change="saveEnabled(enabled)"
          >
          <span
            class="absolute inset-0 cursor-pointer rounded-full bg-[#4a5058] peer-checked:bg-[#6db3f2] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#6db3f2]"
          />
          <span
            class="absolute bottom-0.5 left-0.5 h-[18px] w-[18px] rounded-full bg-white transition-transform peer-checked:translate-x-4"
          />
        </label>
      </div>
      <div class="rounded-lg border border-[#3d434b] bg-[#23272c] p-3.5">
        <label for="apiKey" class="mb-[3px] block text-[13px] font-semibold">Vercel AI Gateway API key</label>
        <input
          id="apiKey"
          v-model="config.apiKey"
          type="password"
          autocomplete="off"
          placeholder="AI Gateway API key"
          :class="field"
        >
        <label for="model" class="mb-[3px] block text-[13px] font-semibold">Model ID</label>
        <input id="model" v-model="config.model" type="text" placeholder="provider/model" :class="field">
        <label for="filters" class="mb-[3px] block text-[13px] font-semibold">Positive filters</label>
        <textarea
          id="filters"
          v-model="config.filters"
          rows="3"
          placeholder="Roles, skills, seniority, industries…"
          :class="field"
        />
        <label for="negativeFilters" class="mb-[3px] block text-[13px] font-semibold">Negative filters</label>
        <textarea
          id="negativeFilters"
          v-model="config.negativeFilters"
          rows="3"
          placeholder="Technologies, roles, conditions to avoid…"
          :class="field"
        />
        <label for="threshold" class="mb-[3px] block text-[13px] font-semibold"
          >Hide posts below: <span id="thresholdValue">{{ config.threshold }}</span>/100</label
        >
        <input
          id="threshold"
          v-model.number="config.threshold"
          type="range"
          min="0"
          max="100"
          class="mb-3.5 mt-0.5 w-full accent-[#6db3f2]"
        >
        <button
          id="saveConfig"
          class="w-full rounded-md border-0 bg-[#6db3f2] px-3 py-2 font-semibold text-white"
          @click="save"
        >
          Save configuration
        </button>
        <div id="status" role="status" aria-live="polite" class="mt-2 min-h-[18px] text-xs text-[#3fb37f]">
          {{ status }}
        </div>
      </div>
    </main>
    <div class="border-t border-[#3d434b] px-4 py-2 text-[11px] text-[#9aa3b0]">
      <span>Only configuration is stored; posts are not saved.</span>
    </div>
  </div>
</template>
