import { describe, test, expect } from 'vitest'
import { AxiosError, AxiosHeaders } from 'axios'
import { extractApiError } from './errors'

describe('extractApiError', () => {
  test('extracts message from AxiosError response', () => {
    const error = new AxiosError('Request failed', '400', undefined, undefined, {
      status: 400,
      statusText: 'Bad Request',
      headers: {},
      config: { headers: new AxiosHeaders() },
      data: { error: { message: 'Email already exists' } },
    })
    expect(extractApiError(error)).toBe('Email already exists')
  })

  test('returns undefined for AxiosError without error message in data', () => {
    const error = new AxiosError('Request failed', '500', undefined, undefined, {
      status: 500,
      statusText: 'Internal Server Error',
      headers: {},
      config: { headers: new AxiosHeaders() },
      data: {},
    })
    expect(extractApiError(error)).toBeUndefined()
  })

  test('returns undefined for AxiosError without response', () => {
    const error = new AxiosError('Network Error')
    expect(extractApiError(error)).toBeUndefined()
  })

  test('returns undefined for non-AxiosError', () => {
    expect(extractApiError(new Error('generic error'))).toBeUndefined()
  })

  test('returns undefined for null/undefined', () => {
    expect(extractApiError(null)).toBeUndefined()
    expect(extractApiError(undefined)).toBeUndefined()
  })

  test('returns undefined for string error', () => {
    expect(extractApiError('something went wrong')).toBeUndefined()
  })
})
