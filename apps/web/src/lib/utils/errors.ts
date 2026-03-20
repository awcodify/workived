import { AxiosError } from 'axios'

interface ApiErrorShape {
  error?: {
    message?: string
    details?: Record<string, any>
  }
}

export interface ApiErrorDetails {
  message: string
  details?: Record<string, any>
}

/**
 * Extracts error message from Axios error response.
 * @deprecated Use extractApiErrorDetails for richer error information
 */
export function extractApiError(error: unknown): string | undefined {
  const details = extractApiErrorDetails(error)
  return details?.message
}

/**
 * Extracts full error details (message + contextual details) from Axios error response.
 * Returns undefined if error is not an AxiosError or doesn't have error data.
 */
export function extractApiErrorDetails(error: unknown): ApiErrorDetails | undefined {
  if (error instanceof AxiosError) {
    const errorData = (error.response?.data as ApiErrorShape | undefined)?.error
    if (errorData?.message) {
      return {
        message: errorData.message,
        details: errorData.details,
      }
    }
  }
  return undefined
}
