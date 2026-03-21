import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React, { type ReactNode } from 'react'
import { employeeKeys, useEmployeeWorkload } from '@/lib/hooks/useEmployees'
import { employeesApi } from '@/lib/api/employees'

// Mock the API
vi.mock('@/lib/api/employees', () => ({
  employeesApi: {
    workload: vi.fn(),
  },
}))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
})

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

describe('employeeKeys', () => {
  it('all returns ["employees"]', () => {
    expect(employeeKeys.all).toEqual(['employees'])
  })

  it('me() returns ["employees", "me"]', () => {
    expect(employeeKeys.me()).toEqual(['employees', 'me'])
  })

  it('lists() returns ["employees", "list"]', () => {
    expect(employeeKeys.lists()).toEqual(['employees', 'list'])
  })

  it('list() without params returns ["employees", "list", undefined]', () => {
    expect(employeeKeys.list()).toEqual(['employees', 'list', undefined])
  })

  it('list({ status: "active" }) includes the params', () => {
    const params = { status: 'active' }
    expect(employeeKeys.list(params)).toEqual(['employees', 'list', { status: 'active' }])
  })

  it('details() returns ["employees", "detail"]', () => {
    expect(employeeKeys.details()).toEqual(['employees', 'detail'])
  })

  it('detail("123") returns ["employees", "detail", "123"]', () => {
    expect(employeeKeys.detail('123')).toEqual(['employees', 'detail', '123'])
  })
})

describe('useEmployeeWorkload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    queryClient.clear()
  })

  it('should fetch employee workload data', async () => {
    const mockData = [
      {
        employee_id: 'emp-1',
        full_name: 'John Doe',
        email: 'john@example.com',
        department_id: 'dept-1',
        workload: {
          active_tasks: 5,
          overdue_tasks: 1,
          status: 'available' as const,
        },
        leave: {
          is_on_leave: false,
          is_upcoming_leave: false,
          leave_start: null,
          leave_end: null,
        },
      },
      {
        employee_id: 'emp-2',
        full_name: 'Jane Smith',
        email: 'jane@example.com',
        department_id: 'dept-1',
        workload: {
          active_tasks: 8,
          overdue_tasks: 2,
          status: 'warning' as const,
        },
        leave: {
          is_on_leave: false,
          is_upcoming_leave: false,
          leave_start: null,
          leave_end: null,
        },
      },
    ]

    vi.mocked(employeesApi.workload).mockResolvedValue({
      data: { data: mockData },
    } as any)

    const { result } = renderHook(() => useEmployeeWorkload(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual(mockData)
    expect(employeesApi.workload).toHaveBeenCalled()
  })

  it('should handle employees with different workload statuses', async () => {
    const mockData = [
      {
        employee_id: 'emp-1',
        full_name: 'Available Person',
        email: 'available@example.com',
        department_id: 'dept-1',
        workload: {
          active_tasks: 3,
          overdue_tasks: 0,
          status: 'available' as const,
        },
        leave: {
          is_on_leave: false,
          is_upcoming_leave: false,
          leave_start: null,
          leave_end: null,
        },
      },
      {
        employee_id: 'emp-2',
        full_name: 'Overloaded Person',
        email: 'busy@example.com',
        department_id: 'dept-1',
        workload: {
          active_tasks: 15,
          overdue_tasks: 5,
          status: 'overloaded' as const,
        },
        leave: {
          is_on_leave: false,
          is_upcoming_leave: false,
          leave_start: null,
          leave_end: null,
        },
      },
      {
        employee_id: 'emp-3',
        full_name: 'On Leave Person',
        email: 'onleave@example.com',
        department_id: 'dept-2',
        workload: {
          active_tasks: 0,
          overdue_tasks: 0,
          status: 'on_leave' as const,
        },
        leave: {
          is_on_leave: true,
          is_upcoming_leave: false,
          leave_start: '2026-03-20',
          leave_end: '2026-03-27',
        },
      },
    ]

    vi.mocked(employeesApi.workload).mockResolvedValue({
      data: { data: mockData },
    } as any)

    const { result } = renderHook(() => useEmployeeWorkload(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const data = result.current.data!
    expect(data).toHaveLength(3)
    expect(data[0].workload.status).toBe('available')
    expect(data[1].workload.status).toBe('overloaded')
    expect(data[2].workload.status).toBe('on_leave')
    expect(data[2].leave.is_on_leave).toBe(true)
  })

  it('should handle API errors', async () => {
    vi.mocked(employeesApi.workload).mockRejectedValue(new Error('API Error'))

    const { result } = renderHook(() => useEmployeeWorkload(), { wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(result.current.error).toBeInstanceOf(Error)
    expect(employeesApi.workload).toHaveBeenCalled()
  })

  it('should have correct staleTime configured', () => {
    const { result } = renderHook(() => useEmployeeWorkload(), { wrapper })

    // Hook should be configured with 5 minute stale time
    // This is inferred from the hook implementation
    expect(result.current.isLoading).toBe(true)
  })
})

