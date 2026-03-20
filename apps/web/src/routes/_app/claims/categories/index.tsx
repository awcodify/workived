import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Plus, Pencil, Trash2, Receipt, Download } from 'lucide-react'
import { useCategories, useDeactivateCategory } from '@/lib/hooks/useClaims'
import { useCanManageClaims } from '@/lib/hooks/useRole'
import { useState, useEffect } from 'react'
import { moduleBackgrounds, moduleThemes, typography } from '@/design/tokens'
import { CategoryModal } from '@/components/workived/claims/CategoryModal'
import { ImportCategoryTemplatesModal } from '@/components/workived/claims/ImportCategoryTemplatesModal'
import type { ClaimCategory } from '@/types/api'

const t = moduleThemes.claims

export const Route = createFileRoute('/_app/claims/categories/')({
  component: CategoriesPage,
})

function CategoriesPage() {
  const navigate = useNavigate()
  const canManage = useCanManageClaims()
  const { data: categories, isLoading } = useCategories()
  const deactivateMutation = useDeactivateCategory()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [editingCategory, setEditingCategory] = useState<ClaimCategory | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)

  // Redirect if no permission
  useEffect(() => {
    if (!canManage) {
      navigate({ to: '/claims' })
    }
  }, [canManage, navigate])

  const handleDeactivate = async (id: string) => {
    if (deletingId === id) {
      try {
        await deactivateMutation.mutateAsync(id)
        setDeletingId(null)
      } catch (error) {
        // Error handled by mutation
      }
    } else {
      setDeletingId(id)
    }
  }

  const activeCategories = categories?.filter((c) => c.is_active) ?? []

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  return (
    <div
      className="min-h-screen px-6 py-8 md:px-11 md:py-10 pb-28"
      style={{ background: moduleBackgrounds.claims }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1
            className="font-extrabold"
            style={{
              fontSize: typography.display.size,
              letterSpacing: typography.display.tracking,
              color: t.text,
              lineHeight: typography.display.lineHeight,
            }}
          >
            Claim Categories
          </h1>
          <p className="text-sm mt-2" style={{ color: t.textMuted }}>
            {activeCategories.length} active categor{activeCategories.length === 1 ? 'y' : 'ies'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2.5 transition-opacity hover:opacity-70"
            style={{
              background: t.surface,
              color: t.accent,
              borderRadius: 12,
              border: `1px solid ${t.border}`,
            }}
          >
            <Download size={16} />
            Import Templates
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2.5 transition-colors hover:opacity-90"
            style={{
              background: t.accent,
              color: t.accentText,
              borderRadius: 12,
            }}
          >
            <Plus size={16} />
            Add category
          </button>
        </div>
      </div>

      {/* Categories List */}
      {isLoading ? (
        <CategoriesSkeleton />
      ) : !activeCategories || activeCategories.length === 0 ? (
        <EmptyCategories 
          onCreate={() => setShowCreateModal(true)} 
          onImport={() => setShowImportModal(true)}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {activeCategories.map((category) => (
            <div
              key={category.id}
              className="transition-all duration-150 hover:-translate-y-px"
              style={{
                background: t.surface,
                borderRadius: 14,
                border: `1px solid ${t.border}`,
                padding: 20,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = t.surfaceHover
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = t.surface
              }}
            >
              {/* Category Info */}
              <div className="mb-4">
                <h3
                  className="font-bold mb-3"
                  style={{
                    fontSize: typography.h2.size,
                    letterSpacing: typography.h2.tracking,
                    color: t.text,
                  }}
                >
                  {category.name}
                </h3>
                <div
                  className="space-y-2"
                  style={{
                    fontSize: typography.label.size,
                    color: t.textMuted,
                  }}
                >
                  {category.monthly_limit && category.currency_code && (
                    <div className="flex items-center gap-2">
                      <span className="font-semibold" style={{ color: t.text }}>
                        Limit:
                      </span>
                      <span>
                        {formatCurrency(category.monthly_limit, category.currency_code)}/month
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Receipt size={14} />
                    <span>
                      {category.requires_receipt ? 'Receipt required' : 'Receipt optional'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setEditingCategory(category)}
                  className="flex items-center gap-1.5 text-sm font-semibold px-3 py-2 transition-opacity hover:opacity-70"
                  style={{
                    color: t.accent,
                  }}
                >
                  <Pencil size={14} />
                  Edit
                </button>
                <button
                  onClick={() => handleDeactivate(category.id)}
                  disabled={deactivateMutation.isPending && deletingId === category.id}
                  className="flex items-center gap-1.5 text-sm font-semibold px-3 py-2 transition-opacity hover:opacity-70 disabled:opacity-50"
                  style={{
                    color: deletingId === category.id ? '#EF4444' : t.textMuted,
                  }}
                >
                  <Trash2 size={14} />
                  {deletingId === category.id ? 'Confirm?' : 'Delete'}
                </button>
              </div>

              {deactivateMutation.isError && deletingId === category.id && (
                <p
                  className="text-xs mt-2"
                  style={{ color: '#EF4444' }}
                >
                  Failed to delete. May have active claims.
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      {showCreateModal && (
        <CategoryModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => setShowCreateModal(false)}
        />
      )}
      {editingCategory && (
        <CategoryModal
          category={editingCategory}
          onClose={() => setEditingCategory(null)}
          onSuccess={() => setEditingCategory(null)}
        />
      )}
      {showImportModal && (
        <ImportCategoryTemplatesModal onClose={() => setShowImportModal(false)} />
      )}
    </div>
  )
}

// ── Empty State ──────────────────────────────────────────────────────
function EmptyCategories({ onCreate, onImport }: { onCreate: () => void; onImport: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <div
        className="grid place-items-center"
        style={{ width: 56, height: 56, borderRadius: 16, background: t.accent }}
      >
        <Receipt size={26} style={{ color: t.accentText }} />
      </div>
      <p className="font-bold" style={{ fontSize: 16, color: t.text }}>
        No claim categories yet
      </p>
      <p style={{ fontSize: 13, color: t.textMuted, maxWidth: 320, textAlign: 'center' }}>
        Create categories like Travel, Meals, or Equipment to organize employee expense claims.
      </p>
      <div className="flex items-center gap-2 mt-2">
        <button
          onClick={onImport}
          className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2.5 transition-opacity hover:opacity-70"
          style={{
            background: t.surface,
            color: t.accent,
            borderRadius: 12,
            border: `1px solid ${t.border}`,
          }}
        >
          <Download size={16} />
          Import Templates
        </button>
        <button
          onClick={onCreate}
          className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2.5 transition-colors hover:opacity-90"
          style={{
            background: t.accent,
            color: t.accentText,
            borderRadius: 12,
          }}
        >
          <Plus size={16} />
          Create first category
        </button>
      </div>
    </div>
  )
}

// ── Skeleton Loader ──────────────────────────────────────────────────
function CategoriesSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse"
          style={{
            background: t.surface,
            borderRadius: 14,
            border: `1px solid ${t.border}`,
            padding: 20,
            height: 160,
          }}
        >
          <div
            className="h-6 mb-3 rounded"
            style={{ background: t.input, width: '70%' }}
          />
          <div
            className="h-4 mb-2 rounded"
            style={{ background: t.input, width: '50%' }}
          />
          <div
            className="h-4 rounded"
            style={{ background: t.input, width: '60%' }}
          />
        </div>
      ))}
    </div>
  )
}
