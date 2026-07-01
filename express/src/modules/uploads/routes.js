import fs from 'node:fs'
import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import multer from 'multer'
import { asyncHandler, sendOk } from '../../http/response.js'
import { errors } from '../../http/errors.js'
import { authMiddleware } from '../auth/auth.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const ALLOWED_BIZ_TYPES = new Set(['assistant', 'doctor', 'report', 'avatar'])
const ALLOWED_EXTENSIONS = new Set([
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.csv',
  '.txt',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
])
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'text/plain',
  'image/png',
  'image/jpeg',
  'image/webp',
])

function uploadBaseDir(config) {
  if (config.upload?.storageDir) {
    return path.resolve(config.upload.storageDir)
  }

  if (config.env === 'test') {
    return path.join(os.tmpdir(), 'diabetes-assistant-uploads')
  }

  return path.resolve(__dirname, '..', '..', '..', 'uploads')
}

function buildPublicFileUrl(config, fileId) {
  const base = String(config.upload?.publicBaseUrl || '').trim().replace(/\/$/, '')
  const routePath = `/api/uploads/${encodeURIComponent(fileId)}`

  return base ? `${base}${routePath}` : routePath
}

function sanitizeFilename(name = '') {
  return String(name || 'file')
    .replace(/[\\/:*?"<>|]+/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180) || 'file'
}

function fileExtension(file = {}) {
  return path.extname(file.originalname || '').toLowerCase()
}

function ensureAllowedFile(file = {}) {
  const ext = fileExtension(file)
  const mime = String(file.mimetype || '').toLowerCase()

  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw errors.badRequest('不支持的文件类型。')
  }

  if (mime && !ALLOWED_MIME_TYPES.has(mime)) {
    throw errors.badRequest('不支持的文件类型。')
  }
}

function createUploadMiddleware(config) {
  const baseDir = uploadBaseDir(config)
  fs.mkdirSync(baseDir, { recursive: true })

  const storage = multer.diskStorage({
    destination(_req, _file, callback) {
      callback(null, baseDir)
    },
    filename(_req, file, callback) {
      const ext = fileExtension(file)
      callback(null, `${randomUUID()}${ext}`)
    },
  })

  return multer({
    storage,
    limits: {
      fileSize: 10 * 1024 * 1024,
      files: 1,
    },
    fileFilter(_req, file, callback) {
      try {
        ensureAllowedFile(file)
        callback(null, true)
      } catch (error) {
        callback(error)
      }
    },
  }).single('file')
}

function runUpload(upload) {
  return (req, res, next) => {
    upload(req, res, (error) => {
      if (!error) {
        next()
        return
      }

      if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
          next(errors.badRequest('文件大小不能超过 10MB。'))
          return
        }

        next(errors.badRequest('文件上传失败，请检查文件后重试。'))
        return
      }

      next(error)
    })
  }
}

async function removeUploadedTemp(file) {
  if (!file?.path) {
    return
  }

  try {
    await fsp.unlink(file.path)
  } catch {
    // Ignore cleanup failures for temporary files.
  }
}

async function resolveOwnedUpload(store, userId, fileId) {
  const upload = await store.getUploadByFileId?.(userId, fileId)

  if (!upload) {
    throw errors.notFound('附件不存在或无权访问。')
  }

  return {
    file_id: upload.file_id,
    file_name: upload.file_name,
    stored_name: upload.stored_name,
    mime_type: upload.mime_type,
    size: Number(upload.size_bytes || upload.size || 0),
    url: upload.url,
    storage_path: upload.storage_path || null,
    biz_type: upload.biz_type,
  }
}

export async function sanitizeAttachmentPayload(store, userId, attachments = []) {
  const list = Array.isArray(attachments) ? attachments : []
  const result = []

  for (const item of list) {
    if (item?.file_id) {
      result.push(await resolveOwnedUpload(store, userId, item.file_id))
      continue
    }

    result.push({
      file_name: item?.name || item?.file_name || '',
      mime_type: item?.type || item?.mime_type || '',
      size: Number(item?.size || 0),
    })
  }

  return result
}

export function registerUploadRoutes(router, deps) {
  const auth = authMiddleware(deps)
  const upload = runUpload(createUploadMiddleware(deps.config))

  router.post('/uploads', auth, upload, asyncHandler(async (req, res) => {
    const file = req.file

    if (!file) {
      throw errors.badRequest('请选择要上传的文件。')
    }

    const bizType = ALLOWED_BIZ_TYPES.has(String(req.body?.biz_type || '').trim())
      ? String(req.body.biz_type).trim()
      : 'assistant'
    const fileId = `file_${randomUUID().replace(/-/g, '').slice(0, 24)}`
    const fileName = sanitizeFilename(file.originalname)
    const payload = {
      file_id: fileId,
      user_id: req.user.id,
      biz_type: bizType,
      file_name: fileName,
      stored_name: path.basename(file.filename),
      mime_type: file.mimetype || 'application/octet-stream',
      size_bytes: Number(file.size || 0),
      storage_path: path.resolve(file.path),
      url: buildPublicFileUrl(deps.config, fileId),
    }

    try {
      await deps.store.createUpload?.(payload)
    } catch (error) {
      await removeUploadedTemp(file)
      throw error
    }

    sendOk(res, {
      file_id: payload.file_id,
      file_name: payload.file_name,
      mime_type: payload.mime_type,
      size: payload.size_bytes,
      url: payload.url,
    })
  }))

  router.get('/uploads/:fileId', auth, asyncHandler(async (req, res) => {
    const file = await deps.store.getUploadByFileId?.(req.user.id, req.params.fileId)

    if (!file) {
      throw errors.notFound('附件不存在或无权访问。')
    }

    res.setHeader('Content-Type', file.mime_type || 'application/octet-stream')
    res.setHeader('Content-Length', String(file.size_bytes || 0))
    res.setHeader(
      'Content-Disposition',
      `inline; filename*=UTF-8''${encodeURIComponent(file.file_name || 'file')}`,
    )
    res.sendFile(path.resolve(file.storage_path))
  }))
}
