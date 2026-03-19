import { AxiosError } from 'axios'

interface ApiErrorShape {
  error?: { message?: string }
}

export function extractApiError(error: unknown): string | undefined {
  if (error instanceof AxiosError) {
    return (error.response?.data as ApiErrorShape | undefined)?.error?.message
  }
  return undefined
}
