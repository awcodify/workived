import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { TaskBoardDemo } from './TaskBoardDemo'

// Helper: step through phases by advancing fake timers one phase at a time
// Each act() lets React re-render and register the next useEffect timer
const step = (ms: number) => act(() => { vi.advanceTimersByTime(ms) })

describe('TaskBoardDemo', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('renders the demo container', () => {
    render(<TaskBoardDemo />)
    expect(screen.getByTestId('task-board-demo')).toBeInTheDocument()
  })

  it('renders all three columns', () => {
    render(<TaskBoardDemo />)
    expect(screen.getByTestId('demo-column-to-do')).toBeInTheDocument()
    expect(screen.getByTestId('demo-column-in-progress')).toBeInTheDocument()
    expect(screen.getByTestId('demo-column-review')).toBeInTheDocument()
  })

  it('shows col1 cards and no floating card in idle phase', () => {
    render(<TaskBoardDemo />)
    expect(screen.getByText('Fix login bug')).toBeInTheDocument()
    expect(screen.getByText('Add search')).toBeInTheDocument()
    expect(screen.queryByTestId('task-board-demo-floating-card')).not.toBeInTheDocument()
  })

  it('shows ghost and floating card during lifting phase', () => {
    render(<TaskBoardDemo />)
    step(1400) // idle → lifting
    expect(screen.getByTestId('task-board-demo-ghost')).toBeInTheDocument()
    expect(screen.getByTestId('task-board-demo-floating-card')).toBeInTheDocument()
  })

  it('removes floating card after card settles in col2', () => {
    render(<TaskBoardDemo />)
    step(1400) // → lifting
    step(350)  // → moving
    step(700)  // → settled
    expect(screen.queryByTestId('task-board-demo-floating-card')).not.toBeInTheDocument()
    expect(screen.queryByTestId('task-board-demo-ghost')).not.toBeInTheDocument()
  })

  it('shows "Fix login bug" in In Progress after card settles', () => {
    render(<TaskBoardDemo />)
    step(1400); step(350); step(700) // idle → lifting → moving → settled
    expect(screen.getByTestId('demo-column-in-progress')).toHaveTextContent('Fix login bug')
  })

  it('shows "click to expand" hint during settled phase', () => {
    render(<TaskBoardDemo />)
    step(1400); step(350); step(700) // → settled
    expect(screen.getByTestId('task-board-demo-hint')).toBeInTheDocument()
    expect(screen.getByText('click to expand')).toBeInTheDocument()
  })

  it('shows ripple during clicking phase', () => {
    render(<TaskBoardDemo />)
    step(1400); step(350); step(700); step(700) // → clicking
    expect(screen.getByTestId('task-board-demo-ripple')).toBeInTheDocument()
  })

  it('review column is collapsed initially', () => {
    render(<TaskBoardDemo />)
    expect(screen.getByTestId('demo-column-review')).not.toHaveTextContent('Design review')
  })

  it('review column shows card after expanding', () => {
    render(<TaskBoardDemo />)
    step(1400); step(350); step(700); step(700); step(480); step(550) // → expanded
    expect(screen.getByText('Design review')).toBeInTheDocument()
  })

  it('loops back to idle after full cycle', () => {
    render(<TaskBoardDemo />)
    step(1400) // → lifting
    step(350)  // → moving
    step(700)  // → settled
    step(700)  // → clicking
    step(480)  // → expanding
    step(550)  // → expanded
    step(1200) // → fading
    step(350)  // → idle

    expect(screen.queryByTestId('task-board-demo-floating-card')).not.toBeInTheDocument()
    expect(screen.queryByTestId('task-board-demo-hint')).not.toBeInTheDocument()
    expect(screen.getByTestId('demo-column-to-do')).toHaveTextContent('Fix login bug')
  })
})
