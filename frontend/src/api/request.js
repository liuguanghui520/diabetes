const TOKEN_KEY = 'diabetesAuthToken'
const USER_KEY = 'diabetesAuthUser'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')

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

function normalizeUserFacingMessage(status, businessCode, payload) {
    const rawMessage = String(payload?.message || '').trim()

    if (status === 404 || businessCode === 40401) {
        return '你要找的内容暂时没找到，请检查输入信息后再试。'
    }

    if (status === 400 || [40001, 40002, 40003].includes(businessCode)) {
        return '提交的信息不完整或格式不对，请检查后重试。'
    }

    if (status === 401 || businessCode === 40101) {
        // 如果服务端已经给出了具体的错误原因（如"账号或密码错误"），优先保留原文
        if (rawMessage && !/未登录|Token.?失效|token.?失效/i.test(rawMessage)) {
            return rawMessage
        }

        return '登录状态已失效，请重新登录后再试。'
    }

    if (status === 403 || [40301, 40302].includes(businessCode)) {
        return '当前操作暂时不可用，请检查权限或稍后再试。'
    }

    if (status === 409 || businessCode === 40901) {
        return '当前内容已发生变化，请刷新后再试。'
    }

    if (status === 429 || [42901, 42902].includes(businessCode)) {
        return '操作太频繁了，请稍等一下再试。'
    }

    if (status >= 500 || [50001, 50002, 50201].includes(businessCode)) {
        return '服务暂时有点忙，请稍后再试。'
    }

    if (!rawMessage) {
        return `请求失败，HTTP 状态码：${status}`
    }

    if (/(404|参数错误|not found|invalid|bad request)/i.test(rawMessage)) {
        return '提交的信息不完整或格式不对，请检查后重试。'
    }

    return rawMessage
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
        const message = normalizeUserFacingMessage(status, businessCode, payload)

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

export function updateStoredUser(patch = {}) {
    const current = getStoredUser()

    if (!current) {
        return null
    }

    const nextUser = {
        ...current,
        ...(patch && typeof patch === 'object' ? patch : {}),
    }

    localStorage.setItem(USER_KEY, JSON.stringify(nextUser))
    window.dispatchEvent(
        new CustomEvent('diabetes:auth-changed', {
            detail: {
                loggedIn: true,
                user: nextUser,
            },
        }),
    )

    return nextUser
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

export async function pollWorkflowRun(requestId, {
    intervalMs = 2000,
    timeoutMs = 120000,
    signal,
} = {}) {
    if (!requestId) {
        throw new ApiRequestError('缺少 workflow request_id。')
    }

    const started = Date.now()

    while (Date.now() - started < timeoutMs) {
        if (signal?.aborted) {
            throw new DOMException('Aborted', 'AbortError')
        }

        const response = await apiGet(`/api/workflow-runs/${encodeURIComponent(requestId)}`, {
            signal,
        })
        const data = response.data || {}

        if (data.status === 'succeeded' || data.status === 'failed') {
            return data
        }

        await new Promise((resolve, reject) => {
            const timer = window.setTimeout(resolve, intervalMs)

            signal?.addEventListener('abort', () => {
                window.clearTimeout(timer)
                reject(new DOMException('Aborted', 'AbortError'))
            }, { once: true })
        })
    }

    throw new ApiRequestError('AI 任务仍在处理中，请稍后刷新查看。')
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
