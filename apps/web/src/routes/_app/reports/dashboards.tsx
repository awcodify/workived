import React, { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { LayoutDashboard, Plus, Trash2, X } from 'lucide-react'
import { moduleThemes, typography } from '@/design/tokens'
import {
  useDashboards,
  useCreateDashboard,
  useDeleteDashboard,
  useWidgets,
  useCreateWidget,
  useUpdateWidget,
  useDeleteWidget,
} from '@/lib/hooks/useDashboard'
import { KpiWidget } from '@/components/dashboard/KpiWidget'
import { TableWidget } from '@/components/dashboard/TableWidget'
import { WidgetConfigPanel } from '@/components/dashboard/WidgetConfigPanel'
import type { Widget, QueryConfig, VizConfig, WidgetType } from '@/types/api'

export const Route = createFileRoute('/_app/reports/dashboards')({
  component: DashboardsPage,
})

const theme = moduleThemes.reports

function DashboardsPage() {
  const { data: dashboards = [], isLoading: dashLoading } = useDashboards()
  const createDashboard = useCreateDashboard()
  const deleteDashboard = useDeleteDashboard()

  const [activeDashId, setActiveDashId] = useState<string | null>(null)
  const [showNewDash, setShowNewDash] = useState(false)
  const [newDashName, setNewDashName] = useState('')
  const [showWidgetPanel, setShowWidgetPanel] = useState(false)
  const [editingWidget, setEditingWidget] = useState<Widget | null>(null)

  const activeDash = dashboards.find((d) => d.id === activeDashId) ?? dashboards[0] ?? null
  const { data: widgets = [], isLoading: widgetsLoading } = useWidgets(activeDash?.id ?? '')
  const createWidget = useCreateWidget()
  const updateWidget = useUpdateWidget()
  const deleteWidget = useDeleteWidget()

  const handleCreateDashboard = async () => {
    if (!newDashName.trim()) return
    const d = await createDashboard.mutateAsync({ name: newDashName })
    setActiveDashId(d.id)
    setNewDashName('')
    setShowNewDash(false)
  }

  const handleSaveWidget = async (
    title: string,
    type: WidgetType,
    query: QueryConfig,
    viz: VizConfig,
  ) => {
    if (!activeDash) return
    if (editingWidget) {
      await updateWidget.mutateAsync({
        dashboardId: activeDash.id,
        widgetId: editingWidget.id,
        title,
        widget_type: type,
        query_config: query,
        viz_config: viz,
        position_x: editingWidget.position_x,
        position_y: editingWidget.position_y,
        width: editingWidget.width,
        height: editingWidget.height,
      })
    } else {
      await createWidget.mutateAsync({
        dashboardId: activeDash.id,
        title,
        widget_type: type,
        query_config: query,
        viz_config: viz,
      })
    }
    setShowWidgetPanel(false)
    setEditingWidget(null)
  }

  return (
    <div
      className="min-h-screen"
      style={{ background: theme.background, color: '#fff', fontFamily: 'Plus Jakarta Sans, sans-serif' }}
    >
      {/* ── Header ── */}
      <div className="px-8 pt-8 pb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight" style={typography.h1}>
            Dashboards
          </h1>
          <p className="text-sm text-white/40 mt-1">Custom analytics for your org</p>
        </div>
        <button
          onClick={() => setShowNewDash(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#6357E8] text-white text-sm font-medium hover:bg-purple-500 transition-colors"
        >
          <Plus size={14} />
          New Dashboard
        </button>
      </div>

      {/* ── New dashboard input ── */}
      {showNewDash && (
        <div className="mx-8 mb-6 flex gap-2">
          <input
            autoFocus
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/30"
            placeholder="Dashboard name…"
            value={newDashName}
            onChange={(e) => setNewDashName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateDashboard()
              if (e.key === 'Escape') { setShowNewDash(false); setNewDashName('') }
            }}
          />
          <button
            onClick={handleCreateDashboard}
            disabled={!newDashName.trim() || createDashboard.isPending}
            className="px-4 py-2 rounded-xl bg-[#6357E8] text-white text-sm disabled:opacity-40 hover:bg-purple-500 transition-colors"
          >
            Create
          </button>
          <button
            onClick={() => { setShowNewDash(false); setNewDashName('') }}
            className="p-2 rounded-xl text-white/40 hover:text-white hover:bg-white/5"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* ── Dashboard tabs ── */}
      {dashboards.length > 0 && (
        <div className="px-8 flex gap-1 mb-6">
          {dashboards.map((d) => (
            <div key={d.id} className="group relative flex items-center">
              <button
                onClick={() => setActiveDashId(d.id)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                  (activeDash?.id === d.id)
                    ? 'bg-white/10 text-white'
                    : 'text-white/40 hover:text-white hover:bg-white/5'
                }`}
              >
                {d.name}
              </button>
              <button
                onClick={() => {
                  deleteDashboard.mutate(d.id)
                  if (activeDash?.id === d.id) setActiveDashId(null)
                }}
                className="hidden group-hover:flex absolute -top-1 -right-1 w-4 h-4 items-center justify-center rounded-full bg-red-500 text-white text-[9px]"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Main content ── */}
      {dashLoading ? (
        <div className="px-8 flex items-center justify-center h-48 text-white/30">Loading…</div>
      ) : dashboards.length === 0 ? (
        <EmptyState onNew={() => setShowNewDash(true)} />
      ) : !activeDash ? null : (
        <div className="px-8 pb-12">
          {/* Add widget button */}
          <div className="flex items-center justify-between mb-5">
            <p className="text-sm text-white/40">{widgets.length} widget{widgets.length !== 1 ? 's' : ''}</p>
            <button
              onClick={() => { setEditingWidget(null); setShowWidgetPanel(true) }}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 text-white/60 text-sm hover:bg-white/10 transition-colors"
            >
              <Plus size={13} />
              Add Widget
            </button>
          </div>

          {/* Widget grid */}
          {widgetsLoading ? (
            <div className="grid grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-40 rounded-2xl bg-white/5 animate-pulse" />
              ))}
            </div>
          ) : widgets.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3 rounded-2xl border border-dashed border-white/10">
              <LayoutDashboard size={32} className="text-white/20" />
              <p className="text-white/30 text-sm">No widgets yet</p>
              <button
                onClick={() => setShowWidgetPanel(true)}
                className="text-[#6357E8] text-sm hover:text-purple-300 transition-colors"
              >
                Add your first widget
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {widgets.map((widget) => (
                <WidgetCard
                  key={widget.id}
                  widget={widget}
                  onEdit={() => { setEditingWidget(widget); setShowWidgetPanel(true) }}
                  onDelete={() => deleteWidget.mutate({ dashboardId: activeDash.id, widgetId: widget.id })}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Widget config slide-over ── */}
      {showWidgetPanel && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="flex-1 bg-black/50 backdrop-blur-sm"
            onClick={() => { setShowWidgetPanel(false); setEditingWidget(null) }}
          />
          <div
            className="w-[420px] h-full overflow-y-auto shadow-2xl"
            style={{ background: '#1a1a2e', borderLeft: '1px solid rgba(255,255,255,0.08)' }}
          >
            <div className="sticky top-0 flex items-center justify-between px-6 py-4 border-b border-white/5"
              style={{ background: '#1a1a2e' }}
            >
              <h2 className="font-semibold text-white text-sm">
                {editingWidget ? 'Edit Widget' : 'New Widget'}
              </h2>
              <button
                onClick={() => { setShowWidgetPanel(false); setEditingWidget(null) }}
                className="text-white/40 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>
            <WidgetConfigPanel
              initialTitle={editingWidget?.title}
              initialType={editingWidget?.widget_type}
              initialQuery={editingWidget?.query_config}
              initialViz={editingWidget?.viz_config}
              onSave={handleSaveWidget}
              onCancel={() => { setShowWidgetPanel(false); setEditingWidget(null) }}
              saving={createWidget.isPending || updateWidget.isPending}
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function WidgetCard({ widget, onEdit, onDelete }: { widget: Widget; onEdit: () => void; onDelete: () => void }) {
  if (widget.widget_type === 'kpi') {
    return <KpiWidget widget={widget} onEdit={onEdit} onDelete={onDelete} />
  }
  if (widget.widget_type === 'table') {
    return <TableWidget widget={widget} onEdit={onEdit} onDelete={onDelete} />
  }
  return (
    <div className="rounded-2xl p-5 bg-white/5 border border-white/8 text-white/30 text-sm">
      {widget.widget_type} — not yet supported
    </div>
  )
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="mx-8 flex flex-col items-center justify-center h-64 gap-4 rounded-2xl border border-dashed border-white/10">
      <LayoutDashboard size={40} className="text-white/20" />
      <div className="text-center">
        <p className="text-white/40 text-sm">No dashboards yet</p>
        <p className="text-white/20 text-xs mt-1">Build custom views over your task and HR data</p>
      </div>
      <button
        onClick={onNew}
        className="px-4 py-2 rounded-xl bg-[#6357E8] text-white text-sm hover:bg-purple-500 transition-colors"
      >
        Create Dashboard
      </button>
    </div>
  )
}
