import { describe, it, expect } from 'vitest'
import { calcSameColumnPosition, calcCrossColumnPosition } from './taskBoard'

const t = (id: string, position: number) => ({ id, position })

// ── calcSameColumnPosition ──────────────────────────────────────

describe('calcSameColumnPosition', () => {
  it('moves task to end when dropped on empty space (overId not a task)', () => {
    const tasks = [t('a', 1000), t('b', 2000), t('c', 3000)]
    const pos = calcSameColumnPosition(tasks, 'a', 'list-id-not-a-task')
    // 'a' moves to end, last remaining task is 'c' at 3000
    expect(pos).toBe(4000)
  })

  it('moves to start when dropping first task before second', () => {
    const tasks = [t('a', 1000), t('b', 2000), t('c', 3000)]
    // drag 'c' before 'a'
    const pos = calcSameColumnPosition(tasks, 'c', 'a')
    expect(pos).toBeGreaterThanOrEqual(1)
    expect(pos).toBeLessThan(1000)
  })

  it('inserts between two tasks', () => {
    const tasks = [t('a', 1000), t('b', 3000), t('c', 5000)]
    // drag 'c' between 'a' and 'b'
    const pos = calcSameColumnPosition(tasks, 'c', 'b')
    expect(pos).toBeGreaterThan(1000)
    expect(pos).toBeLessThan(3000)
  })

  it('appends to end', () => {
    const tasks = [t('a', 1000), t('b', 2000), t('c', 3000)]
    // drag 'a' to end (after 'c')
    const pos = calcSameColumnPosition(tasks, 'a', 'c')
    expect(pos).toBeGreaterThan(2000)
  })

  it('handles single-task column', () => {
    const tasks = [t('a', 1000)]
    const pos = calcSameColumnPosition(tasks, 'a', 'unknown')
    expect(pos).toBe(1000)
  })

  it('active task not in list returns 1000', () => {
    const tasks = [t('b', 1000)]
    const pos = calcSameColumnPosition(tasks, 'missing', 'b')
    expect(pos).toBe(1000)
  })
})

// ── calcCrossColumnPosition ─────────────────────────────────────

describe('calcCrossColumnPosition', () => {
  it('appends to bottom of empty column', () => {
    const pos = calcCrossColumnPosition([], 'column-id')
    expect(pos).toBe(1000)
  })

  it('appends to bottom when overId is column (not a task)', () => {
    const tasks = [t('a', 1000), t('b', 2000)]
    const pos = calcCrossColumnPosition(tasks, 'column-id')
    expect(pos).toBe(3000)
  })

  it('inserts above first card when dropped on first card', () => {
    const tasks = [t('a', 2000), t('b', 4000)]
    const pos = calcCrossColumnPosition(tasks, 'a')
    expect(pos).toBeGreaterThanOrEqual(1)
    expect(pos).toBeLessThan(2000)
  })

  it('inserts between cards when dropped on middle card', () => {
    const tasks = [t('a', 1000), t('b', 3000), t('c', 5000)]
    const pos = calcCrossColumnPosition(tasks, 'b')
    expect(pos).toBeGreaterThan(1000)
    expect(pos).toBeLessThan(3000)
  })

  it('inserts above last card when dropped on it', () => {
    const tasks = [t('a', 1000), t('b', 2000), t('c', 3000)]
    const pos = calcCrossColumnPosition(tasks, 'c')
    expect(pos).toBeGreaterThan(1000)
    expect(pos).toBeLessThan(3000)
  })

  it('handles dense column (small gaps between tasks)', () => {
    const tasks = [t('a', 1), t('b', 2), t('c', 3)]
    // Drop on 'b': taskBefore is 'a' at position 1, gap = 2-1 = 1 (<= 2)
    const pos = calcCrossColumnPosition(tasks, 'b')
    // gap <= 2 → taskBefore.position + 1 = 2
    expect(pos).toBe(2)
  })

  it('result is always >= 1', () => {
    const tasks = [t('a', 1)]
    const pos = calcCrossColumnPosition(tasks, 'a')
    expect(pos).toBeGreaterThanOrEqual(1)
  })

  it('drop on bottom sentinel (empty space in dense column) appends', () => {
    // User drags to the drop sentinel div at bottom of column.
    // sentinel has no task ID, so overId resolves to column ID → append.
    const tasks = [t('a', 1000), t('b', 2000), t('c', 3000), t('d', 4000)]
    const pos = calcCrossColumnPosition(tasks, 'some-column-id')
    expect(pos).toBe(5000)
  })
})
