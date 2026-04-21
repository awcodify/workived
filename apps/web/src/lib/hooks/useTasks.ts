import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { tasksApi } from '@/lib/api/tasks'
import type {
  CreateTaskListInput,
  UpdateTaskListInput,
  CreateTaskInput,
  UpdateTaskInput,
  MoveTaskInput,
  CreateTaskCommentInput,
  TaskFilters,
  CreateFieldDefinitionInput,
  UpdateFieldDefinitionInput,
} from '@/types/api'

// ── Query Keys ───────────────────────────────────────────────
export const tasksKeys = {
  all: ['tasks'] as const,

  lists: () => [...tasksKeys.all, 'lists'] as const,

  tasks: () => [...tasksKeys.all, 'tasks'] as const,
  taskList: (filters?: TaskFilters) => [...tasksKeys.tasks(), filters] as const,
  taskDetail: (id: string) => [...tasksKeys.tasks(), id] as const,

  comments: (taskId: string) => [...tasksKeys.all, 'comments', taskId] as const,
  reactions: (commentId: string) => [...tasksKeys.all, 'reactions', commentId] as const,

  fieldDefs: () => [...tasksKeys.all, 'field-definitions'] as const,
}

// ── Task List Hooks ──────────────────────────────────────────
export function useTaskLists() {
  return useQuery({
    queryKey: tasksKeys.lists(),
    queryFn: () => tasksApi.listTaskLists().then((r) => r.data.data || []),
    staleTime: 5 * 60 * 1000, // 5 min
  })
}

export function useCreateTaskList() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateTaskListInput) =>
      tasksApi.createTaskList(data).then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tasksKeys.lists() })
    },
  })
}

export function useUpdateTaskList() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTaskListInput }) =>
      tasksApi.updateTaskList(id, data).then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tasksKeys.lists() })
    },
  })
}

export function useDeleteTaskList() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => tasksApi.deleteTaskList(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tasksKeys.lists() })
      qc.invalidateQueries({ queryKey: tasksKeys.tasks() })
    },
  })
}

export function useReorderTaskLists() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (listIds: string[]) =>
      tasksApi.reorderTaskLists(listIds),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tasksKeys.lists() })
    },
  })
}

// ── Task Hooks ───────────────────────────────────────────────
export function useTasks(filters?: TaskFilters) {
  return useQuery({
    queryKey: tasksKeys.taskList(filters),
    queryFn: () => tasksApi.listTasks(filters).then((r) => r.data.data || []),
    staleTime: 60 * 1000, // 1 min — tasks change frequently
  })
}

// All Issues — includes completed tasks, supports search + date range filters
export function useAllTasks(filters?: Omit<TaskFilters, 'include_completed'>) {
  const merged = { ...filters, include_completed: true, limit: 50 }
  return useQuery({
    queryKey: [...tasksKeys.tasks(), 'all-issues', filters] as const,
    queryFn: () =>
      tasksApi.listTasks(merged).then((r) => ({
        tasks: r.data.data || [],
        meta:  r.data.meta,
      })),
    staleTime: 30 * 1000,
  })
}

export function useTask(id: string) {
  return useQuery({
    queryKey: tasksKeys.taskDetail(id),
    queryFn: () => tasksApi.getTask(id).then((r) => r.data.data),
    staleTime: 60 * 1000, // 1 min
  })
}

export function useCreateTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateTaskInput) =>
      tasksApi.createTask(data).then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tasksKeys.tasks() })
    },
  })
}

export function useUpdateTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTaskInput }) =>
      tasksApi.updateTask(id, data).then((r) => r.data.data),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: tasksKeys.tasks() })
      qc.invalidateQueries({ queryKey: tasksKeys.taskDetail(variables.id) })
    },
  })
}

export function useMoveTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: MoveTaskInput }) =>
      tasksApi.moveTask(id, data).then((r) => r.data.data),
    onSuccess: () => {
      // Only invalidate the tasks list query
      // Individual task details don't need refresh since we use optimistic updates
      qc.invalidateQueries({ queryKey: tasksKeys.tasks() })
    },
  })
}

export function useToggleTaskCompletion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      tasksApi.toggleTaskCompletion(id).then((r) => r.data.data),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: tasksKeys.tasks() })
      qc.invalidateQueries({ queryKey: tasksKeys.taskDetail(id) })
    },
  })
}

export function useDeleteTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => tasksApi.deleteTask(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tasksKeys.tasks() })
    },
  })
}

// ── Comment Hooks ────────────────────────────────────────────
export function useTaskComments(taskId: string) {
  return useQuery({
    queryKey: tasksKeys.comments(taskId),
    queryFn: () => tasksApi.listComments(taskId).then((r) => r.data.data || []),
    staleTime: 30 * 1000, // 30 sec — comments change frequently
  })
}

export function useCreateTaskComment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ taskId, data }: { taskId: string; data: CreateTaskCommentInput }) =>
      tasksApi.createComment(taskId, data).then((r) => r.data.data),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: tasksKeys.comments(variables.taskId) })
    },
  })
}

export function useDeleteTaskComment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ taskId, commentId }: { taskId: string; commentId: string }) =>
      tasksApi.deleteComment(taskId, commentId),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: tasksKeys.comments(variables.taskId) })
    },
  })
}

// ── Reaction Hooks ───────────────────────────────────────────
export function useToggleReaction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ taskId, commentId, emoji }: { taskId: string; commentId: string; emoji: string }) =>
      tasksApi.toggleReaction(taskId, commentId, emoji).then((r) => r.data.data),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: tasksKeys.reactions(variables.commentId) })
      qc.invalidateQueries({ queryKey: tasksKeys.comments(variables.taskId) })
    },
  })
}

export function useCommentReactions(taskId: string, commentId: string) {
  return useQuery({
    queryKey: tasksKeys.reactions(commentId),
    queryFn: () => tasksApi.listReactions(taskId, commentId).then((r) => r.data.data || []),
    staleTime: 10 * 1000, // 10 sec — reactions change frequently
  })
}

// ── Field Definition Hooks ───────────────────────────────────
export function useFieldDefinitions() {
  return useQuery({
    queryKey: tasksKeys.fieldDefs(),
    queryFn: () =>
      tasksApi.listFieldDefinitions().then((r) => r.data.data ?? []),
    staleTime: 5 * 60 * 1000,
  })
}

export function useCreateFieldDefinition() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateFieldDefinitionInput) =>
      tasksApi.createFieldDefinition(data).then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tasksKeys.fieldDefs() })
    },
  })
}

export function useUpdateFieldDefinition() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateFieldDefinitionInput }) =>
      tasksApi.updateFieldDefinition(id, data).then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tasksKeys.fieldDefs() })
    },
  })
}

export function useDeactivateFieldDefinition() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => tasksApi.deactivateFieldDefinition(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tasksKeys.fieldDefs() })
    },
  })
}

// ── Field Value Hooks ────────────────────────────────────────
export function useSetFieldValue() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ taskId, fieldId, value }: { taskId: string; fieldId: string; value: unknown }) =>
      tasksApi.setFieldValue(taskId, fieldId, value).then((r) => r.data.data),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: tasksKeys.taskDetail(variables.taskId) })
      qc.invalidateQueries({ queryKey: tasksKeys.tasks() })
    },
  })
}

export function useClearFieldValue() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ taskId, fieldId }: { taskId: string; fieldId: string }) =>
      tasksApi.clearFieldValue(taskId, fieldId),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: tasksKeys.taskDetail(variables.taskId) })
      qc.invalidateQueries({ queryKey: tasksKeys.tasks() })
    },
  })
}
