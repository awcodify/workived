import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import { AuthenticatedImageExtension } from '@/lib/tiptap/AuthenticatedImageExtension'
import { typography } from '@/design/tokens'
import { uploadsApi } from '@/lib/api/uploads'
import { useState, useRef, useEffect } from 'react'
import { ImageUploadZone } from './ImageUploadZone'
import { X, Link as LinkIcon, Unlink, ImageIcon, Loader2 } from 'lucide-react'

interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  placeholder?: string
  textColor: string
  bgColor: string
  minHeight?: string
  purpose?: 'task_attachment' | 'comment_attachment'
}

export function RichTextEditor({ 
  value, 
  onChange, 
  onBlur,
  placeholder = 'Start typing...',
  textColor,
  bgColor,
  minHeight = '80px',
  purpose = 'task_attachment'
}: RichTextEditorProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [showImageModal, setShowImageModal] = useState(false)
  
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          style: 'color: inherit; text-decoration: underline; cursor: pointer;',
        },
      }),
      AuthenticatedImageExtension.configure({
        inline: true,
        allowBase64: false,
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()
      onChange(html)
    },
    onBlur: () => {
      onBlur?.()
    },
    editorProps: {
      attributes: {
        style: `
          outline: none;
          min-height: ${minHeight};
          padding: 0;
          font-family: ${typography.fontFamily};
          font-size: 14px;
          font-weight: 500;
          color: ${textColor};
        `,
      },
    },
  })

  // Update editor content when value changes externally
  if (editor && value !== editor.getHTML()) {
    editor.commands.setContent(value)
  }

  const toggleBold = () => editor?.chain().focus().toggleBold().run()
  const toggleItalic = () => editor?.chain().focus().toggleItalic().run()
  const toggleStrike = () => editor?.chain().focus().toggleStrike().run()
  const toggleBulletList = () => editor?.chain().focus().toggleBulletList().run()
  const toggleOrderedList = () => editor?.chain().focus().toggleOrderedList().run()
  const toggleCode = () => editor?.chain().focus().toggleCode().run()
  const toggleCodeBlock = () => editor?.chain().focus().toggleCodeBlock().run()
  const toggleBlockquote = () => editor?.chain().focus().toggleBlockquote().run()
  
  const setHeading = (level: 1 | 2 | 3) => {
    editor?.chain().focus().toggleHeading({ level }).run()
  }
  
  const setLink = () => {
    const url = window.prompt('Enter URL:')
    if (url) {
      editor?.chain().focus().setLink({ href: url }).run()
    }
  }

  const unsetLink = () => {
    editor?.chain().focus().unsetLink().run()
  }

  const handleImageUpload = async (file: File) => {
    if (!editor) return

    try {
      setIsUploading(true)
      
      // Upload image and get the public URL directly from backend
      const imageUrl = await uploadsApi.uploadImage(file, purpose)
      
      // Insert image into editor
      editor.chain().focus().setImage({ src: imageUrl }).run()
      
      // Close modal on success
      setShowImageModal(false)
    } catch (error) {
      console.error('Failed to upload image:', error)
      alert('Failed to upload image. Please try again.')
    } finally {
      setIsUploading(false)
    }
  }

  const handleImageButtonClick = () => {
    setShowImageModal(true)
  }

  // Handle paste images
  useEffect(() => {
    if (!editor) return

    const handlePaste = async (event: ClipboardEvent) => {
      const items = event.clipboardData?.items
      if (!items) return

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          event.preventDefault()
          const file = item.getAsFile()
          if (file) {
            await handleImageUpload(file)
          }
          break
        }
      }
    }

    editor.view.dom.addEventListener('paste', handlePaste)
    
    return () => {
      editor.view.dom.removeEventListener('paste', handlePaste)
    }
  }, [editor, purpose])

  // Handle drag and drop images
  useEffect(() => {
    if (!editor) return

    const handleDragOver = (event: Event) => {
      // Prevent default to allow drop
      event.preventDefault()
      event.stopPropagation()
    }

    const handleDrop = async (event: Event) => {
      event.preventDefault()
      event.stopPropagation()

      const dragEvent = event as DragEvent
      const files = dragEvent.dataTransfer?.files
      if (!files || files.length === 0) return

      // Find first image file
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        if (file && file.type.startsWith('image/')) {
          await handleImageUpload(file)
          break
        }
      }
    }

    const editorDom = editor.view.dom
    editorDom.addEventListener('dragover', handleDragOver)
    editorDom.addEventListener('drop', handleDrop)
    
    return () => {
      editorDom.removeEventListener('dragover', handleDragOver)
      editorDom.removeEventListener('drop', handleDrop)
    }
  }, [editor, purpose])

  if (!editor) {
    return null
  }

  return (
    <div>
      {/* Toolbar */}
      <div 
        className="flex flex-wrap gap-1 mb-2 p-2 rounded-t-lg border-b"
        style={{
          background: `${textColor}05`,
          borderColor: `${textColor}20`,
        }}
      >
        <button
          onClick={toggleBold}
          className={`px-2 py-1 rounded text-xs font-bold transition-all ${
            editor.isActive('bold') ? 'opacity-100' : 'opacity-50 hover:opacity-75'
          }`}
          style={{
            background: editor.isActive('bold') ? `${textColor}20` : 'transparent',
            color: textColor,
            fontFamily: typography.fontFamily,
          }}
          type="button"
          title="Bold (Ctrl+B)"
          data-testid="editor-bold-button"
        >
          <strong>B</strong>
        </button>
        
        <button
          onClick={toggleItalic}
          className={`px-2 py-1 rounded text-xs font-bold transition-all ${
            editor.isActive('italic') ? 'opacity-100' : 'opacity-50 hover:opacity-75'
          }`}
          style={{
            background: editor.isActive('italic') ? `${textColor}20` : 'transparent',
            color: textColor,
            fontFamily: typography.fontFamily,
          }}
          type="button"
          title="Italic (Ctrl+I)"
          data-testid="editor-italic-button"
        >
          <em>I</em>
        </button>
        
        <button
          onClick={toggleStrike}
          className={`px-2 py-1 rounded text-xs font-bold transition-all ${
            editor.isActive('strike') ? 'opacity-100' : 'opacity-50 hover:opacity-75'
          }`}
          style={{
            background: editor.isActive('strike') ? `${textColor}20` : 'transparent',
            color: textColor,
            fontFamily: typography.fontFamily,
          }}
          type="button"
          title="Strikethrough"
          data-testid="editor-strikethrough-button"
        >
          <s>S</s>
        </button>

        <div style={{ width: '1px', background: `${textColor}20`, margin: '0 4px' }} />
        
        <button
          onClick={toggleBulletList}
          className={`px-2 py-1 rounded text-xs font-bold transition-all ${
            editor.isActive('bulletList') ? 'opacity-100' : 'opacity-50 hover:opacity-75'
          }`}
          style={{
            background: editor.isActive('bulletList') ? `${textColor}20` : 'transparent',
            color: textColor,
            fontFamily: typography.fontFamily,
          }}
          type="button"
          title="Bullet List"
          data-testid="editor-bullet-list-button"
        >
          •
        </button>
        
        <button
          onClick={toggleOrderedList}
          className={`px-2 py-1 rounded text-xs font-bold transition-all ${
            editor.isActive('orderedList') ? 'opacity-100' : 'opacity-50 hover:opacity-75'
          }`}
          style={{
            background: editor.isActive('orderedList') ? `${textColor}20` : 'transparent',
            color: textColor,
            fontFamily: typography.fontFamily,
          }}
          type="button"
          title="Numbered List"
          data-testid="editor-ordered-list-button"
        >
          1.
        </button>

        <div style={{ width: '1px', background: `${textColor}20`, margin: '0 4px' }} />
        
        <button
          onClick={toggleCode}
          className={`px-2 py-1 rounded text-xs font-bold transition-all ${
            editor.isActive('code') ? 'opacity-100' : 'opacity-50 hover:opacity-75'
          }`}
          style={{
            background: editor.isActive('code') ? `${textColor}20` : 'transparent',
            color: textColor,
            fontFamily: typography.fontFamily,
          }}
          type="button"
          title="Inline Code"
          data-testid="editor-code-button"
        >
          {'<>'}
        </button>
        
        <button
          onClick={toggleCodeBlock}
          className={`px-2 py-1 rounded text-xs font-bold transition-all ${
            editor.isActive('codeBlock') ? 'opacity-100' : 'opacity-50 hover:opacity-75'
          }`}
          style={{
            background: editor.isActive('codeBlock') ? `${textColor}20` : 'transparent',
            color: textColor,
            fontFamily: typography.fontFamily,
          }}
          type="button"
          title="Code Block"
          data-testid="editor-code-block-button"
        >
          {'</>'}
        </button>

        <div style={{ width: '1px', background: `${textColor}20`, margin: '0 4px' }} />
        
        {/* Heading buttons */}
        <button
          onClick={() => setHeading(1)}
          className={`px-2 py-1 rounded text-xs font-bold transition-all ${
            editor.isActive('heading', { level: 1 }) ? 'opacity-100' : 'opacity-50 hover:opacity-75'
          }`}
          style={{
            background: editor.isActive('heading', { level: 1 }) ? `${textColor}20` : 'transparent',
            color: textColor,
            fontFamily: typography.fontFamily,
          }}
          type="button"
          title="Heading 1"
          data-testid="editor-h1-button"
        >
          H1
        </button>
        
        <button
          onClick={() => setHeading(2)}
          className={`px-2 py-1 rounded text-xs font-bold transition-all ${
            editor.isActive('heading', { level: 2 }) ? 'opacity-100' : 'opacity-50 hover:opacity-75'
          }`}
          style={{
            background: editor.isActive('heading', { level: 2 }) ? `${textColor}20` : 'transparent',
            color: textColor,
            fontFamily: typography.fontFamily,
          }}
          type="button"
          title="Heading 2"
          data-testid="editor-h2-button"
        >
          H2
        </button>
        
        <button
          onClick={() => setHeading(3)}
          className={`px-2 py-1 rounded text-xs font-bold transition-all ${
            editor.isActive('heading', { level: 3 }) ? 'opacity-100' : 'opacity-50 hover:opacity-75'
          }`}
          style={{
            background: editor.isActive('heading', { level: 3 }) ? `${textColor}20` : 'transparent',
            color: textColor,
            fontFamily: typography.fontFamily,
          }}
          type="button"
          title="Heading 3"
          data-testid="editor-h3-button"
        >
          H3
        </button>

        <div style={{ width: '1px', background: `${textColor}20`, margin: '0 4px' }} />
        
        {/* Blockquote button */}
        <button
          onClick={toggleBlockquote}
          className={`px-2 py-1 rounded text-xs font-bold transition-all ${
            editor.isActive('blockquote') ? 'opacity-100' : 'opacity-50 hover:opacity-75'
          }`}
          style={{
            background: editor.isActive('blockquote') ? `${textColor}20` : 'transparent',
            color: textColor,
            fontFamily: typography.fontFamily,
          }}
          type="button"
          title="Blockquote"
          data-testid="editor-blockquote-button"
        >
          "
        </button>

        <div style={{ width: '1px', background: `${textColor}20`, margin: '0 4px' }} />
        
        {editor.isActive('link') ? (
          <button
            onClick={unsetLink}
            className="px-2 py-1 rounded text-xs font-bold opacity-100"
            style={{
              background: `${textColor}20`,
              color: textColor,
              fontFamily: typography.fontFamily,
            }}
            type="button"
            title="Remove Link"
            data-testid="editor-unlink-button"
          >
            <Unlink size={14} />
          </button>
        ) : (
          <button
            onClick={setLink}
            className="px-2 py-1 rounded text-xs font-bold opacity-50 hover:opacity-75 transition-all"
            style={{
              background: 'transparent',
              color: textColor,
              fontFamily: typography.fontFamily,
            }}
            type="button"
            title="Add Link"
            data-testid="editor-link-button"
          >
            <LinkIcon size={14} />
          </button>
        )}

        <div style={{ width: '1px', background: `${textColor}20`, margin: '0 4px' }} />
        
        {/* Image upload button */}
        <button
          onClick={handleImageButtonClick}
          disabled={isUploading}
          className="px-2 py-1 rounded text-xs font-bold opacity-50 hover:opacity-75 transition-all disabled:opacity-30"
          style={{
            background: 'transparent',
            color: textColor,
            fontFamily: typography.fontFamily,
          }}
          type="button"
          title={isUploading ? 'Uploading...' : 'Insert Image (drag & drop or paste supported)'}
          data-testid="editor-image-button"
        >
          {isUploading ? <Loader2 size={14} className="animate-spin" /> : <ImageIcon size={14} />}
        </button>
      </div>

      {/* Editor Content */}
      <div
        className="rounded-b-lg px-4 py-2.5 prose prose-sm max-w-none"
        style={{
          background: bgColor,
          border: `2px solid ${textColor}20`,
          borderTop: 'none',
        }}
      >
        <style>{`
          .ProseMirror {
            outline: none;
          }
          
          .ProseMirror h1 {
            font-size: 1.875rem;
            font-weight: 700;
            margin-top: 1.5rem;
            margin-bottom: 0.75rem;
            line-height: 1.2;
            color: ${textColor};
          }
          
          .ProseMirror h2 {
            font-size: 1.5rem;
            font-weight: 700;
            margin-top: 1.25rem;
            margin-bottom: 0.5rem;
            line-height: 1.3;
            color: ${textColor};
          }
          
          .ProseMirror h3 {
            font-size: 1.25rem;
            font-weight: 600;
            margin-top: 1rem;
            margin-bottom: 0.5rem;
            line-height: 1.4;
            color: ${textColor};
          }
          
          .ProseMirror p {
            margin-top: 0.5rem;
            margin-bottom: 0.5rem;
            line-height: 1.6;
          }
          
          .ProseMirror code {
            background: rgba(0, 0, 0, 0.05);
            border: 1px solid rgba(0, 0, 0, 0.1);
            border-radius: 3px;
            padding: 2px 6px;
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            font-size: 0.875em;
            color: #d63384;
          }
          
          .ProseMirror pre {
            background: rgba(0, 0, 0, 0.05);
            border: 1px solid rgba(0, 0, 0, 0.1);
            border-radius: 6px;
            padding: 12px;
            margin: 0.75rem 0;
            overflow-x: auto;
          }
          
          .ProseMirror pre code {
            background: none;
            border: none;
            padding: 0;
            color: inherit;
            font-size: 0.875rem;
          }
          
          .ProseMirror ul,
          .ProseMirror ol {
            padding-left: 1.5rem;
            margin: 0.75rem 0;
          }
          
          .ProseMirror ul {
            list-style-type: disc;
          }
          
          .ProseMirror ol {
            list-style-type: decimal;
          }
          
          .ProseMirror li {
            margin: 0.25rem 0;
            line-height: 1.6;
          }
          
          .ProseMirror li p {
            margin: 0;
          }
          
          .ProseMirror a {
            color: #2563eb;
            text-decoration: underline;
            cursor: pointer;
          }
          
          .ProseMirror a:hover {
            color: #1d4ed8;
          }
          
          .ProseMirror blockquote {
            border-left: 3px solid rgba(0, 0, 0, 0.2);
            padding-left: 1rem;
            margin-left: 0;
            margin-right: 0;
            margin-top: 0.75rem;
            margin-bottom: 0.75rem;
            color: rgba(0, 0, 0, 0.6);
          }
          
          .ProseMirror hr {
            border: none;
            border-top: 2px solid rgba(0, 0, 0, 0.1);
            margin: 1.5rem 0;
          }
          
          .ProseMirror img {
            max-width: 100%;
            height: auto;
            border-radius: 8px;
            margin: 0.75rem 0;
            display: block;
          }
          
          .ProseMirror img.ProseMirror-selectednode {
            outline: 3px solid #2563eb;
          }
        `}</style>
        <EditorContent editor={editor} />
      </div>

      {/* Image Upload Modal */}
      {showImageModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
          onClick={() => !isUploading && setShowImageModal(false)}
          data-testid="image-upload-modal-overlay"
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6"
            onClick={(e) => e.stopPropagation()}
            style={{ fontFamily: typography.fontFamily }}
            data-testid="image-upload-modal"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-4">
              <h3
                className="text-lg font-bold"
                style={{ color: textColor }}
                data-testid="image-upload-modal-title"
              >
                Insert Image
              </h3>
              <button
                onClick={() => !isUploading && setShowImageModal(false)}
                disabled={isUploading}
                className="p-1 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
                style={{ color: textColor }}
                data-testid="image-upload-modal-close-button"
              >
                <X size={20} />
              </button>
            </div>

            {/* Upload Zone */}
            <ImageUploadZone
              onImageSelect={handleImageUpload}
              isUploading={isUploading}
              maxSizeMB={5}
              acceptedFormats={['image/jpeg', 'image/png', 'image/gif', 'image/webp']}
              textColor={textColor}
              accentColor="#3B82F6"
            />

            {/* Helper Text */}
            <p
              className="mt-4 text-xs text-center"
              style={{ color: `${textColor}60` }}
              data-testid="image-upload-modal-helper"
            >
              Tip: You can also paste images directly into the editor
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
