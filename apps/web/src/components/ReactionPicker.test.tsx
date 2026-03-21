import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReactionPicker } from './ReactionPicker'
import type { CommentReactionSummary } from '@/types/api'

const mockReactions: CommentReactionSummary[] = [
  { emoji: '👍', count: 3, user_reacted: false },
  { emoji: '❤️', count: 1, user_reacted: true },
  { emoji: '😂', count: 0, user_reacted: false },
]

describe('ReactionPicker', () => {
  it('renders existing reactions with counts', () => {
    render(
      <ReactionPicker
        reactions={mockReactions}
        onToggle={vi.fn()}
      />
    )

    // Should show reactions with non-zero counts
    expect(screen.getByText('👍')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('❤️')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()

    // Should not show zero-count reactions
    expect(screen.queryByText('😂')).not.toBeInTheDocument()
  })

  it('highlights reacted emojis', () => {
    render(
      <ReactionPicker
        reactions={mockReactions}
        onToggle={vi.fn()}
      />
    )

    // Find reaction buttons
    const buttons = screen.getAllByRole('button')
    const heartButton = buttons.find((btn) => btn.textContent?.includes('❤️'))

    // User reacted with heart, should have violet border
    expect(heartButton).toBeInTheDocument()
    // Check it has the reacted styling (color is converted to rgb in jsdom)
    const buttonStyle = heartButton!.getAttribute('style')
    expect(buttonStyle).toContain('rgb(99, 87, 232)')
  })

  it('shows add reaction button', () => {
    render(
      <ReactionPicker
        reactions={[]}
        onToggle={vi.fn()}
      />
    )

    const addButton = screen.getByTitle('Add reaction')
    expect(addButton).toBeInTheDocument()
    expect(addButton.textContent).toBe('😊')
  })

  it('opens emoji picker when add button clicked', async () => {
    const user = userEvent.setup()
    
    render(
      <ReactionPicker
        reactions={[]}
        onToggle={vi.fn()}
      />
    )

    const addButton = screen.getByTitle('Add reaction')
    await user.click(addButton)

    // Should show all 6 available emojis
    expect(screen.getByText('👍')).toBeInTheDocument()
    expect(screen.getByText('❤️')).toBeInTheDocument()
    expect(screen.getByText('😂')).toBeInTheDocument()
    expect(screen.getByText('😮')).toBeInTheDocument()
    expect(screen.getByText('😢')).toBeInTheDocument()
    expect(screen.getByText('🎉')).toBeInTheDocument()
  })

  it('calls onToggle when clicking an existing reaction', () => {
    const onToggle = vi.fn()
    
    render(
      <ReactionPicker
        reactions={mockReactions}
        onToggle={onToggle}
      />
    )

    const thumbsUpButton = screen.getByText('👍').parentElement
    fireEvent.click(thumbsUpButton!)

    expect(onToggle).toHaveBeenCalledWith('👍')
  })

  it('calls onToggle when picking a new emoji', async () => {
    const onToggle = vi.fn()
    const user = userEvent.setup()
    
    render(
      <ReactionPicker
        reactions={[]}
        onToggle={onToggle}
      />
    )

    // Open picker
    const addButton = screen.getByTitle('Add reaction')
    await user.click(addButton)

    // Click party emoji
    const partyButton = screen.getByText('🎉')
    await user.click(partyButton)

    expect(onToggle).toHaveBeenCalledWith('🎉')
  })

  it('closes picker after selecting emoji', async () => {
    const user = userEvent.setup()
    
    render(
      <ReactionPicker
        reactions={[]}
        onToggle={vi.fn()}
      />
    )

    // Open picker
    const addButton = screen.getByTitle('Add reaction')
    await user.click(addButton)

    // Picker should be visible
    expect(screen.getByText('🎉')).toBeInTheDocument()

    // Click an emoji
    await user.click(screen.getByText('🎉'))

    // Picker should close (party emoji in picker should be gone, only in add button)
    const partyEmojis = screen.queryAllByText('🎉')
    expect(partyEmojis).toHaveLength(0) // Closed, no longer in picker
  })

  it('disables buttons when loading', () => {
    render(
      <ReactionPicker
        reactions={mockReactions}
        onToggle={vi.fn()}
        isLoading={true}
      />
    )

    const buttons = screen.getAllByRole('button')
    buttons.forEach((button) => {
      expect(button).toBeDisabled()
    })
  })

  it('toggles picker open/closed', async () => {
    const user = userEvent.setup()
    
    render(
      <ReactionPicker
        reactions={[]}
        onToggle={vi.fn()}
      />
    )

    const addButton = screen.getByTitle('Add reaction')

    // Initially closed
    expect(screen.queryByText('🎉')).not.toBeInTheDocument()

    // Open
    await user.click(addButton)
    expect(screen.getByText('🎉')).toBeInTheDocument()

    // Close (button text changes to ✕)
    expect(addButton.textContent).toBe('✕')
    await user.click(addButton)
    expect(screen.queryByText('🎉')).not.toBeInTheDocument()
  })

  it('shows correct title for user-reacted vs others', () => {
    render(
      <ReactionPicker
        reactions={mockReactions}
        onToggle={vi.fn()}
      />
    )

    const thumbsUp = screen.getByText('👍').parentElement
    const heart = screen.getByText('❤️').parentElement

    // User hasn't reacted with thumbs up
    expect(thumbsUp).toHaveAttribute('title', '3 people reacted')

    // User has reacted with heart
    expect(heart).toHaveAttribute('title', 'You reacted with this')
  })

  it('handles singular vs plural in tooltip', () => {
    const singleReaction: CommentReactionSummary[] = [
      { emoji: '👍', count: 1, user_reacted: false },
    ]

    render(
      <ReactionPicker
        reactions={singleReaction}
        onToggle={vi.fn()}
      />
    )

    const thumbsUp = screen.getByText('👍').parentElement
    expect(thumbsUp).toHaveAttribute('title', '1 person reacted')
  })
})
