import { apiPost } from './request'

export async function uploadSingleFile(file, bizType = 'assistant') {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('biz_type', bizType)

    const response = await apiPost('/api/uploads', formData)
    return response.data || {}
}
