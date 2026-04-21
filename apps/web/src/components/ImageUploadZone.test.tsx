import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ImageUploadZone } from './ImageUploadZone'

describe('ImageUploadZone', () => {
  it('renders with default props', () => {
    render(<ImageUploadZone onImageSelect={vi.fn()} />)
    expect(screen.getByText(/drop image here or click to browse/i)).toBeInTheDocument()
  })

  it('shows uploading state', () => {
    render(<ImageUploadZone onImageSelect={vi.fn()} isUploading={true} />)
    expect(screen.getByText(/uploading image/i)).toBeInTheDocument()
  })

  it('validates file type', async () => {
    const onImageSelect = vi.fn()
    render(<ImageUploadZone onImageSelect={onImageSelect} />)
    
    const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    
    Object.defineProperty(input, 'files', {
      value: [file],
    })
    
    fireEvent.change(input)
    
    await waitFor(() => {
      expect(screen.getByText(/invalid file type/i)).toBeInTheDocument()
      expect(onImageSelect).not.toHaveBeenCalled()
    })
  })

  it('validates file size', async () => {
    const onImageSelect = vi.fn()
    render(<ImageUploadZone onImageSelect={onImageSelect} maxSizeMB={1} />)
    
    // Create a file larger than 1MB
    const largeContent = new Array(2 * 1024 * 1024).fill('a').join('')
    const file = new File([largeContent], 'test.jpg', { type: 'image/jpeg' })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    
    Object.defineProperty(input, 'files', {
      value: [file],
    })
    
    fireEvent.change(input)
    
    await waitFor(() => {
      expect(screen.getByText(/file size must be less than/i)).toBeInTheDocument()
      expect(onImageSelect).not.toHaveBeenCalled()
    })
  })

  it('accepts valid file', async () => {
    const onImageSelect = vi.fn()
    render(<ImageUploadZone onImageSelect={onImageSelect} />)
    
    const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    
    Object.defineProperty(input, 'files', {
      value: [file],
    })
    
    fireEvent.change(input)
    
    await waitFor(() => {
      expect(onImageSelect).toHaveBeenCalledWith(file)
    })
  })

  it('handles drag states', () => {
    const onImageSelect = vi.fn()
    const { container } = render(<ImageUploadZone onImageSelect={onImageSelect} />)
    
    const dropZone = container.firstChild as HTMLElement
    
    fireEvent.dragEnter(dropZone)
    expect(screen.getByText(/drop image here/i)).toBeInTheDocument()
    
    fireEvent.dragLeave(dropZone)
    expect(screen.getByText(/drop image here or click to browse/i)).toBeInTheDocument()
  })
})
