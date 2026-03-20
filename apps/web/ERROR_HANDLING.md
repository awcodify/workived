# Frontend Error Handling with Details

This guide shows how to use the enhanced error handling that displays contextual details from backend errors.

## Quick Start

### Basic Usage (Backward Compatible)

```tsx
import { extractApiError } from '@/lib/utils/errors'
import { ErrorBanner } from '@/components/ui'

function MyComponent() {
  const mutation = useMutation(...)
  const apiError = extractApiError(mutation.error)
  
  return (
    <div>
      {apiError && <ErrorBanner message={apiError} />}
    </div>
  )
}
```

### Enhanced Usage (With Details)

```tsx
import { extractApiErrorDetails } from '@/lib/utils/errors'
import { ErrorBanner } from '@/components/ui'

function MyComponent() {
  const mutation = useMutation(...)
  const errorDetails = extractApiErrorDetails(mutation.error)
  
  return (
    <div>
      {errorDetails && <ErrorBanner error={errorDetails} />}
    </div>
  )
}
```

## Examples

### Claims: Insufficient Budget

**Backend Error:**
```json
{
  "error": {
    "code": "INSUFFICIENT_BUDGET",
    "message": "Claim amount exceeds available category budget",
    "details": {
      "limit": 5000000,
      "spent": 4800000,
      "requested": 500000,
      "remaining": 200000,
      "currency": "IDR"
    }
  }
}
```

**Frontend Display:**
```
⚠️ Claim amount exceeds available category budget
Details:
Limit: 5,000,000
Spent: 4,800,000
Requested: 500,000
Remaining: 200,000
Currency: IDR
```

### Leave: Insufficient Balance

**Backend Error:**
```json
{
  "error": {
    "code": "INSUFFICIENT_BALANCE",
    "message": "Not enough leave balance",
    "details": {
      "available": 5,
      "requested": 7
    }
  }
}
```

**Frontend Display:**
```
⚠️ Not enough leave balance
Details:
Available: 5
Requested: 7
```

### Leave: Overlapping Request

**Backend Error:**
```json
{
  "error": {
    "code": "OVERLAPPING_REQUEST",
    "message": "Leave request overlaps with existing approved request",
    "details": {
      "start_date": "2026-03-25",
      "end_date": "2026-03-27"
    }
  }
}
```

**Frontend Display:**
```
⚠️ Leave request overlaps with existing approved request
Details:
Start date: 2026-03-25
End date: 2026-03-27
```

## Migration Guide

To migrate existing error handling:

### Before:
```tsx
const apiError = extractApiError(mutation.error)
{apiError && <ErrorBanner message={apiError} />}
```

### After (Option 1 - No Code Change):
The old pattern still works! `extractApiError` is now a wrapper around `extractApiErrorDetails`.

### After (Option 2 - Enhanced):
```tsx
const errorDetails = extractApiErrorDetails(mutation.error)
{errorDetails && <ErrorBanner error={errorDetails} />}
```

## API Reference

### `extractApiError(error: unknown): string | undefined`
- **Deprecated but still supported**
- Returns just the error message string
- Backward compatible with existing code

### `extractApiErrorDetails(error: unknown): ApiErrorDetails | undefined`
- **New recommended approach**
- Returns `{ message: string, details?: Record<string, any> }`
- Provides richer context when backend sends Details field

### `<ErrorBanner>`
Props:
- `message?: string` - Simple error message (backward compatible)
- `error?: ApiErrorDetails` - Rich error with details

Behavior:
- If `error` prop is provided, uses `error.message` and displays `error.details`
- If only `message` prop is provided, displays simple error
- Automatically formats numbers with thousand separators
- Converts underscored keys to readable text (e.g., `start_date` → "Start date")

## Testing

```tsx
import { render, screen } from '@testing-library/react'
import { ErrorBanner } from '@/components/ui'

test('displays error with details', () => {
  render(
    <ErrorBanner
      error={{
        message: 'Insufficient balance',
        details: {
          available: 5,
          requested: 7,
        },
      }}
    />
  )
  expect(screen.getByText('Insufficient balance')).toBeInTheDocument()
  expect(screen.getByText('Available:')).toBeInTheDocument()
  expect(screen.getByText('5')).toBeInTheDocument()
})
```
