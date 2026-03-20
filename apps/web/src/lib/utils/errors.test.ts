import { describe, test, expect } from 'vitest'
import { AxiosError, AxiosHeaders } from 'axios'
import { extractApiError, extractApiErrorDetails } from './errors'

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

describe('extractApiErrorDetails', () => {
  test('extracts message and details from AxiosError response', () => {
    const error = new AxiosError('Request failed', '400', undefined, undefined, {
      status: 400,
      statusText: 'Bad Request',
      headers: {},
      config: { headers: new AxiosHeaders() },
      data: {
        error: {
          message: 'Insufficient claim budget',
          details: {
            limit: 5000000,
            spent: 4800000,
            requested: 500000,
            remaining: 200000,
            currency: 'IDR',
          },
        },
      },
    })
    const result = extractApiErrorDetails(error)
    expect(result?.message).toBe('Insufficient claim budget')
    expect(result?.details).toEqual({
      limit: 5000000,
      spent: 4800000,
      requested: 500000,
      remaining: 200000,
      currency: 'IDR',
    })
  })

  test('extracts message without details', () => {
    const error = new AxiosError('Request failed', '400', undefined, undefined, {
      status: 400,
      statusText: 'Bad Request',
      headers: {},
      config: { headers: new AxiosHeaders() },
      data: { error: { message: 'Email already exists' } },
    })
    const result = extractApiErrorDetails(error)
    expect(result?.message).toBe('Email already exists')
    expect(result?.details).toBeUndefined()
  })

  test('returns undefined when no error message', () => {
    const error = new AxiosError('Request failed', '500', undefined, undefined, {
      status: 500,
      statusText: 'Internal Server Error',
      headers: {},
      config: { headers: new AxiosHeaders() },
      data: {},
    })
    expect(extractApiErrorDetails(error)).toBeUndefined()
  })

  test('returns undefined for non-AxiosError', () => {
    expect(extractApiErrorDetails(new Error('generic error'))).toBeUndefined()
  })
})
