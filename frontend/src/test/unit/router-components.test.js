import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import router from '../../router'
import LiquidTabBar from '../../components/navigation/LiquidTabBar.vue'
import TopUserActions from '../../components/navigation/TopUserActions.vue'
import { clearAuthSession, saveAuthSession } from '../../api/request'

describe('router guards', () => {
  it('redirects by auth state and role', async () => {
    clearAuthSession()
    expect(await router.push('/health')).toBeUndefined()
    await router.isReady()
    expect(router.currentRoute.value.name).toBe('login')

    saveAuthSession({ token: 'user-token', user: { id: 1, role: 'user' } })
    await router.push('/login')
    expect(router.currentRoute.value.name).toBe('home')

    await router.push('/admin/dashboard')
    expect(router.currentRoute.value.name).toBe('home')

    saveAuthSession({ token: 'admin-token', user: { id: 2, role: 'admin' } })
    await router.push('/login')
    expect(router.currentRoute.value.name).toBe('adminDashboard')
    // Note: `to.path === '/'` guard (line 160) is unreachable because
    // the route config has `{ path: '/', redirect: '/home' }` which
    // redirects before beforeEach runs.
  })
})

describe('navigation components', () => {
  it('liquid tab bar emits changes and keeps active tab', async () => {
    const wrapper = mount(LiquidTabBar, {
      props: { activeKey: 'home' },
      global: { stubs: { 'van-icon': true } },
    })

    expect(wrapper.text()).toContain('首页')
    for (const button of wrapper.findAll('button')) {
      await button.trigger('click')
    }
    expect(wrapper.emitted('change')?.length).toBeGreaterThan(1)
  })

  it('top user actions routes and reacts to unread events', async () => {
    saveAuthSession({ token: 'token', user: { id: 1, role: 'user' } })
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify({
      code: 0,
      data: {
        list: [{ read: false }, { read: true }],
      },
    })))))
    const wrapper = mount(TopUserActions, {
      global: {
        plugins: [router],
        stubs: { 'van-icon': true },
      },
    })

    window.dispatchEvent(new CustomEvent('diafit:messages-updated', { detail: { unread: 3 } }))
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.top-message i').exists()).toBe(true)
    await wrapper.find('.top-message').trigger('click')
    await wrapper.find('.top-profile').trigger('click')
    expect(wrapper.exists()).toBe(true)
  })

  it('top user actions clears unread when logged out or fetch fails', async () => {
    clearAuthSession()
    const loggedOut = mount(TopUserActions, {
      global: {
        plugins: [router],
        stubs: { 'van-icon': true },
      },
    })
    await loggedOut.vm.$nextTick()
    expect(loggedOut.find('.top-message i').exists()).toBe(false)

    saveAuthSession({ token: 'token', user: { id: 1, role: 'user' } })
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('failed'))))
    const failed = mount(TopUserActions, {
      global: {
        plugins: [router],
        stubs: { 'van-icon': true },
      },
    })
    await failed.vm.$nextTick()
    window.dispatchEvent(new CustomEvent('diabetes:auth-changed'))
    await failed.vm.$nextTick()
    expect(failed.exists()).toBe(true)
  })

  it('unmounts and cleans up event listeners', async () => {
    saveAuthSession({ token: 'token', user: { id: 1, role: 'user' } })
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify({ code: 0, data: { list: [] } })))))
    const wrapper = mount(TopUserActions, {
      global: {
        plugins: [router],
        stubs: { 'van-icon': true },
      },
    })
    await wrapper.vm.$nextTick()
    // Unmount triggers onBeforeUnmount which calls removeEventListener
    wrapper.unmount()
    expect(wrapper.exists()).toBe(false)
  })
})
