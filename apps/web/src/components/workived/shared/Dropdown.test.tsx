import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Dropdown, type DropdownOption } from './Dropdown'

describe('Dropdown', () => {
  const mockOptions: DropdownOption[] = [
    { value: '1', label: 'Engineering', description: 'Tech team' },
    { value: '2', label: 'Marketing', description: 'Brand team' },
    { value: '3', label: 'Sales' },
    { value: '4', label: 'Human Resources', description: 'HR team' },
  ]

  it('renders with placeholder when no value selected', () => {
    const onChange = vi.fn()
    render(
      <Dropdown
        value=""
        onChange={onChange}
        options={mockOptions}
        placeholder="Select department"
      />
    )

    expect(screen.getByText('Select department')).toBeInTheDocument()
  })

  it('displays selected option label', () => {
    const onChange = vi.fn()
    render(
      <Dropdown
        value="2"
        onChange={onChange}
        options={mockOptions}
        placeholder="Select department"
      />
    )

    expect(screen.getByText('Marketing')).toBeInTheDocument()
  })

  it('opens dropdown menu on button click', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    
    render(
      <Dropdown
        value=""
        onChange={onChange}
        options={mockOptions}
        placeholder="Select department"
      />
    )

    const button = screen.getByRole('button')
    await user.click(button)

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument()
      expect(screen.getByText('Engineering')).toBeInTheDocument()
      expect(screen.getByText('Marketing')).toBeInTheDocument()
      expect(screen.getByText('Sales')).toBeInTheDocument()
      expect(screen.getByText('Human Resources')).toBeInTheDocument()
    })
  })

  it('filters options based on search term', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    
    render(
      <Dropdown
        value=""
        onChange={onChange}
        options={mockOptions}
        placeholder="Select department"
      />
    )

    // Open dropdown
    const button = screen.getByRole('button')
    await user.click(button)

    // Wait for dropdown to open
    const searchInput = await screen.findByPlaceholderText('Search...')
    
    // Type in search
    await user.type(searchInput, 'eng')

    await waitFor(() => {
      // Should show Engineering
      expect(screen.getByText('Engineering')).toBeInTheDocument()
      
      // Should not show other departments
      expect(screen.queryByText('Marketing')).not.toBeInTheDocument()
      expect(screen.queryByText('Sales')).not.toBeInTheDocument()
      expect(screen.queryByText('Human Resources')).not.toBeInTheDocument()
    })
  })

  it('filters options by description', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    
    render(
      <Dropdown
        value=""
        onChange={onChange}
        options={mockOptions}
        placeholder="Select department"
      />
    )

    // Open dropdown
    const button = screen.getByRole('button')
    await user.click(button)

    // Wait for dropdown to open
    const searchInput = await screen.findByPlaceholderText('Search...')
    
    // Search by description
    await user.type(searchInput, 'brand')

    await waitFor(() => {
      // Should show Marketing (has "Brand team" description)
      expect(screen.getByText('Marketing')).toBeInTheDocument()
      
      // Should not show others
      expect(screen.queryByText('Engineering')).not.toBeInTheDocument()
    })
  })

  it('shows "No results found" when search has no matches', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    
    render(
      <Dropdown
        value=""
        onChange={onChange}
        options={mockOptions}
        placeholder="Select department"
      />
    )

    // Open dropdown
    const button = screen.getByRole('button')
    await user.click(button)

    // Wait for dropdown to open
    const searchInput = await screen.findByPlaceholderText('Search...')
    
    // Search for non-existent option
    await user.type(searchInput, 'zzzzz')

    await waitFor(() => {
      expect(screen.getByText('No results found')).toBeInTheDocument()
      expect(screen.queryByText('Engineering')).not.toBeInTheDocument()
    })
  })

  it('calls onChange when option is selected', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    
    render(
      <Dropdown
        value=""
        onChange={onChange}
        options={mockOptions}
        placeholder="Select department"
      />
    )

    // Open dropdown
    const button = screen.getByRole('button')
    await user.click(button)

    // Click on an option
    const engineeringOption = await screen.findByText('Engineering')
    await user.click(engineeringOption)

    expect(onChange).toHaveBeenCalledWith('1')
  })

  it('closes dropdown after selecting an option', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    
    render(
      <Dropdown
        value=""
        onChange={onChange}
        options={mockOptions}
        placeholder="Select department"
      />
    )

    // Open dropdown
    const button = screen.getByRole('button')
    await user.click(button)

    // Click on an option
    const engineeringOption = await screen.findByText('Engineering')
    await user.click(engineeringOption)

    // Dropdown should close - search input should not be visible
    await waitFor(() => {
      expect(screen.queryByPlaceholderText('Search...')).not.toBeInTheDocument()
    })
  })

  it('search is case insensitive', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    
    render(
      <Dropdown
        value=""
        onChange={onChange}
        options={mockOptions}
        placeholder="Select department"
      />
    )

    // Open dropdown
    const button = screen.getByRole('button')
    await user.click(button)

    // Wait for dropdown to open
    const searchInput = await screen.findByPlaceholderText('Search...')
    
    // Search with different case
    await user.type(searchInput, 'MARKETING')

    await waitFor(() => {
      expect(screen.getByText('Marketing')).toBeInTheDocument()
    })
  })

  it('clears search term when dropdown closes', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    
    render(
      <Dropdown
        value=""
        onChange={onChange}
        options={mockOptions}
        placeholder="Select department"
      />
    )

    // Open dropdown
    const button = screen.getByRole('button')
    await user.click(button)

    // Type in search
    const searchInput = await screen.findByPlaceholderText('Search...')
    await user.type(searchInput, 'eng')

    // Close dropdown by clicking button again
    await user.click(button)

    // Re-open dropdown
    await user.click(button)

    // Search should be empty
    const newSearchInput = await screen.findByPlaceholderText('Search...')
    expect(newSearchInput).toHaveValue('')

    // All options should be visible
    await waitFor(() => {
      expect(screen.getByText('Engineering')).toBeInTheDocument()
      expect(screen.getByText('Marketing')).toBeInTheDocument()
      expect(screen.getByText('Sales')).toBeInTheDocument()
    })
  })

  it('displays label when provided', () => {
    const onChange = vi.fn()
    render(
      <Dropdown
        value=""
        onChange={onChange}
        options={mockOptions}
        placeholder="Select department"
        label="Department"
      />
    )

    expect(screen.getByText('Department')).toBeInTheDocument()
  })

  it('shows checkmark for selected option', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    
    render(
      <Dropdown
        value="2"
        onChange={onChange}
        options={mockOptions}
        placeholder="Select department"
      />
    )

    // Open dropdown
    const button = screen.getByRole('button')
    await user.click(button)

    // The selected option should have a checkmark
    await waitFor(() => {
      // Find all buttons in the dropdown (not the trigger button)
      const dropdownButtons = screen.getAllByRole('button').filter(btn => 
        btn.textContent?.includes('Marketing') && btn !== button
      )
      const marketingButton = dropdownButtons[0]
      expect(marketingButton).toBeInTheDocument()
      // Check icon should be present in the selected option's button
      const checkIcon = marketingButton?.querySelector('svg')
      expect(checkIcon).toBeInTheDocument()
    })
  })

  it('disables dropdown when disabled prop is true', () => {
    const onChange = vi.fn()
    render(
      <Dropdown
        value=""
        onChange={onChange}
        options={mockOptions}
        placeholder="Select department"
        disabled
      />
    )

    const button = screen.getByRole('button')
    expect(button).toBeDisabled()
  })

  it('displays badge for options with badge property', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    
    const optionsWithBadge: DropdownOption[] = [
      { value: '1', label: 'Default Department', badge: 'default' },
      { value: '2', label: 'Other Department' },
    ]
    
    render(
      <Dropdown
        value=""
        onChange={onChange}
        options={optionsWithBadge}
        placeholder="Select department"
      />
    )

    // Open dropdown
    const button = screen.getByRole('button')
    await user.click(button)

    await waitFor(() => {
      expect(screen.getByText('default')).toBeInTheDocument()
    })
  })

  it('focuses search input when dropdown opens', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    
    render(
      <Dropdown
        value=""
        onChange={onChange}
        options={mockOptions}
        placeholder="Select department"
      />
    )

    // Open dropdown
    const button = screen.getByRole('button')
    await user.click(button)

    // Search input should be focused
    const searchInput = await screen.findByPlaceholderText('Search...')
    
    await waitFor(() => {
      expect(searchInput).toHaveFocus()
    })
  })
})
