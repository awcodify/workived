import { createFileRoute, Link } from '@tanstack/react-router'
import { moduleThemes, colors, typography } from '@/design/tokens'
import { ArrowLeft, FileText } from 'lucide-react'

export const Route = createFileRoute('/_app/my-documents')({
  component: MyDocumentsPage,
})

const t = moduleThemes.people

function MyDocumentsPage() {
  return (
    <div
      className="min-h-screen px-6 py-8 md:px-11 md:py-10"
      data-testid="my-documents-page"
      style={{ background: colors.ink50, paddingBottom: '160px' }}
    >
      <div className="max-w-3xl mx-auto">
        {/* Back link */}
        <Link
          to="/overview"
          className="inline-flex items-center gap-1.5 text-sm font-medium mb-6"
          style={{ color: colors.ink500 }}
        >
          <ArrowLeft size={16} /> Back
        </Link>

        {/* Page header */}
        <h1
          className="mb-2"
          style={{
            fontSize: 28,
            fontWeight: 800,
            letterSpacing: typography.h1.tracking,
            color: t.text,
          }}
        >
          My Documents
        </h1>
        <p className="mb-8" style={{ fontSize: 14, color: colors.ink500 }}>
          Contracts, certificates, and files shared with you
        </p>

        {/* Coming soon card */}
        <div
          className="rounded-2xl p-8 flex flex-col items-center justify-center text-center"
          style={{ background: colors.ink0, border: `1px solid ${colors.ink100}` }}
        >
          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center mb-5"
            style={{ background: colors.accentDim }}
          >
            <FileText size={24} style={{ color: colors.accent }} />
          </div>
          <h2
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: t.text,
              letterSpacing: typography.h3.tracking,
            }}
          >
            Coming Soon
          </h2>
          <p
            className="mt-2 max-w-sm"
            style={{ fontSize: 14, color: colors.ink500, lineHeight: '1.6' }}
          >
            Your HR administrator will be able to upload documents here — employment contracts, certificates, onboarding materials, and more.
          </p>
        </div>
      </div>
    </div>
  )
}
