export type TourEventName = 'tour_started' | 'step_viewed' | 'tour_completed' | 'tour_skipped'

export interface TourEventPayload {
  tour_id: string
  step_index?: number
  step_id?: string
  total_steps?: number
}

export function trackTourEvent(event: TourEventName, payload: TourEventPayload): void {
  if (typeof window === 'undefined') return

  window.dispatchEvent(
    new CustomEvent('workived:tour_event', {
      detail: { event, ...payload, ts: Date.now() },
    })
  )

  if (import.meta.env.DEV) {
    console.debug('[Tour]', event, payload)
  }
}
