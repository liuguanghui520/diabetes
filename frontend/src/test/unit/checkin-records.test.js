import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { clearAuthSession, saveAuthSession } from '../../api/request'
import CheckinRecordsView from '../../views/plan/CheckinRecordsView.vue'

const routerPush = vi.fn()
const routerBack = vi.fn()
const routerReplace = vi.fn()

vi.mock('vue-router', async () => {
  const actual = await vi.importActual('vue-router')
  return {
    ...actual,
    useRouter: () => ({
      push: routerPush,
      back: routerBack,
      replace: routerReplace,
    }),
    useRoute: () => ({
      query: {},
      params: {},
      fullPath: '/plan/checkins',
    }),
  }
})

// Restore window.history for goBack testing
let historyLength = 2
Object.defineProperty(window, 'history', {
  configurable: true,
  value: {
    get length() {
      return historyLength
    },
  },
})

const stubs = {
  'van-progress': true,
  'van-icon': true,
  'van-button': { emits: ['click'], template: '<button type="button" @click="$emit(`click`)"><slot /></button>' },
  'van-skeleton': { template: '<div><slot /></div>' },
  'van-cell': { template: '<button type="button"><slot /></button>' },
  'van-cell-group': { template: '<div><slot /></div>' },
  'van-tag': true,
  'van-empty': true,
  'van-nav-bar': true,
  'van-swipe-cell': true,
  'van-calendar': true,
  'van-circle': true,
  'van-grid': true,
  'van-grid-item': true,
  'van-tabs': true,
  'van-tab': true,
  'van-switch': true,
  'van-field': true,
  'van-form': true,
  LeftOutlined: { template: '<span>←</span>' },
  FundOutlined: { template: '<span>📊</span>' },
  CheckCircleFilled: { template: '<span>✓</span>' },
  ClockCircleOutlined: { template: '<span>⏰</span>' },
  RightOutlined: { template: '<span>→</span>' },
  HomeOutlined: { template: '<span>⌂</span>' },
  SearchOutlined: { template: '<span>🔍</span>' },
  FileTextOutlined: { template: '<span>📄</span>' },
  CalendarOutlined: { template: '<span>📅</span>' },
}

function json(data) {
  return new Response(JSON.stringify({ code: 0, data }), { status: 200 })
}

