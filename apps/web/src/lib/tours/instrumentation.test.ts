import { describe, it, expect, vi, beforeEach } from 'vitest'
import { trackTourEvent } from './instrumentation'

describe('trackTourEvent', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('dispatches workived:tour_event custom event', () => {
    const listener = vi.fn()
    window.addEventListener('workived:tour_event', listener)

    trackTourEvent('tour_started', { tour_id: 'overview' })

    expect(listener).toHaveBeenCalledOnce()
    const detail = (listener.mock.calls[0][0] as CustomEvent).detail
    expect(detail.event).toBe('tour_started')
    expect(detail.tour_id).toBe('overview')
    expect(typeof detail.ts).toBe('number')

    window.removeEventListener('workived:tour_event', listener)
  })

  it('includes step_index and step_id in payload', () => {
    const listener = vi.fn()
    window.addEventListener('workived:tour_event', listener)

    trackTourEvent('step_viewed', { tour_id: 'tasks', step_index: 2, step_id: 'tasks-board', total_steps: 8 })

    const detail = (listener.mock.calls[0][0] as CustomEvent).detail
    expect(detail.step_index).toBe(2)
    expect(detail.step_id).toBe('tasks-board')
    expect(detail.total_steps).toBe(8)

    window.removeEventListener('workived:tour_event', listener)
  })

  it('dispatches tour_completed event', () => {
    const listener = vi.fn()
    window.addEventListener('workived:tour_event', listener)

    trackTourEvent('tour_completed', { tour_id: 'overview', total_steps: 15 })

    const detail = (listener.mock.calls[0][0] as CustomEvent).detail
    expect(detail.event).toBe('tour_completed')

    window.removeEventListener('workived:tour_event', listener)
  })

  it('dispatches tour_skipped event', () => {
    const listener = vi.fn()
    window.addEventListener('workived:tour_event', listener)

    trackTourEvent('tour_skipped', { tour_id: 'tasks', step_index: 3 })

    const detail = (listener.mock.calls[0][0] as CustomEvent).detail
    expect(detail.event).toBe('tour_skipped')
    expect(detail.step_index).toBe(3)

    window.removeEventListener('workived:tour_event', listener)
  })
})
