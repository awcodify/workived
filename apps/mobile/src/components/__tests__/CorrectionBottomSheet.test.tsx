import React, { act } from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'

jest.mock('@tanstack/react-query', () => ({
  useMutation: jest.fn(),
  useQueryClient: jest.fn(),
}))

jest.mock('@/api/client', () => ({
  apiClient: { submitCorrection: jest.fn() },
}))

jest.mock('@react-native-community/datetimepicker', () => {
  const mockReact = require('react')
  return {
    __esModule: true,
    default: ({ testID, onChange }: { testID?: string; onChange?: Function }) =>
      mockReact.createElement('View', { testID: testID ?? 'datetimepicker' }),
  }
})

jest.mock('@expo/vector-icons', () => ({
  Ionicons: ({ name, testID }: { name: string; testID?: string }) => {
    const mockReact = require('react')
    return mockReact.createElement('Text', { testID: testID ?? `icon-${name}` }, name)
  },
}))

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CorrectionBottomSheet } from '../CorrectionBottomSheet'

function setupMutation(overrides: object = {}) {
  const mutate = jest.fn()
  jest.mocked(useMutation).mockReturnValue({
    mutate,
    isPending: false,
    isError: false,
    isSuccess: false,
    ...overrides,
  } as ReturnType<typeof useMutation>)
  jest.mocked(useQueryClient).mockReturnValue({ invalidateQueries: jest.fn() } as any)
  return mutate
}

describe('CorrectionBottomSheet', () => {
  const onClose = jest.fn()

  beforeEach(() => jest.clearAllMocks())

  it('renders sheet when visible', () => {
    setupMutation()
    render(<CorrectionBottomSheet visible onClose={onClose} />)
    expect(screen.getByTestId('correction-sheet')).toBeTruthy()
  })

  it('does not render sheet when not visible', () => {
    setupMutation()
    render(<CorrectionBottomSheet visible={false} onClose={onClose} />)
    expect(screen.queryByTestId('correction-sheet')).toBeNull()
  })

  it('calls onClose when close button pressed', () => {
    setupMutation()
    render(<CorrectionBottomSheet visible onClose={onClose} />)
    fireEvent.press(screen.getByTestId('correction-close-btn'))
    expect(onClose).toHaveBeenCalled()
  })

  it('shows time error when submitting without any time', () => {
    setupMutation()
    render(<CorrectionBottomSheet visible onClose={onClose} />)
    fireEvent.changeText(screen.getByTestId('correction-reason-input'), 'This is a valid reason text')
    fireEvent.press(screen.getByTestId('correction-submit-btn'))
    expect(screen.getByTestId('correction-time-error')).toBeTruthy()
  })

  it('shows reason error when reason too short', () => {
    setupMutation()
    render(<CorrectionBottomSheet visible onClose={onClose} />)
    fireEvent.changeText(screen.getByTestId('correction-reason-input'), 'short')
    fireEvent.press(screen.getByTestId('correction-submit-btn'))
    expect(screen.getByTestId('correction-reason-error')).toBeTruthy()
  })

  it('does not call mutate when validation fails', () => {
    const mutate = setupMutation()
    render(<CorrectionBottomSheet visible onClose={onClose} />)
    fireEvent.press(screen.getByTestId('correction-submit-btn'))
    expect(mutate).not.toHaveBeenCalled()
  })

  it('shows date picker button', () => {
    setupMutation()
    render(<CorrectionBottomSheet visible onClose={onClose} />)
    expect(screen.getByTestId('correction-date-btn')).toBeTruthy()
  })

  it('shows clock-in and clock-out buttons', () => {
    setupMutation()
    render(<CorrectionBottomSheet visible onClose={onClose} />)
    expect(screen.getByTestId('correction-clockin-btn')).toBeTruthy()
    expect(screen.getByTestId('correction-clockout-btn')).toBeTruthy()
  })

  it('opens date picker when date button pressed', () => {
    setupMutation()
    render(<CorrectionBottomSheet visible onClose={onClose} />)
    fireEvent.press(screen.getByTestId('correction-date-btn'))
    expect(screen.getByTestId('correction-date-picker')).toBeTruthy()
  })

  it('opens clock-in picker when button pressed', () => {
    setupMutation()
    render(<CorrectionBottomSheet visible onClose={onClose} />)
    fireEvent.press(screen.getByTestId('correction-clockin-btn'))
    expect(screen.getByTestId('correction-clockin-picker')).toBeTruthy()
  })

  it('opens clock-out picker when button pressed', () => {
    setupMutation()
    render(<CorrectionBottomSheet visible onClose={onClose} />)
    fireEvent.press(screen.getByTestId('correction-clockout-btn'))
    expect(screen.getByTestId('correction-clockout-picker')).toBeTruthy()
  })

  it('shows activity indicator when pending', () => {
    setupMutation({ isPending: true })
    render(<CorrectionBottomSheet visible onClose={onClose} />)
    expect(screen.queryByText('Submit Correction')).toBeNull()
  })

  it('shows submit error when mutation fails', () => {
    setupMutation({ isError: true })
    render(<CorrectionBottomSheet visible onClose={onClose} />)
    expect(screen.getByTestId('correction-submit-error')).toBeTruthy()
  })

  it('shows success state after onSuccess callback fires', async () => {
    let onSuccessCallback: () => void = () => {}
    jest.mocked(useMutation).mockImplementation(({ onSuccess }: any) => {
      onSuccessCallback = onSuccess
      return {
        mutate: jest.fn(),
        isPending: false,
        isError: false,
      } as any
    })
    jest.mocked(useQueryClient).mockReturnValue({ invalidateQueries: jest.fn() } as any)

    render(<CorrectionBottomSheet visible onClose={onClose} />)
    await act(async () => { onSuccessCallback() })
    expect(screen.getByTestId('correction-success')).toBeTruthy()
  })

  it('calls onClose from Done button in success state', async () => {
    let onSuccessCallback: () => void = () => {}
    jest.mocked(useMutation).mockImplementation(({ onSuccess }: any) => {
      onSuccessCallback = onSuccess
      return { mutate: jest.fn(), isPending: false, isError: false } as any
    })
    jest.mocked(useQueryClient).mockReturnValue({ invalidateQueries: jest.fn() } as any)

    render(<CorrectionBottomSheet visible onClose={onClose} />)
    await act(async () => { onSuccessCallback() })
    fireEvent.press(screen.getByTestId('correction-done-btn'))
    expect(onClose).toHaveBeenCalled()
  })
})
