import { useState, useRef } from 'react'
import { Upload, X, User } from 'lucide-react'
import { colors, moduleThemes } from '@/design/tokens'

const t = moduleThemes.people

interface PhotoUploadProps {
  value?: string
  onChange: (file: File | null) => void
  error?: string
}

export function PhotoUpload({ value, onChange, error }: PhotoUploadProps) {
  const [preview, setPreview] = useState<string | null>(value || null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (file: File | null) => {
    if (!file) {
      setPreview(null)
      onChange(null)
      return
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file')
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be smaller than 5MB')
      return
    }

    // Create preview
    const reader = new FileReader()
    reader.onloadend = () => {
      setPreview(reader.result as string)
    }
    reader.readAsDataURL(file)

    onChange(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const file = e.dataTransfer.files[0]
    if (file) {
      handleFileChange(file)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleClick = () => {
    fileInputRef.current?.click()
  }

  const handleRemove = () => {
    setPreview(null)
    onChange(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-2">
      <input
        data-testid="photo-upload-input"
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
        className="hidden"
      />

      {preview ? (
        // Preview state
        <div className="relative inline-block">
          <div
            className="rounded-xl overflow-hidden"
            style={{
              width: 120,
              height: 120,
              border: `2px solid ${t.border}`,
            }}
          >
            <img
              src={preview}
              alt="Profile preview"
              className="w-full h-full object-cover"
            />
          </div>
          <button
            data-testid="photo-upload-remove-btn"
            type="button"
            onClick={handleRemove}
            className="absolute -top-2 -right-2 rounded-full p-1.5 shadow-lg transition-transform hover:scale-110"
            style={{
              background: colors.err,
              color: '#FFFFFF',
            }}
          >
            <X size={14} strokeWidth={3} />
          </button>
        </div>
      ) : (
        // Upload state
        <button
          data-testid="photo-upload-btn"
          type="button"
          onClick={handleClick}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className="flex flex-col items-center justify-center gap-2 rounded-xl transition-all"
          style={{
            width: 120,
            height: 120,
            border: `2px dashed ${isDragging ? colors.accent : t.border}`,
            background: isDragging ? colors.accentDim : t.surface,
          }}
        >
          <div
            className="flex items-center justify-center rounded-lg"
            style={{
              width: 36,
              height: 36,
              background: t.input,
              color: t.textMuted,
            }}
          >
            {isDragging ? <Upload size={18} /> : <User size={18} />}
          </div>
          <span className="text-xs font-medium text-center px-2" style={{ color: t.textMuted }}>
            {isDragging ? 'Drop here' : 'Upload photo'}
          </span>
        </button>
      )}

      {error && (
        <p className="text-xs" style={{ color: colors.err }}>
          {error}
        </p>
      )}

      <p className="text-xs" style={{ color: t.textMuted }}>
        JPG, PNG or GIF. Max 5MB.
      </p>
    </div>
  )
}
