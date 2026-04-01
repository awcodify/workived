import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { UpgradeModal } from './UpgradeModal'
import { useUpgradeStore } from '@/lib/stores/upgrade'

describe('UpgradeModal', () => {
  beforeEach(() => {
    useUpgradeStore.setState({ open: false, message: '' })
  })

  it('renders nothing when closed', () => {
    const { container } = render(<UpgradeModal />)
    expect(container.innerHTML).toBe('')
  })

  it('renders modal with message when open', () => {
    useUpgradeStore.setState({ open: true, message: 'You have reached the 25 employee limit.' })

    render(<UpgradeModal />)

    expect(screen.getByText('Upgrade to Pro')).toBeInTheDocument()
    expect(screen.getByText('You have reached the 25 employee limit.')).toBeInTheDocument()
    expect(screen.getByText('Unlimited employees')).toBeInTheDocument()
  })

  it('closes when X button is clicked', () => {
    useUpgradeStore.setState({ open: true, message: 'Upgrade needed' })

    render(<UpgradeModal />)
    expect(screen.getByText('Upgrade to Pro')).toBeInTheDocument()

    // Click the X button (first button in modal)
    const closeButtons = screen.getAllByRole('button')
    fireEvent.click(closeButtons[0]) // X button

    expect(useUpgradeStore.getState().open).toBe(false)
  })

  it('closes when "Maybe later" is clicked', () => {
    useUpgradeStore.setState({ open: true, message: 'Upgrade needed' })

    render(<UpgradeModal />)
    fireEvent.click(screen.getByText('Maybe later'))

    expect(useUpgradeStore.getState().open).toBe(false)
  })

  it('closes when backdrop is clicked', () => {
    useUpgradeStore.setState({ open: true, message: 'Upgrade needed' })

    const { container } = render(<UpgradeModal />)
    // Click the backdrop (outermost div)
    const backdrop = container.firstChild as HTMLElement
    fireEvent.click(backdrop)

    expect(useUpgradeStore.getState().open).toBe(false)
  })

  it('does not close when modal content is clicked', () => {
    useUpgradeStore.setState({ open: true, message: 'Upgrade needed' })

    render(<UpgradeModal />)
    fireEvent.click(screen.getByText('Upgrade to Pro'))

    expect(useUpgradeStore.getState().open).toBe(true)
  })

  it('shows all Pro features', () => {
    useUpgradeStore.setState({ open: true, message: 'Test' })

    render(<UpgradeModal />)

    expect(screen.getByText('Unlimited employees')).toBeInTheDocument()
    expect(screen.getByText('GPS geofenced attendance')).toBeInTheDocument()
    expect(screen.getByText('Custom leave types')).toBeInTheDocument()
    expect(screen.getByText('Department-level policies')).toBeInTheDocument()
    expect(screen.getByText('Priority support')).toBeInTheDocument()
  })
})
