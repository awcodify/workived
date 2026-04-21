import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import { AuthenticatedImageExtension } from '@/lib/tiptap/AuthenticatedImageExtension'
import { typography } from '@/design/tokens'

// Create a uniquely named Link extension to avoid duplicate warnings with RichTextEditor
const ViewerLink = Link.extend({ name: 'viewerLink' })

interface RichTextViewerProps {
  content: string
  textColor?: string
  className?: string
}

export function RichTextViewer({ 
  content, 
  textColor = '#334155',
  className = ''
}: RichTextViewerProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      ViewerLink.configure({
        openOnClick: true,
        HTMLAttributes: {
          style: 'color: inherit; text-decoration: underline; cursor: pointer;',
        },
      }),
      AuthenticatedImageExtension.configure({
        inline: true,
        allowBase64: false,
      }),
    ],
    content,
    editable: false,
    editorProps: {
      attributes: {
        style: `
          outline: none;
          font-family: ${typography.fontFamily};
          font-size: 14px;
          font-weight: 500;
          color: ${textColor};
        `,
        class: `prose prose-sm max-w-none ${className}`,
      },
    },
  })

  return <EditorContent editor={editor} />
}
