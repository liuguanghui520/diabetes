import { describe, expect, it } from 'vitest'
import { errors } from '../../src/http/errors.js'
import { buildPublicFileUrl } from '../../src/modules/uploads/routes.js'

// We test the resolveOwnedUpload and sanitizeAttachmentPayload functions
// by mocking the store dependency
describe('uploads', () => {
  describe('resolveOwnedUpload', () => {
    // Import the actual function — we import indirectly via sanitizeAttachmentPayload
    // to avoid module-level side effects
    it('returns storage_path when present in db record', async () => {
      // Dynamically import to avoid issues with module-level multer init
      const { sanitizeAttachmentPayload } = await import('../../src/modules/uploads/routes.js')

      const mockStore = {
        getUploadByFileId: async () => ({
          file_id: 'file_abc123',
          file_name: 'report.pdf',
          stored_name: 'uuid-report.pdf',
          mime_type: 'application/pdf',
          size_bytes: 102400,
          url: '/api/uploads/file_abc123',
          storage_path: '/data/files/uuid-report.pdf',
          biz_type: 'report'
        })
      }

      const result = await sanitizeAttachmentPayload(mockStore, 'user-1', [
        { file_id: 'file_abc123' }
      ])

      expect(result).toHaveLength(1)
      expect(result[0].file_id).toBe('file_abc123')
      expect(result[0].storage_path).toBe('/data/files/uuid-report.pdf')
      expect(result[0].file_name).toBe('report.pdf')
      expect(result[0].mime_type).toBe('application/pdf')
      expect(result[0].size).toBe(102400)
    })

    it('returns null storage_path when not in db', async () => {
      const { sanitizeAttachmentPayload } = await import('../../src/modules/uploads/routes.js')

      const mockStore = {
        getUploadByFileId: async () => ({
          file_id: 'file_no_path',
          file_name: 'no-path.pdf',
          stored_name: 'no-path-uuid.pdf',
          mime_type: 'application/pdf',
          size_bytes: 500,
          url: '/api/uploads/file_no_path',
          // No storage_path
          biz_type: 'report'
        })
      }

      const result = await sanitizeAttachmentPayload(mockStore, 'user-1', [
        { file_id: 'file_no_path' }
      ])

      expect(result[0].storage_path).toBeNull()
    })

    it('throws not found when file does not exist', async () => {
      const { sanitizeAttachmentPayload } = await import('../../src/modules/uploads/routes.js')

      const mockStore = {
        getUploadByFileId: async () => null
      }

      await expect(
        sanitizeAttachmentPayload(mockStore, 'user-1', [{ file_id: 'nonexistent' }])
      ).rejects.toThrow('附件不存在')
    })

    it('handles attachments without file_id as plain metadata', async () => {
      const { sanitizeAttachmentPayload } = await import('../../src/modules/uploads/routes.js')

      const mockStore = {
        getUploadByFileId: async () => null
      }

      const result = await sanitizeAttachmentPayload(mockStore, 'user-1', [
        { name: 'plain.txt', type: 'text/plain', size: 100 }
      ])

      expect(result).toHaveLength(1)
      expect(result[0].file_name).toBe('plain.txt')
      expect(result[0].mime_type).toBe('text/plain')
      expect(result[0].size).toBe(100)
      // No storage_path for plain metadata
      expect(result[0].storage_path).toBeUndefined()
    })

    it('handles empty attachments array', async () => {
      const { sanitizeAttachmentPayload } = await import('../../src/modules/uploads/routes.js')
      const mockStore = { getUploadByFileId: async () => null }

      const result = await sanitizeAttachmentPayload(mockStore, 'user-1', [])
      expect(result).toEqual([])
    })
  })

  describe('buildPublicFileUrl', () => {
    const cfg = { upload: { publicBaseUrl: 'http://cdn.example.com' } }

    it('uses public-uploads for avatar', () => {
      const url = buildPublicFileUrl(cfg, 'file_x', 'avatar')
      expect(url).toContain('/public-uploads/')
      expect(url).toContain('cdn.example.com')
    })

    it('uses public-uploads for cover', () => {
      const url = buildPublicFileUrl(cfg, 'file_x', 'cover')
      expect(url).toContain('/public-uploads/')
    })

    it('uses regular uploads for report', () => {
      const url = buildPublicFileUrl(cfg, 'file_x', 'report')
      expect(url).not.toContain('public-uploads')
      expect(url).toContain('/api/uploads/')
    })

    it('uses regular uploads for assistant', () => {
      const url = buildPublicFileUrl(cfg, 'file_x', 'assistant')
      expect(url).toContain('/api/uploads/')
    })

    it('returns relative path when no base URL', () => {
      const url = buildPublicFileUrl({ upload: {} }, 'file_x', 'avatar')
      expect(url).toBe('/api/public-uploads/file_x')
    })

    it('returns relative path for private file with no base', () => {
      const url = buildPublicFileUrl({ upload: {} }, 'file_x', 'report')
      expect(url).toBe('/api/uploads/file_x')
    })
  })
})
