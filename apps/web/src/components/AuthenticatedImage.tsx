import { NodeViewWrapper } from '@tiptap/react'
import { useState, useEffect } from 'react'
import { apiClient } from '@/lib/api/client'
import { Loader2 } from 'lucide-react'

interface AuthenticatedImageProps {
  node: {
    attrs: {
      src: string
      alt?: string
      title?: string
    }
  }
}

export function AuthenticatedImage({ node }: AuthenticatedImageProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const { src, alt, title } = node.attrs

  useEffect(() => {
    let objectUrl: string | null = null

    const loadImage = async () => {
      try {
        setLoading(true)
        setError(false)

        // Check if it's an authenticated API URL
        if (src.includes('/api/v1/uploads/')) {
          // Convert absolute URL to relative path to use Vite proxy
          // e.g., http://localhost:8080/api/v1/uploads/... -> /api/v1/uploads/...
          const relativePath = src.includes('://') 
            ? new URL(src).pathname 
            : src

          const response = await apiClient.get(relativePath, {
            responseType: 'blob',
          })

          // Create blob URL
          objectUrl = URL.createObjectURL(response.data)
          setBlobUrl(objectUrl)
        } else {
          // External or public URL - use directly
          setBlobUrl(src)
        }
      } catch (err) {
        console.error('Failed to load image:', err)
        setError(true)
      } finally {
        setLoading(false)
      }
    }

    loadImage()

    // Cleanup blob URL on unmount
    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
      }
    }
  }, [src])

  if (loading) {
    return (
      <NodeViewWrapper
        className="inline-flex items-center justify-center p-4 rounded-lg"
        style={{ backgroundColor: 'rgba(99, 87, 232, 0.1)' }}
      >
        <Loader2 size={20} className="animate-spin" style={{ color: '#6357E8' }} />
      </NodeViewWrapper>
    )
  }

  if (error || !blobUrl) {
    return (
      <NodeViewWrapper
        className="inline-flex items-center justify-center p-4 rounded-lg"
        style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#EF4444' }}
      >
        <span className="text-sm">Failed to load image</span>
      </NodeViewWrapper>
    )
  }

  return (
    <NodeViewWrapper className="inline-block">
      <img
        src={blobUrl}
        alt={alt || ''}
        title={title || ''}
        className="rounded-lg max-w-full h-auto"
        data-testid="authenticated-image"
      />
    </NodeViewWrapper>
  )
}
