import { apiClient } from './client'
import type {
  TaskList,
  Task,
  TaskWithDetails,
  TaskComment,
  TaskCommentWithAuthor,
  CreateTaskListInput,
  UpdateTaskListInput,
  CreateTaskInput,
  UpdateTaskInput,
  MoveTaskInput,
  CreateTaskCommentInput,
  TaskFilters,
  ApiResponse,
  CursorMeta,
} from '@/types/api'

// ── Response Types ───────────────────────────────────────────
interface TaskListResponse {
  data: TaskList[]
  meta?: CursorMeta
}

interface TaskResponse {
  data: TaskWithDetails[]
  meta?: CursorMeta
}

interface CommentResponse {
  data: TaskCommentWithAuthor[]
  meta?: CursorMeta
}

// ── API Client ───────────────────────────────────────────────
export const tasksApi = {
  // ── Task Lists ─────────────────────────────────────────────
  listTaskLists: () =>
    apiClient.get<TaskListResponse>('/api/v1/tasks/lists'),

  createTaskList: (data: CreateTaskListInput) =>
    apiClient.post<ApiResponse<TaskList>>('/api/v1/tasks/lists', data),

  updateTaskList: (id: string, data: UpdateTaskListInput) =>
    apiClient.put<ApiResponse<TaskList>>(`/api/v1/tasks/lists/${id}`, data),

  deleteTaskList: (id: string) =>
    apiClient.delete(`/api/v1/tasks/lists/${id}`),

  // ── Tasks ──────────────────────────────────────────────────
  listTasks: (filters?: TaskFilters) =>
    apiClient.get<TaskResponse>('/api/v1/tasks', { params: filters }),

  getTask: (id: string) =>
    apiClient.get<ApiResponse<TaskWithDetails>>(`/api/v1/tasks/${id}`),

  createTask: (data: CreateTaskInput) =>
    apiClient.post<ApiResponse<Task>>('/api/v1/tasks', data),

  updateTask: (id: string, data: UpdateTaskInput) =>
    apiClient.put<ApiResponse<Task>>(`/api/v1/tasks/${id}`, data),

  moveTask: (id: string, data: MoveTaskInput) =>
    apiClient.put<ApiResponse<Task>>(`/api/v1/tasks/${id}/move`, data),

  toggleTaskCompletion: (id: string) =>
    apiClient.put<ApiResponse<Task>>(`/api/v1/tasks/${id}/complete`),

  deleteTask: (id: string) =>
    apiClient.delete(`/api/v1/tasks/${id}`),

  // ── Comments ───────────────────────────────────────────────
  listComments: (taskId: string) =>
    apiClient.get<CommentResponse>(`/api/v1/tasks/${taskId}/comments`),

  createComment: (taskId: string, data: CreateTaskCommentInput) =>
    apiClient.post<ApiResponse<TaskComment>>(
      `/api/v1/tasks/${taskId}/comments`,
      data,
    ),

  deleteComment: (taskId: string, commentId: string) =>
    apiClient.delete(`/api/v1/tasks/${taskId}/comments/${commentId}`),
}
