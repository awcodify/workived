/** Pure position-calculation helpers for the task kanban board. */

export interface PositionedTask {
  id: string
  position: number
}

/**
 * Calculate new position for a task being reordered within the same column.
 * Returns the new numeric position value.
 */
export function calcSameColumnPosition(
  tasks: PositionedTask[],
  activeId: string,
  overId: string,
): number {
  const oldIdx = tasks.findIndex((t) => t.id === activeId)
  if (oldIdx === -1) return 1000

  const newIdx = tasks.findIndex((t) => t.id === overId)

  if (newIdx === -1) {
    // Dropped on empty space → append to end
    const others = tasks.filter((t) => t.id !== activeId)
    const last = others[others.length - 1]
    return last ? last.position + 1000 : 1000
  }

  // Reorder: compute from neighbours after arrayMove
  const reordered = [...tasks]
  reordered.splice(oldIdx, 1)
  reordered.splice(newIdx, 0, tasks[oldIdx])

  const taskBefore = newIdx > 0 ? reordered[newIdx - 1] : null
  const taskAfter = newIdx < reordered.length - 1 ? reordered[newIdx + 1] : null

  if (!taskBefore && taskAfter) {
    const calc = taskAfter.position - 1000
    return calc >= 1 ? calc : Math.max(1, Math.floor(taskAfter.position / 2))
  }
  if (taskBefore && !taskAfter) {
    return taskBefore.position + 1000
  }
  if (taskBefore && taskAfter) {
    const gap = taskAfter.position - taskBefore.position
    return gap > 2
      ? Math.floor((taskBefore.position + taskAfter.position) / 2)
      : taskBefore.position + 1
  }
  return 1000
}

/**
 * Calculate new position for a task being moved to a different column.
 *
 * - If `overId` is a task ID in the target column → insert above that task.
 * - If `overId` is a list/column ID (no matching task) → append to bottom.
 */
export function calcCrossColumnPosition(
  targetTasks: PositionedTask[], // tasks already in target column (excluding dragged)
  overId: string,
): number {
  const overTaskIdx = targetTasks.findIndex((t) => t.id === overId)

  if (overTaskIdx === -1) {
    // Dropped on column sentinel / empty space → append to bottom
    const last = targetTasks[targetTasks.length - 1]
    return last ? last.position + 1000 : 1000
  }

  // Dropped on a specific card → insert above that card
  const overTask = targetTasks[overTaskIdx]
  const taskBefore = overTaskIdx > 0 ? targetTasks[overTaskIdx - 1] : null

  if (taskBefore) {
    const gap = overTask.position - taskBefore.position
    return gap > 2
      ? Math.floor((taskBefore.position + overTask.position) / 2)
      : taskBefore.position + 1
  }

  // Inserting before the first task in the column
  return Math.max(1, overTask.position - 1000)
}
