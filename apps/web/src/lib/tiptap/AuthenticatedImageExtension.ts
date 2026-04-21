import Image from '@tiptap/extension-image'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { AuthenticatedImage } from '@/components/AuthenticatedImage'

export const AuthenticatedImageExtension = Image.extend({
  addNodeView() {
    return ReactNodeViewRenderer(AuthenticatedImage)
  },
})
