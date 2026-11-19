import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import App from './App.vue'

const mountPopup = async () => {
  const wrapper = mount(App)
  await flushPromises()
  return wrapper
}

const valueOf = (wrapper: Awaited<ReturnType<typeof mountPopup>>, selector: string): string =>
  (wrapper.get(selector).element as HTMLInputElement | HTMLTextAreaElement).value

describe('popup', () => {
  it('renders stored configuration and enabled state', async () => {
    await chrome.storage.local.set({
      classifier_config: {
        apiKey: 'key',
        model: 'openai/gpt',
        filters: 'roles',
        negativeFilters: 'avoid',
        threshold: 30,
      },
      collector_enabled: false,
    })

    const wrapper = await mountPopup()

    expect(valueOf(wrapper, '#apiKey')).toBe('key')
    expect(valueOf(wrapper, '#model')).toBe('openai/gpt')
    expect(valueOf(wrapper, '#filters')).toBe('roles')
    expect(valueOf(wrapper, '#negativeFilters')).toBe('avoid')
    expect(valueOf(wrapper, '#threshold')).toBe('30')
    expect(wrapper.get('#thresholdValue').text()).toBe('30')
    expect((wrapper.get('#enableToggle').element as HTMLInputElement).checked).toBe(false)
  })

  it('saves trimmed values with the configured threshold', async () => {
    const wrapper = await mountPopup()

    await wrapper.get('#apiKey').setValue(' key ')
    await wrapper.get('#model').setValue(' provider/model ')
    await wrapper.get('#filters').setValue(' roles ')
    await wrapper.get('#negativeFilters').setValue(' avoid ')
    await wrapper.get('#threshold').setValue('80')
    await wrapper.get('#saveConfig').trigger('click')
    await flushPromises()

    const { classifier_config: saved } = await chrome.storage.local.get('classifier_config')
    expect(saved).toEqual({
      apiKey: 'key',
      model: 'provider/model',
      filters: 'roles',
      negativeFilters: 'avoid',
      threshold: 80,
    })
    expect(wrapper.get('#status').text()).toBe('Configuration saved.')
  })

  it('persists the toggle and follows external storage changes', async () => {
    const wrapper = await mountPopup()
    const toggle = wrapper.get('#enableToggle')

    await toggle.setValue(false)
    await flushPromises()
    expect((await chrome.storage.local.get('collector_enabled')).collector_enabled).toBe(false)

    await chrome.storage.local.set({ collector_enabled: true })
    await flushPromises()
    expect((toggle.element as HTMLInputElement).checked).toBe(true)
  })

  it('persists the restored feature toggles', async () => {
    const wrapper = await mountPopup()
    await wrapper.get('#notInterestedToggle').setValue(true)
    await wrapper.get('#blockMediaToggle').setValue(true)
    await flushPromises()
    const stored = await chrome.storage.local.get(['not_interested_enabled', 'block_media'])
    expect(stored).toEqual({ not_interested_enabled: true, block_media: true })
  })
})
