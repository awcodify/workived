import { useState, useRef, DragEvent } from 'react'
import { Upload, X, Image as ImageIcon } from 'lucide-react'
import { typography } from '@/design/tokens'

interface ImageUploadZoneProps {
  onImageSelect: (file: File) => void
  isUploading?: boolean
  maxSizeMB?: number
  acceptedFormats?: string[]
  textColor?: string
  accentColor?: string
}

export function ImageUploadZone({
  onImageSelect,
  isUploading = false,
  maxSizeMB = 5,
  acceptedFormats = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  textColor = '#2C3E50',
  accentColor = '#3B82F6'
}: ImageUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const validateFile = (file: File): string | null => {
    // Check file type
    if (!acceptedFormats.includes(file.type)) {
      const formats = acceptedFormats.map(f => f.split('/')[1]?.toUpperCase() || '').filter(Boolean).join(', ')
      return `Invalid file type. Accepted formats: ${formats}`
    }

    // Check file size
    const maxSizeBytes = maxSizeMB * 1024 * 1024
    if (file.size > maxSizeBytes) {
      return `File size must be less than ${maxSizeMB}MB`
    }

    return null
  }

  const handleFile = (file: File) => {
    setError(null)
    const validationError = validateFile(file)
    
    if (validationError) {
      setError(validationError)
      return
    }

    onImageSelect(file)
  }

  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const files = e.dataTransfer.files
    if (files && files.length > 0 && files[0]) {
      handleFile(files[0])
    }
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0 && files[0]) {
      handleFile(files[0])
    }
    // Reset input value to allow selecting the same file again
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleClick = () => {
    if (!isUploading) {
      fileInputRef.current?.click()
    }
  }

  return (
    <div className="w-full">
      <div
        onClick={handleClick}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative rounded-lg border-2 border-dashed p-8
          transition-all duration-200 cursor-pointer
          ${isDragging ? 'scale-[1.02]' : 'scale-100'}
          ${isUploading ? 'opacity-60 cursor-not-allowed' : 'hover:scale-[1.01]'}
        `}
        style={{
          borderColor: isDragging ? accentColor : `${textColor}30`,
          backgroundColor: isDragging ? `${accentColor}08` : 'transparent',
        }}
        data-testid="image-upload-zone"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={acceptedFormats.join(',')}
          onChange={handleFileInputChange}
          disabled={isUploading}
          style={{ display: 'none' }}
          data-testid="image-upload-input"
        />

        <div className="flex flex-col items-center justify-center gap-3">
          {isUploading ? (
            <>
              <div 
                className="animate-spin rounded-full h-12 w-12 border-4"
                style={{
                  borderColor: `${accentColor}20`,
                  borderTopColor: accentColor,
                }}
              />
              <p
                className="text-sm font-medium"
                style={{ 
                  color: accentColor,
                  fontFamily: typography.fontFamily 
                }}
              >
                Uploading image...
              </p>
            </>
          ) : (
            <>
              {isDragging ? (
                <Upload 
                  size={48} 
                  style={{ color: accentColor }}
                  className="animate-bounce"
                />
              ) : (
                <ImageIcon 
                  size={48} 
                  style={{ color: `${textColor}40` }}
                />
              )}
              
              <div className="text-center">
                <p
                  className="text-base font-semibold mb-1"
                  style={{ 
                    color: textColor,
                    fontFamily: typography.fontFamily 
                  }}
                >
                  {isDragging ? 'Drop image here' : 'Drop image here or click to browse'}
                </p>
                <p
                  className="text-xs"
                  style={{ 
                    color: `${textColor}60`,
                    fontFamily: typography.fontFamily 
                  }}
                >
                  {acceptedFormats.map(f => f.split('/')[1]?.toUpperCase() || '').filter(Boolean).join(', ')} up to {maxSizeMB}MB
                </p>
              </div>

              <div
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                style={{
                  backgroundColor: `${accentColor}15`,
                  color: accentColor,
                  fontFamily: typography.fontFamily,
                }}
              >
                Browse Files
              </div>
            </>
          )}
        </div>
      </div>

      {error && (
        <div
          className="mt-2 p-3 rounded-lg flex items-start gap-2"
          style={{
            backgroundColor: '#FEE2E2',
            border: '1px solid #FCA5A5',
          }}
        >
          <X size={16} style={{ color: '#DC2626', flexShrink: 0, marginTop: 2 }} />
          <p
            className="text-sm"
            style={{ 
              color: '#DC2626',
              fontFamily: typography.fontFamily 
            }}
          >
            {error}
          </p>
        </div>
      )}
    </div>
  )
}
