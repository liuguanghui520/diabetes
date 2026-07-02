import { afterEach, beforeEach, vi } from 'vitest'

class StorageMock {
  constructor() {
    this.store = new Map()
  }

  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null
  }

  setItem(key, value) {
    this.store.set(key, String(value))
  }

  removeItem(key) {
    this.store.delete(key)
  }

  clear() {
    this.store.clear()
  }
}

Object.defineProperty(window, 'localStorage', {
  configurable: true,
  value: new StorageMock(),
})

Object.defineProperty(window, 'sessionStorage', {
  configurable: true,
  value: new StorageMock(),
})

beforeEach(() => {
  vi.useRealTimers()
  window.localStorage.clear()
  window.sessionStorage.clear()
  window.scrollTo = vi.fn()
  Element.prototype.scrollIntoView = vi.fn()
  window.matchMedia = vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })
  window.confirm = vi.fn(() => true)
  window.speechSynthesis = {
    cancel: vi.fn(),
    speak: vi.fn(),
  }
  window.SpeechSynthesisUtterance = vi.fn(function SpeechSynthesisUtterance(text) {
    this.text = text
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})
