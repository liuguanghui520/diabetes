const TOKEN_KEY = 'diabetesAuthToken'
const USER_KEY = 'diabetesAuthUser'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
const API_MODE = import.meta.env.DEV
    ? String(import.meta.env.VITE_API_MODE || 'real').toLowerCase()
    : 'real'

export class ApiRequestError extends Error {
    constructor(message, options = {}) {
        super(message)

        this.name = 'ApiRequestError'
        this.status = options.status || 0
        this.code = options.code ?? null
        this.traceId = options.traceId || ''
        this.data = options.data ?? null
    }
}

export function isMockMode() {
    return import.meta.env.DEV && API_MODE !== 'real'
}

async function loadMockApi() {
    if (!isMockMode()) {
        throw new ApiRequestError('Mock API is only available in development mode.')
    }

    const importMock = new Function('return import("./mock")')

    return importMock()
}

function isAbsoluteUrl(url) {
    return /^https?:\/\//i.test(url)
}

function buildUrl(path) {
    if (isAbsoluteUrl(path)) {
        return path
    }

    const finalPath = path.startsWith('/') ? path : `/${path}`

    return `${API_BASE_URL}${finalPath}`
}

function isFormData(data) {
    return typeof FormData !== 'undefined' && data instanceof FormData
}

function isUrlSearchParams(data) {
    return typeof URLSearchParams !== 'undefined' && data instanceof URLSearchParams
}

function createIdempotencyKey() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID()
    }

    return `idem_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

async function parseResponseBody(response) {
    const text = await response.text()

    if (!text) {
        return null
    }

    try {
        return JSON.parse(text)
    } catch {
        return text
    }
}

function dispatchAuthExpiredEvent() {
    if (typeof window === 'undefined') {
        return
    }

    window.dispatchEvent(
        new CustomEvent('diabetes:auth-expired', {
            detail: {
                message: '登录状态已失效，请重新登录。',
            },
        }),
    )
}

function handleApiResult(status, payload) {
    const businessCode =
        payload &&
            typeof payload === 'object' &&
            Object.prototype.hasOwnProperty.call(payload, 'code')
            ? payload.code
            : null

    const isBusinessError = businessCode !== null && businessCode !== 0

    if (status < 200 || status >= 300 || isBusinessError) {
        const message =
            payload?.message ||
            `请求失败，HTTP 状态码：${status}`

        const error = new ApiRequestError(message, {
            status,
            code: businessCode,
            traceId: payload?.traceId || '',
            data: payload?.data ?? null,
        })

        if (status === 401 || businessCode === 40101) {
            clearAuthSession()
            dispatchAuthExpiredEvent()
        }

        throw error
    }

    return {
        code: payload?.code ?? 0,
        message: payload?.message || 'ok',
        data: payload?.data ?? payload,
        traceId: payload?.traceId || '',
    }
}

export function getAuthToken() {
    return localStorage.getItem(TOKEN_KEY) || ''
}

export function getStoredUser() {
    try {
        const rawUser = localStorage.getItem(USER_KEY)

        return rawUser ? JSON.parse(rawUser) : null
    } catch {
        return null
    }
}

export function hasAuthSession() {
    return Boolean(getAuthToken())
}

export function saveAuthSession(session) {
    if (!session?.token || !session?.user) {
        throw new ApiRequestError('登录响应缺少 token 或用户信息。')
    }

    localStorage.setItem(TOKEN_KEY, session.token)
    localStorage.setItem(USER_KEY, JSON.stringify(session.user))

    window.dispatchEvent(
        new CustomEvent('diabetes:auth-changed', {
            detail: {
                loggedIn: true,
                user: session.user,
            },
        }),
    )
}

export function clearAuthSession() {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)

    window.dispatchEvent(
        new CustomEvent('diabetes:auth-changed', {
            detail: {
                loggedIn: false,
                user: null,
            },
        }),
    )
}

export async function apiRequest(path, options = {}) {
    const {
        method = 'GET',
        data,
        headers = {},
        auth = true,
        idempotent = false,
        signal,
    } = options

    const requestHeaders = new Headers(headers)
    const upperMethod = method.toUpperCase()

    const token = auth ? getAuthToken() : ''

    if (token) {
        requestHeaders.set('Authorization', `Bearer ${token}`)
    }

    if (
        idempotent &&
        ['POST', 'PUT', 'PATCH', 'DELETE'].includes(upperMethod) &&
        !requestHeaders.has('Idempotency-Key')
    ) {
        requestHeaders.set('Idempotency-Key', createIdempotencyKey())
    }

    if (isMockMode()) {
        const { mockApiRequest } = await loadMockApi()
        const mockResult = await mockApiRequest(path, {
            method: upperMethod,
            data,
            headers: Object.fromEntries(requestHeaders.entries()),
            token,
            signal,
        })

        return handleApiResult(mockResult.status, mockResult.payload)
    }

    let body

    if (data !== undefined && data !== null) {
        if (isFormData(data) || isUrlSearchParams(data)) {
            body = data
        } else {
            requestHeaders.set('Content-Type', 'application/json')
            body = JSON.stringify(data)
        }
    }

    let response

    try {
        response = await fetch(buildUrl(path), {
            method: upperMethod,
            headers: requestHeaders,
            body,
            signal,
        })
    } catch (error) {
        if (error?.name === 'AbortError') {
            throw error
        }

        throw new ApiRequestError('无法连接后端服务，请确认服务已启动。')
    }

    const payload = await parseResponseBody(response)

    return handleApiResult(response.status, payload)
}

export async function apiGet(path, options = {}) {
    return apiRequest(path, {
        ...options,
        method: 'GET',
    })
}

export async function apiPost(path, data, options = {}) {
    return apiRequest(path, {
        ...options,
        method: 'POST',
        data,
    })
}

export async function apiPut(path, data, options = {}) {
    return apiRequest(path, {
        ...options,
        method: 'PUT',
        data,
    })
}

export async function apiPatch(path, data, options = {}) {
    return apiRequest(path, {
        ...options,
        method: 'PATCH',
        data,
    })
}

export async function apiDelete(path, options = {}) {
    return apiRequest(path, {
        ...options,
        method: 'DELETE',
    })
}

export async function authorizedFetch(path, options = {}) {
    const {
        headers = {},
        auth = true,
        idempotent = false,
        ...fetchOptions
    } = options

    const requestHeaders = new Headers(headers)
    const token = auth ? getAuthToken() : ''
    const method = (fetchOptions.method || 'GET').toUpperCase()

    if (token) {
        requestHeaders.set('Authorization', `Bearer ${token}`)
    }

    if (
        idempotent &&
        ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) &&
        !requestHeaders.has('Idempotency-Key')
    ) {
        requestHeaders.set('Idempotency-Key', createIdempotencyKey())
    }

    if (isMockMode()) {
        const { mockAuthorizedFetch } = await loadMockApi()
        return mockAuthorizedFetch(path, {
            ...fetchOptions,
            method,
            headers: Object.fromEntries(requestHeaders.entries()),
            token,
        })
    }

    try {
        return await fetch(buildUrl(path), {
            ...fetchOptions,
            method,
            headers: requestHeaders,
        })
    } catch (error) {
        if (error?.name === 'AbortError') {
            throw error
        }

        throw new ApiRequestError('无法连接后端服务，请确认服务已启动。')
    }
}
