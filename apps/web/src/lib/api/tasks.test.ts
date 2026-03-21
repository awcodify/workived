import { describe, it, expect, vi, beforeEach } from 'vitest'
import { tasksApi } from './tasks'
import { apiClient } from './client'

// Mock the API client
vi.mock('./client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}))

describe('tasksApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Task Lists', () => {
    it('should list task lists', async () => {
      const mockData = { data: [] }
      vi.mocked(apiClient.get).mockResolvedValue({ data: mockData })

      await tasksApi.listTaskLists()

      expect(apiClient.get).toHaveBeenCalledWith('/api/v1/tasks/lists')
    })

    it('should create task list', async () => {
      const mockData = { data: { id: '1', name: 'To Do' } }
      vi.mocked(apiClient.post).mockResolvedValue({ data: mockData })

      await tasksApi.createTaskList({ name: 'To Do' })

      expect(apiClient.post).toHaveBeenCalledWith('/api/v1/tasks/lists', { name: 'To Do' })
    })

    it('should update task list', async () => {
      const id = 'list-1'
      const mockData = { data: { id, name: 'Done' } }
      vi.mocked(apiClient.put).mockResolvedValue({ data: mockData })

      await tasksApi.updateTaskList(id, { name: 'Done' })

      expect(apiClient.put).toHaveBeenCalledWith(`/api/v1/tasks/lists/${id}`, { name: 'Done' })
    })

    it('should delete task list', async () => {
      const id = 'list-1'
      vi.mocked(apiClient.delete).mockResolvedValue({ data: null })

      await tasksApi.deleteTaskList(id)

      expect(apiClient.delete).toHaveBeenCalledWith(`/api/v1/tasks/lists/${id}`)
    })
  })

  describe('Tasks', () => {
    it('should list tasks', async () => {
      const mockData = { data: [] }
      vi.mocked(apiClient.get).mockResolvedValue({ data: mockData })

      await tasksApi.listTasks()

      expect(apiClient.get).toHaveBeenCalledWith('/api/v1/tasks', { params: undefined })
    })

    it('should list tasks with filters', async () => {
      const mockData = { data: [] }
      vi.mocked(apiClient.get).mockResolvedValue({ data: mockData })

      await tasksApi.listTasks({ task_list_id: 'list-1' })

      expect(apiClient.get).toHaveBeenCalledWith('/api/v1/tasks', {
        params: { task_list_id: 'list-1' },
      })
    })

    it('should get task by id', async () => {
      const id = 'task-1'
      const mockData = { data: { id, title: 'Test Task' } }
      vi.mocked(apiClient.get).mockResolvedValue({ data: mockData })

      await tasksApi.getTask(id)

      expect(apiClient.get).toHaveBeenCalledWith(`/api/v1/tasks/${id}`)
    })

    it('should create task', async () => {
      const mockData = { data: { id: 'task-1', title: 'New Task' } }
      vi.mocked(apiClient.post).mockResolvedValue({ data: mockData })

      const input = { task_list_id: 'list-1', title: 'New Task' }
      await tasksApi.createTask(input)

      expect(apiClient.post).toHaveBeenCalledWith('/api/v1/tasks', input)
    })

    it('should update task', async () => {
      const id = 'task-1'
      const mockData = { data: { id, title: 'Updated Task' } }
      vi.mocked(apiClient.put).mockResolvedValue({ data: mockData })

      await tasksApi.updateTask(id, { title: 'Updated Task' })

      expect(apiClient.put).toHaveBeenCalledWith(`/api/v1/tasks/${id}`, { title: 'Updated Task' })
    })

    it('should move task', async () => {
      const id = 'task-1'
      const mockData = { data: { id } }
      vi.mocked(apiClient.put).mockResolvedValue({ data: mockData })

      await tasksApi.moveTask(id, { task_list_id: 'list-2', position: 1000 })

      expect(apiClient.put).toHaveBeenCalledWith(`/api/v1/tasks/${id}/move`, {
        task_list_id: 'list-2',
        position: 1000,
      })
    })

    it('should toggle task completion', async () => {
      const id = 'task-1'
      const mockData = { data: { id } }
      vi.mocked(apiClient.put).mockResolvedValue({ data: mockData })

      await tasksApi.toggleTaskCompletion(id)

      expect(apiClient.put).toHaveBeenCalledWith(`/api/v1/tasks/${id}/complete`)
    })

    it('should delete task', async () => {
      const id = 'task-1'
      vi.mocked(apiClient.delete).mockResolvedValue({ data: null })

      await tasksApi.deleteTask(id)

      expect(apiClient.delete).toHaveBeenCalledWith(`/api/v1/tasks/${id}`)
    })
  })

  describe('Comments', () => {
    it('should list comments', async () => {
      const taskId = 'task-1'
      const mockData = { data: [] }
      vi.mocked(apiClient.get).mockResolvedValue({ data: mockData })

      await tasksApi.listComments(taskId)

      expect(apiClient.get).toHaveBeenCalledWith(`/api/v1/tasks/${taskId}/comments`)
    })

    it('should create comment', async () => {
      const taskId = 'task-1'
      const mockData = { data: { id: 'comment-1', body: 'Test comment' } }
      vi.mocked(apiClient.post).mockResolvedValue({ data: mockData })

      await tasksApi.createComment(taskId, { body: 'Test comment' })

      expect(apiClient.post).toHaveBeenCalledWith(`/api/v1/tasks/${taskId}/comments`, {
        body: 'Test comment',
      })
    })

    it('should create nested comment', async () => {
      const taskId = 'task-1'
      const mockData = { data: { id: 'comment-2', body: 'Reply', parent_id: 'comment-1' } }
      vi.mocked(apiClient.post).mockResolvedValue({ data: mockData })

      await tasksApi.createComment(taskId, {
        body: 'Reply',
        parent_id: 'comment-1',
        content_type: 'markdown',
      })

      expect(apiClient.post).toHaveBeenCalledWith(`/api/v1/tasks/${taskId}/comments`, {
        body: 'Reply',
        parent_id: 'comment-1',
        content_type: 'markdown',
      })
    })

    it('should delete comment', async () => {
      const taskId = 'task-1'
      const commentId = 'comment-1'
      vi.mocked(apiClient.delete).mockResolvedValue({ data: null })

      await tasksApi.deleteComment(taskId, commentId)

      expect(apiClient.delete).toHaveBeenCalledWith(
        `/api/v1/tasks/${taskId}/comments/${commentId}`
      )
    })
  })

  describe('Reactions', () => {
    it('should toggle reaction', async () => {
      const taskId = 'task-1'
      const commentId = 'comment-1'
      const emoji = '👍'
      const mockData = { data: { added: true, emoji } }
      vi.mocked(apiClient.post).mockResolvedValue({ data: mockData })

      await tasksApi.toggleReaction(taskId, commentId, emoji)

      expect(apiClient.post).toHaveBeenCalledWith(
        `/api/v1/tasks/${taskId}/comments/${commentId}/reactions`,
        { emoji }
      )
    })

    it('should list reactions', async () => {
      const taskId = 'task-1'
      const commentId = 'comment-1'
      const mockData = {
        data: [
          { emoji: '👍', count: 3, user_reacted: true },
          { emoji: '❤️', count: 1, user_reacted: false },
        ],
      }
      vi.mocked(apiClient.get).mockResolvedValue({ data: mockData })

      await tasksApi.listReactions(taskId, commentId)

      expect(apiClient.get).toHaveBeenCalledWith(
        `/api/v1/tasks/${taskId}/comments/${commentId}/reactions`
      )
    })
  })
})
