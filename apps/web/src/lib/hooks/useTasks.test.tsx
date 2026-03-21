import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React, { type ReactNode } from 'react'
import {
  useTaskLists,
  useTasks,
  useTask,
  useTaskComments,
  useCommentReactions,
  useCreateTaskList,
  useCreateTask,
  useUpdateTask,
  useMoveTask,
  useToggleTaskCompletion,
  useDeleteTask,
  useCreateTaskComment,
  useDeleteTaskComment,
  useToggleReaction,
} from './useTasks'
import { tasksApi } from '../api/tasks'

// Mock the API
vi.mock('../api/tasks', () => ({
  tasksApi: {
    listTaskLists: vi.fn(),
    listTasks: vi.fn(),
    getTask: vi.fn(),
    listComments: vi.fn(),
    listReactions: vi.fn(),
    createTaskList: vi.fn(),
    createTask: vi.fn(),
    updateTask: vi.fn(),
    moveTask: vi.fn(),
    toggleTaskCompletion: vi.fn(),
    deleteTask: vi.fn(),
    createComment: vi.fn(),
    deleteComment: vi.fn(),
    toggleReaction: vi.fn(),
  },
}))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
})

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('useTasks hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('useTaskLists', () => {
    it('should fetch task lists', async () => {
      const mockData = [{ id: '1', name: 'To Do' }]
      vi.mocked(tasksApi.listTaskLists).mockResolvedValue({
        data: { data: mockData },
      } as any)

      const { result } = renderHook(() => useTaskLists(), { wrapper })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(result.current.data).toEqual(mockData)
      expect(tasksApi.listTaskLists).toHaveBeenCalled()
    })
  })

  describe('useTasks', () => {
    it('should fetch tasks', async () => {
      const mockData = [{ id: '1', title: 'Task 1' }]
      vi.mocked(tasksApi.listTasks).mockResolvedValue({
        data: { data: mockData },
      } as any)

      const { result } = renderHook(() => useTasks(), { wrapper })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(result.current.data).toEqual(mockData)
      expect(tasksApi.listTasks).toHaveBeenCalledWith(undefined)
    })

    it('should fetch tasks with filters', async () => {
      const mockData = [{ id: '1', title: 'Task 1' }]
      vi.mocked(tasksApi.listTasks).mockResolvedValue({
        data: { data: mockData },
      } as any)

      const { result } = renderHook(() => useTasks({ task_list_id: 'list-1' }), {
        wrapper,
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(tasksApi.listTasks).toHaveBeenCalledWith({ task_list_id: 'list-1' })
    })
  })

  describe('useTask', () => {
    it('should fetch single task', async () => {
      const taskId = 'task-1'
      const mockData = { id: taskId, title: 'Task 1' }
      vi.mocked(tasksApi.getTask).mockResolvedValue({
        data: { data: mockData },
      } as any)

      const { result } = renderHook(() => useTask(taskId), { wrapper })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(result.current.data).toEqual(mockData)
      expect(tasksApi.getTask).toHaveBeenCalledWith(taskId)
    })
  })

  describe('useTaskComments', () => {
    it('should fetch task comments', async () => {
      const taskId = 'task-1'
      const mockData = [{ id: 'comment-1', body: 'Test comment' }]
      vi.mocked(tasksApi.listComments).mockResolvedValue({
        data: { data: mockData },
      } as any)

      const { result } = renderHook(() => useTaskComments(taskId), { wrapper })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(result.current.data).toEqual(mockData)
      expect(tasksApi.listComments).toHaveBeenCalledWith(taskId)
    })
  })

  describe('useCommentReactions', () => {
    it('should fetch comment reactions', async () => {
      const taskId = 'task-1'
      const commentId = 'comment-1'
      const mockData = [{ emoji: '👍', count: 3, user_reacted: true }]
      vi.mocked(tasksApi.listReactions).mockResolvedValue({
        data: { data: mockData },
      } as any)

      const { result } = renderHook(() => useCommentReactions(taskId, commentId), {
        wrapper,
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(result.current.data).toEqual(mockData)
      expect(tasksApi.listReactions).toHaveBeenCalledWith(taskId, commentId)
    })
  })

  describe('Mutations', () => {
    it('should create task list', async () => {
      const mockData = { id: '1', name: 'New List' }
      vi.mocked(tasksApi.createTaskList).mockResolvedValue({
        data: { data: mockData },
      } as any)

      const { result } = renderHook(() => useCreateTaskList(), { wrapper })

      result.current.mutate({ name: 'New List' })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(result.current.data).toEqual(mockData)
      expect(tasksApi.createTaskList).toHaveBeenCalledWith({ name: 'New List' })
    })

    it('should create task', async () => {
      const mockData = { id: 'task-1', title: 'New Task' }
      vi.mocked(tasksApi.createTask).mockResolvedValue({
        data: { data: mockData },
      } as any)

      const { result } = renderHook(() => useCreateTask(), { wrapper })

      const input = { task_list_id: 'list-1', title: 'New Task' }
      result.current.mutate(input)

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(result.current.data).toEqual(mockData)
      expect(tasksApi.createTask).toHaveBeenCalledWith(input)
    })

    it('should update task', async () => {
      const mockData = { id: 'task-1', title: 'Updated' }
      vi.mocked(tasksApi.updateTask).mockResolvedValue({
        data: { data: mockData },
      } as any)

      const { result } = renderHook(() => useUpdateTask(), { wrapper })

      result.current.mutate({ id: 'task-1', data: { title: 'Updated' } })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(tasksApi.updateTask).toHaveBeenCalledWith('task-1', { title: 'Updated' })
    })

    it('should move task', async () => {
      const mockData = { id: 'task-1' }
      vi.mocked(tasksApi.moveTask).mockResolvedValue({
        data: { data: mockData },
      } as any)

      const { result } = renderHook(() => useMoveTask(), { wrapper })

      result.current.mutate({ id: 'task-1', data: { task_list_id: 'list-2', position: 1000 } })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(tasksApi.moveTask).toHaveBeenCalledWith('task-1', {
        task_list_id: 'list-2',
        position: 1000,
      })
    })

    it('should toggle task completion', async () => {
      const mockData = { id: 'task-1', completed_at: new Date().toISOString() }
      vi.mocked(tasksApi.toggleTaskCompletion).mockResolvedValue({
        data: { data: mockData },
      } as any)

      const { result } = renderHook(() => useToggleTaskCompletion(), { wrapper })

      result.current.mutate('task-1')

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(tasksApi.toggleTaskCompletion).toHaveBeenCalledWith('task-1')
    })

    it('should delete task', async () => {
      vi.mocked(tasksApi.deleteTask).mockResolvedValue({ data: null } as any)

      const { result } = renderHook(() => useDeleteTask(), { wrapper })

      result.current.mutate('task-1')

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(tasksApi.deleteTask).toHaveBeenCalledWith('task-1')
    })

    it('should create comment', async () => {
      const mockData = { id: 'comment-1', body: 'New comment' }
      vi.mocked(tasksApi.createComment).mockResolvedValue({
        data: { data: mockData },
      } as any)

      const { result } = renderHook(() => useCreateTaskComment(), { wrapper })

      result.current.mutate({ taskId: 'task-1', data: { body: 'New comment' } })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(tasksApi.createComment).toHaveBeenCalledWith('task-1', { body: 'New comment' })
    })

    it('should delete comment', async () => {
      vi.mocked(tasksApi.deleteComment).mockResolvedValue({ data: null } as any)

      const { result } = renderHook(() => useDeleteTaskComment(), { wrapper })

      result.current.mutate({ taskId: 'task-1', commentId: 'comment-1' })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(tasksApi.deleteComment).toHaveBeenCalledWith('task-1', 'comment-1')
    })

    it('should toggle reaction', async () => {
      const mockData = { added: true, emoji: '👍' }
      vi.mocked(tasksApi.toggleReaction).mockResolvedValue({
        data: { data: mockData },
      } as any)

      const { result } = renderHook(() => useToggleReaction(), { wrapper })

      result.current.mutate({ taskId: 'task-1', commentId: 'comment-1', emoji: '👍' })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(tasksApi.toggleReaction).toHaveBeenCalledWith('task-1', 'comment-1', '👍')
    })
  })
})