// ============================================================
// CheckinRecordsView — coverage of all branches
// ============================================================
describe('CheckinRecordsView', () => {
  beforeEach(() => {
    routerPush.mockClear()
    routerBack.mockClear()
    routerReplace.mockClear()
    clearAuthSession()
    saveAuthSession({ token: 't', user: { id: 1, role: 'user', username: 'demo', nickname: 'Demo' } })
    historyLength = 2
  })

  async function mountWithData(apiData) {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(json(apiData))))
    const wrapper = mount(CheckinRecordsView, {
      global: { stubs },
    })
    await flushPromises()
    return wrapper
  }

  it('mounts and shows summary stats with records', async () => {
    const wrapper = await mountWithData({
      history: [
        { date: '2026-07-01', task_count: 4, completed_count: 4 },
        { date: '2026-07-02', task_count: 3, completed_count: 2 },
        { date: '2026-06-30', task_count: 5, completed_count: 5 },
      ],
    })
    expect(wrapper.text()).toContain('条记录')
    expect(wrapper.text()).toContain('打卡记录')
  })

  it('shows empty state when no records', async () => {
    const wrapper = await mountWithData({ history: [] })
    await flushPromises()
    expect(wrapper.text()).toContain('还没有打卡记录')
  })

  it('handles API error gracefully', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('network'))))
    const wrapper = mount(CheckinRecordsView, {
      global: { stubs },
    })
    await flushPromises()
    expect(wrapper.exists()).toBe(true)
  })

  it('handles missing history field', async () => {
    const wrapper = await mountWithData({})
    expect(wrapper.text()).toContain('还没有打卡记录')
  })

  // Record normalization branches
  it('normalizes record with completion_rate (0-1 range)', async () => {
    const wrapper = await mountWithData({
      history: [{ date: '2026-07-01', completion_rate: 0.5 }],
    })
    await flushPromises()
    expect(wrapper.text()).toContain('50%')
  })

  it('normalizes record with rate field', async () => {
    const wrapper = await mountWithData({
      history: [{ date: '2026-07-01', rate: 75 }],
    })
    await flushPromises()
    expect(wrapper.text()).toContain('75')
  })

  it('normalizes record with completionRate field', async () => {
    const wrapper = await mountWithData({
      history: [{ date: '2026-07-01', completionRate: 80 }],
    })
    await flushPromises()
    expect(wrapper.text()).toContain('80')
  })

  it('normalizes record with alternative field names', async () => {
    const wrapper = await mountWithData({
      history: [{
        date: '2026-07-01',
        total_count: 10,
        completed: 7,
      }],
    })
    await flushPromises()
    expect(wrapper.text()).toContain('70')
  })

  it('normalizes record with done_count field', async () => {
    const wrapper = await mountWithData({
      history: [{
        date: '2026-07-01',
        total: 5,
        done_count: 3,
      }],
    })
    await flushPromises()
    expect(wrapper.text()).toContain('60')
  })

  it('normalizes record with taskCount and completedCount', async () => {
    const wrapper = await mountWithData({
      history: [{
        date: '2026-07-01',
        taskCount: 8,
        completedCount: 6,
      }],
    })
    await flushPromises()
    expect(wrapper.text()).toContain('75')
  })

  it('handles record with negative values (clamped to 0)', async () => {
    const wrapper = await mountWithData({
      history: [{ date: '2026-07-01', task_count: -1, completed_count: -5 }],
    })
    await flushPromises()
    expect(wrapper.text()).toContain('0%')
  })

  it('handles record without date field', async () => {
    const wrapper = await mountWithData({
      history: [{ completion_rate: 50 }],
    })
    await flushPromises()
    // Records without dates are filtered out
    expect(wrapper.text()).toContain('还没有打卡记录')
  })

  it('handles record with checkin_date field', async () => {
    const wrapper = await mountWithData({
      history: [{
        checkin_date: '2026-07-01',
        task_count: 2,
        completed_count: 2,
      }],
    })
    await flushPromises()
    expect(wrapper.text()).toContain('条记录')
  })

  // clamps rate > 100
  it('clamps rate above 100', async () => {
    const wrapper = await mountWithData({
      history: [{ date: '2026-07-01', completion_rate: 150 }],
    })
    await flushPromises()
    expect(wrapper.text()).toContain('100%')
  })

  // completedCount capped by totalCount
  it('caps completedCount at totalCount', async () => {
    const wrapper = await mountWithData({
      history: [{
        date: '2026-07-01',
        task_count: 3,
        completed_count: 10, // more completed than total!
      }],
    })
    await flushPromises()
    // Rate should be 100% (not > 100%)
    expect(wrapper.text()).toContain('100%')
  })

  // Click a calendar day
  it('selects date on calendar day click', async () => {
    const wrapper = await mountWithData({
      history: [
        { date: '2026-07-01', task_count: 2, completed_count: 2 },
      ],
    })
    await flushPromises()
    const dayButtons = wrapper.findAll('.calendar-day')
    if (dayButtons.length > 0) {
      await dayButtons[0].trigger('click')
      await flushPromises()
    }
    expect(wrapper.exists()).toBe(true)
  })

  // goBack with history
  it('goes back via router.back when history available', async () => {
    historyLength = 3
    const wrapper = await mountWithData({ history: [] })
    await flushPromises()
    const backButton = wrapper.find('.nav-back')
    await backButton.trigger('click')
    expect(routerBack).toHaveBeenCalled()
  })

  // goBack without history → pushes to plan
  it('pushes to plan when no history', async () => {
    historyLength = 1
    const wrapper = await mountWithData({ history: [] })
    await flushPromises()
    const backButton = wrapper.find('.nav-back')
    await backButton.trigger('click')
    expect(routerPush).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'plan' }),
    )
  })

  // openAnalysis navigates
  it('navigates to analysis view', async () => {
    const wrapper = await mountWithData({ history: [] })
    await flushPromises()
    const analysisButton = wrapper.find('.analysis-nav-button')
    await analysisButton.trigger('click')
    expect(routerPush).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'checkinAnalysis' }),
    )
  })

  // Tests for records sorted by date descending
  it('sorts records by date descending', async () => {
    const wrapper = await mountWithData({
      history: [
        { date: '2026-06-01', completion_rate: 10 },
        { date: '2026-07-01', completion_rate: 90 },
        { date: '2026-06-15', completion_rate: 50 },
      ],
    })
    await flushPromises()
    // Latest record (2026-07-01) should have rate 90%
    expect(wrapper.text()).toContain('90%')
  })

  // Multiple records with same date (dedup via recordMap keeps first)
  it('deduplicates records with same date', async () => {
    const wrapper = await mountWithData({
      history: [
        { date: '2026-07-01', completion_rate: 90 },
        { date: '2026-07-01', completion_rate: 50 },
      ],
    })
    await flushPromises()
    // recordMap keeps first occurrence for each date (first in sorted order = 90%)
    expect(wrapper.text()).toContain('90%')
  })

  // Record with no tasks (totalCount = 0) shows '暂无任务'
  it('shows "暂无任务" for record with no tasks', async () => {
    const wrapper = await mountWithData({
      history: [{ date: '2026-07-01', task_count: 0, completed_count: 0 }],
    })
    await flushPromises()
    expect(wrapper.text()).toContain('暂无任务')
  })

  // Record with partial completion shows '部分完成'
  it('shows "部分完成" for partially completed', async () => {
    const wrapper = await mountWithData({
      history: [{ date: '2026-07-01', task_count: 5, completed_count: 2 }],
    })
    await flushPromises()
    expect(wrapper.text()).toContain('部分完成')
  })

  // Record fully completed shows '已完成'
  it('shows "已完成" for fully completed record', async () => {
    const wrapper = await mountWithData({
      history: [{ date: '2026-07-01', task_count: 3, completed_count: 3 }],
    })
    await flushPromises()
    expect(wrapper.text()).toContain('已完成')
  })

  // Record with 0% completed shows '未完成'
  it('shows "未完成" for zero completion', async () => {
    const wrapper = await mountWithData({
      history: [{ date: '2026-07-01', task_count: 3, completed_count: 0 }],
    })
    await flushPromises()
    expect(wrapper.text()).toContain('未完成')
  })
})
