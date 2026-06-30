import {
    ApiRequestError,
    apiPost,
    clearAuthSession,
    saveAuthSession,
} from './request'

function validateAccount(account) {
    const value = String(account || '').trim()

    if (!value) {
        throw new ApiRequestError('请输入账号。')
    }

    return value
}

function validatePassword(password) {
    const value = String(password || '')

    if (!value) {
        throw new ApiRequestError('请输入密码。')
    }

    return value
}

export async function loginByPassword(account, password) {
    clearAuthSession()

    const response = await apiPost(
        '/api/auth/login',
        {
            account: validateAccount(account),
            password: validatePassword(password),
        },
        {
            auth: false,
        },
    )

    saveAuthSession(response.data)

    return response.data
}

export async function registerByPassword({
    username,
    password,
    nickname,
}) {
    const finalUsername = validateAccount(username)
    const finalPassword = validatePassword(password)

    if (finalPassword.length < 6) {
        throw new ApiRequestError('密码至少需要 6 位。')
    }

    const response = await apiPost(
        '/api/auth/register',
        {
            username: finalUsername,
            password: finalPassword,
            nickname: String(nickname || finalUsername).trim() || finalUsername,
        },
        {
            auth: false,
        },
    )

    saveAuthSession(response.data)

    return response.data
}

export function logout() {
    clearAuthSession()
}
