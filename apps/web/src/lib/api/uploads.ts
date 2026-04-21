import { apiClient } from './client'
import type { ApiResponse } from '@/types/api'

export interface PresignRequest {
  content_type: string
  purpose: 'clock_in' | 'clock_out' | 'task_attachment' | 'comment_attachment'
}

export interface PresignResponse {
  upload_url: string  // Presigned PUT URL for uploading (15min expiry)
  key: string         // Storage key
  public_url: string  // Public GET URL for accessing the uploaded file
}

export const uploadsApi = {
  /**
   * Get a presigned URL for uploading images
   */
  getPresignedUrl: (data: PresignRequest) =>
    apiClient.post<ApiResponse<PresignResponse>>('/api/v1/uploads/presign', data),

  /**
   * Upload image file to presigned URL
   */
  uploadToPresignedUrl: async (url: string, file: File, contentType: string) => {
    return fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
      },
      body: file,
    })
  },

  /**
   * Full flow: get presigned URL and upload file
   * Returns the public URL for accessing the uploaded file
   */
  uploadImage: async (file: File, purpose: PresignRequest['purpose']): Promise<string> => {
    const contentType = file.type
    
    // Get presigned URL
    const presignResponse = await apiClient.post<ApiResponse<PresignResponse>>(
      '/api/v1/uploads/presign',
      {
        content_type: contentType,
        purpose,
      }
    )

    const { upload_url, public_url } = presignResponse.data.data

    // Upload file to presigned URL
    await fetch(upload_url, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
      },
      body: file,
    })

    // Return the public URL provided by the backend
    return public_url
  },
}
