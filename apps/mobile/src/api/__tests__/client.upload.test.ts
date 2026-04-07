/**
 * Tests for the uploadPhoto helper added to ApiClient.
 * The api/client.ts file itself is excluded from coverage thresholds (jest.config.js)
 * but we test the new upload logic here to validate behaviour.
 */

// Mock axios so no real HTTP is made
jest.mock('axios', () => {
  const mockPost = jest.fn()
  return {
    create: () => ({
      post: mockPost,
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() },
      },
    }),
    __mockPost: mockPost,
  }
})

// Mock expo-secure-store
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue('mock-token'),
  deleteItemAsync: jest.fn(),
}))

// Mock global fetch used for S3 PUT upload
const mockFetch = jest.fn()
global.fetch = mockFetch

// Mock XMLHttpRequest used to read local file:// URIs in React Native
const mockXHRSend = jest.fn()
const mockXHROpen = jest.fn()
let xhrLoadCallback: (() => void) | null = null
let xhrErrorCallback: (() => void) | null = null
const mockXHR = {
  open: mockXHROpen,
  send: mockXHRSend.mockImplementation(() => {
    // Simulate async blob load
    if (xhrLoadCallback) setTimeout(xhrLoadCallback, 0)
  }),
  set onload(fn: () => void) { xhrLoadCallback = fn },
  set onerror(fn: () => void) { xhrErrorCallback = fn },
  responseType: '',
  response: null as Blob | null,
}
global.XMLHttpRequest = jest.fn(() => mockXHR) as any

describe('ApiClient.uploadPhoto', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    xhrLoadCallback = null
    xhrErrorCallback = null
    mockXHR.response = null
  })

  function setupXHRBlob(blob: Blob) {
    mockXHRSend.mockImplementationOnce(() => {
      mockXHR.response = blob
      if (xhrLoadCallback) setTimeout(xhrLoadCallback, 0)
    })
  }

  it('uses XHR to read local URI and PUTs blob to presigned URL', async () => {
    const axios = require('axios')
    const mockPost = axios.__mockPost as jest.Mock

    mockPost.mockResolvedValueOnce({
      data: {
        data: {
          upload_url: 'https://s3.example.com/presigned-put',
          key: 'org-id/attendance/emp-id/clock_in_20260407-090000.jpg',
        },
      },
    })

    const mockBlob = new Blob(['photo-data'], { type: 'image/jpeg' })
    setupXHRBlob(mockBlob)
    mockFetch.mockResolvedValueOnce({ ok: true }) // S3 PUT

    const { apiClient } = require('@/api/client')
    const key = await apiClient.uploadPhoto('file:///local/photo.jpg', 'clock_in')

    expect(key).toBe('org-id/attendance/emp-id/clock_in_20260407-090000.jpg')

    expect(mockPost).toHaveBeenCalledWith('/uploads/presign', {
      purpose: 'clock_in',
      content_type: 'image/jpeg',
    })

    // XHR opened against the local URI
    expect(mockXHROpen).toHaveBeenCalledWith('GET', 'file:///local/photo.jpg')

    // S3 PUT called with presigned URL and blob
    expect(mockFetch).toHaveBeenCalledWith(
      'https://s3.example.com/presigned-put',
      expect.objectContaining({
        method: 'PUT',
        headers: { 'Content-Type': 'image/jpeg' },
        body: mockBlob,
      })
    )
  })

  it('returns the key for clock_out purpose', async () => {
    const axios = require('axios')
    const mockPost = axios.__mockPost as jest.Mock

    mockPost.mockResolvedValueOnce({
      data: {
        data: {
          upload_url: 'https://s3.example.com/presigned-put',
          key: 'org-id/attendance/emp-id/clock_out_20260407-180000.jpg',
        },
      },
    })

    const mockBlob = new Blob(['photo'], { type: 'image/jpeg' })
    setupXHRBlob(mockBlob)
    mockFetch.mockResolvedValueOnce({ ok: true })

    const { apiClient } = require('@/api/client')
    const key = await apiClient.uploadPhoto('file:///local/photo.jpg', 'clock_out')

    expect(key).toBe('org-id/attendance/emp-id/clock_out_20260407-180000.jpg')
    expect(mockPost).toHaveBeenCalledWith('/uploads/presign', {
      purpose: 'clock_out',
      content_type: 'image/jpeg',
    })
  })

  it('throws when presign request fails', async () => {
    const axios = require('axios')
    const mockPost = axios.__mockPost as jest.Mock
    mockPost.mockRejectedValueOnce(new Error('network error'))

    const { apiClient } = require('@/api/client')
    await expect(apiClient.uploadPhoto('file:///local/photo.jpg', 'clock_in')).rejects.toThrow(
      'network error'
    )
  })

  it('throws when XHR fails to read local file', async () => {
    const axios = require('axios')
    const mockPost = axios.__mockPost as jest.Mock

    mockPost.mockResolvedValueOnce({
      data: {
        data: {
          upload_url: 'https://s3.example.com/presigned-put',
          key: 'some-key.jpg',
        },
      },
    })

    // Simulate XHR error
    mockXHRSend.mockImplementationOnce(() => {
      if (xhrErrorCallback) setTimeout(xhrErrorCallback, 0)
    })

    const { apiClient } = require('@/api/client')
    await expect(apiClient.uploadPhoto('file:///bad/path.jpg', 'clock_in')).rejects.toThrow(
      'Failed to read photo from local URI'
    )
  })
})
