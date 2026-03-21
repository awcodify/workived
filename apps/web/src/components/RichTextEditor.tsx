import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import { typography } from '@/design/tokens'

interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  placeholder?: string
  textColor: string
  bgColor: string
  minHeight?: string
}

export function RichTextEditor({ 
  value, 
  onChange, 
  onBlur,
  placeholder = 'Start typing...',
  textColor,
  bgColor,
  minHeight = '80px'
}: RichTextEditorProps) {
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
  
  const setLink = () => {
    const url = window.prompt('Enter URL:')
    if (url) {
      editor?.chain().focus().setLink({ href: url }).run()
    }
  }

  const unsetLink = () => {
    editor?.chain().focus().unsetLink().run()
  }

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
        >
          {'</>'}
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
          >
            🔗✕
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
          >
            🔗
          </button>
        )}
      </div>

      {/* Editor Content */}
      <div
        className="rounded-b-lg px-4 py-2.5"
        style={{
          background: bgColor,
          border: `2px solid ${textColor}20`,
          borderTop: 'none',
        }}
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
