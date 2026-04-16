import React, { useState, useRef, useCallback, useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { ResponsiveGridLayout, useContainerWidth, type Layout } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import { LayoutDashboard, Plus, X, BarChart2, LineChart, Table2, Hash, ChevronLeft, Users } from 'lucide-react'
import { Dropdown } from '@/components/workived/shared/Dropdown'
import { moduleBackgrounds, moduleThemes, typography } from '@/design/tokens'
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
import { BarWidget } from '@/components/dashboard/BarWidget'
import { LineWidget } from '@/components/dashboard/LineWidget'
import { WidgetConfigPanel } from '@/components/dashboard/WidgetConfigPanel'
import { ReportsTabs } from '@/components/workived/reports/ReportsTabs'
import type { Widget, QueryConfig, VizConfig, WidgetType } from '@/types/api'

export const Route = createFileRoute('/_app/reports/dashboards')({
  component: DashboardsPage,
})

const bg = moduleBackgrounds.reports
const t = moduleThemes.reports

// ── Grid constants ────────────────────────────────────────────────────────────

const ROW_HEIGHT = 80
const GRID_MARGIN: [number, number] = [12, 12]
const COLS = { lg: 12, sm: 2 }
const BREAKPOINTS = { lg: 992, sm: 0 }

// ── Starter templates ─────────────────────────────────────────────────────────

interface TemplateWidgetDef {
  title: string
  widget_type: WidgetType
  query_config: QueryConfig
  viz_config: VizConfig
  position_x: number
  position_y: number
  width: number
  height: number
}

interface DashboardTemplate {
  id: string
  name: string
  description: string
  widgets: TemplateWidgetDef[]
}

const TEMPLATES: DashboardTemplate[] = [
  {
    id: 'hr-overview',
    name: 'HR Overview',
    description: 'Attendance health, late arrivals, leave pipeline, and work-hour trends',
    widgets: [
      // Row 1 — 4 KPIs
      {
        title: 'Present This Month',
        widget_type: 'kpi',
        query_config: { source: 'attendance', aggregate: 'count', date_range: 'this_month' },
        viz_config: { color: '#12A05C' },
        position_x: 0, position_y: 0, width: 3, height: 2,
      },
      {
        title: 'Late Arrivals This Month',
        widget_type: 'kpi',
        query_config: { source: 'attendance', aggregate: 'count', filters: [{ field: 'is_late', op: 'eq', value: true }], date_range: 'this_month' },
        viz_config: { color: '#D44040' },
        position_x: 3, position_y: 0, width: 3, height: 2,
      },
      {
        title: 'Avg Work Hours / Day',
        widget_type: 'kpi',
        query_config: { source: 'attendance', aggregate: 'avg', field: 'hours_worked', date_range: 'this_month' },
        viz_config: { color: '#6357E8', unit: 'hrs' },
        position_x: 6, position_y: 0, width: 3, height: 2,
      },
      {
        title: 'Pending Leave Requests',
        widget_type: 'kpi',
        query_config: { source: 'leave', aggregate: 'count', filters: [{ field: 'status', op: 'eq', value: 'pending' }] },
        viz_config: { color: '#C97B2A' },
        position_x: 9, position_y: 0, width: 3, height: 2,
      },
      // Row 2 — attendance trend + status breakdown
      {
        title: 'Daily Attendance (Last 30 Days)',
        widget_type: 'line',
        query_config: { source: 'attendance', aggregate: 'count', date_bucket: 'day', date_range: 'last_30_days' },
        viz_config: { color: '#6357E8' },
        position_x: 0, position_y: 2, width: 8, height: 3,
      },
      {
        title: 'Attendance by Status',
        widget_type: 'bar',
        query_config: { source: 'attendance', aggregate: 'count', group_by: 'status', date_range: 'this_month' },
        viz_config: { color: '#12A05C' },
        position_x: 8, position_y: 2, width: 4, height: 3,
      },
      // Row 3 — leave breakdown
      {
        title: 'Leave Days by Type',
        widget_type: 'bar',
        query_config: { source: 'leave', aggregate: 'sum', field: 'total_days', group_by: 'leave_type' },
        viz_config: { color: '#6357E8' },
        position_x: 0, position_y: 5, width: 6, height: 3,
      },
      {
        title: 'Leave Requests by Status',
        widget_type: 'kpi',
        query_config: { source: 'leave', aggregate: 'count', group_by: 'status' },
        viz_config: { color: '#C97B2A' },
        position_x: 6, position_y: 5, width: 3, height: 3,
      },
      {
        title: 'Late Arrivals Trend (Weekly)',
        widget_type: 'line',
        query_config: { source: 'attendance', aggregate: 'count', date_bucket: 'week', filters: [{ field: 'is_late', op: 'eq', value: true }], date_range: 'this_quarter' },
        viz_config: { color: '#D44040' },
        position_x: 9, position_y: 5, width: 3, height: 3,
      },
    ],
  },
  {
    id: 'task-tracker',
    name: 'Task Tracker',
    description: 'Open tasks, overdue risk, velocity trend, and workload distribution',
    widgets: [
      // Row 1 — 4 KPIs
      {
        title: 'Open Tasks',
        widget_type: 'kpi',
        query_config: { source: 'tasks', aggregate: 'count', filters: [{ field: 'is_completed', op: 'eq', value: false }] },
        viz_config: { color: '#6357E8' },
        position_x: 0, position_y: 0, width: 3, height: 2,
      },
      {
        title: 'Overdue',
        widget_type: 'kpi',
        query_config: { source: 'tasks', aggregate: 'count', filters: [{ field: 'is_completed', op: 'eq', value: false }, { field: 'due_date', op: 'lt', value: 'today' }] },
        viz_config: { color: '#D44040' },
        position_x: 3, position_y: 0, width: 3, height: 2,
      },
      {
        title: 'Completed This Month',
        widget_type: 'kpi',
        query_config: { source: 'tasks', aggregate: 'count', filters: [{ field: 'completed_at', op: 'gte', value: 'this_month' }, { field: 'is_completed', op: 'eq', value: true }] },
        viz_config: { color: '#12A05C' },
        position_x: 6, position_y: 0, width: 3, height: 2,
      },
      {
        title: 'Completed This Week',
        widget_type: 'kpi',
        query_config: { source: 'tasks', aggregate: 'count', filters: [{ field: 'completed_at', op: 'gte', value: 'this_week' }, { field: 'is_completed', op: 'eq', value: true }] },
        viz_config: { color: '#12A05C' },
        position_x: 9, position_y: 0, width: 3, height: 2,
      },
      // Row 2 — velocity + priority
      {
        title: 'Task Completion Trend (Daily)',
        widget_type: 'line',
        query_config: { source: 'tasks', aggregate: 'count', date_bucket: 'day', date_range: 'last_30_days', filters: [{ field: 'is_completed', op: 'eq', value: true }] },
        viz_config: { color: '#12A05C' },
        position_x: 0, position_y: 2, width: 8, height: 3,
      },
      {
        title: 'Open Tasks by Priority',
        widget_type: 'kpi',
        query_config: { source: 'tasks', aggregate: 'count', group_by: 'priority', filters: [{ field: 'is_completed', op: 'eq', value: false }] },
        viz_config: { color: '#6357E8' },
        position_x: 8, position_y: 2, width: 4, height: 3,
      },
      // Row 3 — workload distribution
      {
        title: 'Open Tasks by Assignee',
        widget_type: 'bar',
        query_config: { source: 'tasks', aggregate: 'count', group_by: 'assignee_name', filters: [{ field: 'is_completed', op: 'eq', value: false }] },
        viz_config: { color: '#6357E8' },
        position_x: 0, position_y: 5, width: 6, height: 3,
      },
      {
        title: 'Tasks by Status',
        widget_type: 'bar',
        query_config: { source: 'tasks', aggregate: 'count', group_by: 'status' },
        viz_config: { color: '#C97B2A' },
        position_x: 6, position_y: 5, width: 6, height: 3,
      },
    ],
  },
  {
    id: 'claims-monitor',
    name: 'Claims Monitor',
    description: 'Spend visibility, approval pipeline, category breakdown, and monthly trends',
    widgets: [
      // Row 1 — 4 KPIs
      {
        title: 'Claims This Month',
        widget_type: 'kpi',
        query_config: { source: 'claims', aggregate: 'count', date_range: 'this_month' },
        viz_config: { color: '#6357E8' },
        position_x: 0, position_y: 0, width: 3, height: 2,
      },
      {
        title: 'Total Spend This Month',
        widget_type: 'kpi',
        query_config: { source: 'claims', aggregate: 'sum', field: 'amount', date_range: 'this_month' },
        viz_config: { color: '#6357E8' },
        position_x: 3, position_y: 0, width: 3, height: 2,
      },
      {
        title: 'Pending Approval',
        widget_type: 'kpi',
        query_config: { source: 'claims', aggregate: 'count', filters: [{ field: 'status', op: 'eq', value: 'pending' }] },
        viz_config: { color: '#C97B2A' },
        position_x: 6, position_y: 0, width: 3, height: 2,
      },
      {
        title: 'Avg Claim Amount',
        widget_type: 'kpi',
        query_config: { source: 'claims', aggregate: 'avg', field: 'amount', date_range: 'this_month' },
        viz_config: { color: '#3B82F6' },
        position_x: 9, position_y: 0, width: 3, height: 2,
      },
      // Row 2 — monthly trend + status
      {
        title: 'Monthly Claim Volume (This Year)',
        widget_type: 'line',
        query_config: { source: 'claims', aggregate: 'count', date_bucket: 'month', date_range: 'this_year' },
        viz_config: { color: '#6357E8' },
        position_x: 0, position_y: 2, width: 8, height: 3,
      },
      {
        title: 'Claims by Status',
        widget_type: 'kpi',
        query_config: { source: 'claims', aggregate: 'count', group_by: 'status' },
        viz_config: { color: '#C97B2A' },
        position_x: 8, position_y: 2, width: 4, height: 3,
      },
      // Row 3 — spend breakdown
      {
        title: 'Spend by Category',
        widget_type: 'bar',
        query_config: { source: 'claims', aggregate: 'sum', field: 'amount', group_by: 'category_name' },
        viz_config: { color: '#6357E8' },
        position_x: 0, position_y: 5, width: 7, height: 3,
      },
      {
        title: 'Monthly Spend Trend',
        widget_type: 'line',
        query_config: { source: 'claims', aggregate: 'sum', field: 'amount', date_bucket: 'month', date_range: 'this_year' },
        viz_config: { color: '#12A05C' },
        position_x: 7, position_y: 5, width: 5, height: 3,
      },
    ],
  },
  {
    id: 'team-directory',
    name: 'Team Directory',
    description: 'A quick-glance table of all employees with leave, tasks, and claims at a glance',
    widgets: [
      // Full-width employee table
      {
        title: 'All Employees',
        widget_type: 'table',
        query_config: { source: 'employees', columns: ['full_name', 'job_title', 'department_name', 'employment_type', 'status', 'start_date'] },
        viz_config: {},
        position_x: 0, position_y: 0, width: 12, height: 5,
      },
      // Row 2 — summary KPIs
      {
        title: 'Total Headcount',
        widget_type: 'kpi',
        query_config: { source: 'employees', aggregate: 'count' },
        viz_config: { color: '#6357E8' },
        position_x: 0, position_y: 5, width: 3, height: 2,
      },
      {
        title: 'On Leave Today',
        widget_type: 'kpi',
        query_config: { source: 'leave', aggregate: 'count', filters: [{ field: 'status', op: 'eq', value: 'approved' }], date_range: 'today' },
        viz_config: { color: '#C97B2A' },
        position_x: 3, position_y: 5, width: 3, height: 2,
      },
      {
        title: 'Open Tasks',
        widget_type: 'kpi',
        query_config: { source: 'tasks', aggregate: 'count', filters: [{ field: 'status', op: 'eq', value: 'pending' }] },
        viz_config: { color: '#12A05C' },
        position_x: 6, position_y: 5, width: 3, height: 2,
      },
      {
        title: 'Pending Claims',
        widget_type: 'kpi',
        query_config: { source: 'claims', aggregate: 'count', filters: [{ field: 'status', op: 'eq', value: 'pending' }] },
        viz_config: { color: '#D44040' },
        position_x: 9, position_y: 5, width: 3, height: 2,
      },
      // Row 3 — leave trend
      {
        title: 'Leave Requests by Month',
        widget_type: 'bar',
        query_config: { source: 'leave', aggregate: 'count', date_bucket: 'month', date_range: 'this_year' },
        viz_config: { color: '#C97B2A' },
        position_x: 0, position_y: 7, width: 6, height: 3,
      },
      {
        title: 'Headcount by Department',
        widget_type: 'kpi',
        query_config: { source: 'employees', aggregate: 'count', group_by: 'department_name' },
        viz_config: { color: '#6357E8' },
        position_x: 6, position_y: 7, width: 6, height: 3,
      },
    ],
  },
]

// ── Page ──────────────────────────────────────────────────────────────────────

function DashboardsPage() {
  const { data: dashboards = [], isLoading: dashLoading } = useDashboards()
  const createDashboard = useCreateDashboard()
  const deleteDashboard = useDeleteDashboard()

  const [activeDashId, setActiveDashId] = useState<string | null>(null)
  const [draftTemplate, setDraftTemplate] = useState<DashboardTemplate | null>(null)
  const [showNewDashModal, setShowNewDashModal] = useState(false)
  const [modalStep, setModalStep] = useState<'choose' | 'blank-name'>('choose')
  const [newDashName, setNewDashName] = useState('')
  const [showWidgetPanel, setShowWidgetPanel] = useState(false)
  const [editingWidget, setEditingWidget] = useState<Widget | null>(null)
  const [creatingTemplate, setCreatingTemplate] = useState(false)
  const [dashDateRange, setDashDateRange] = useState<string>('')
  const [confirmDiscard, setConfirmDiscard] = useState(false)

  // Auto-open modal when there are no dashboards yet (first-time empty state)
  useEffect(() => {
    if (!dashLoading && dashboards.length === 0) setShowNewDashModal(true)
  }, [dashLoading, dashboards.length])

  // Guard browser tab close / refresh when a draft is open
  useEffect(() => {
    if (!draftTemplate) return
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [draftTemplate])

  const activeDash = activeDashId ? (dashboards.find((d) => d.id === activeDashId) ?? null) : null
  const { data: widgets = [], isLoading: widgetsLoading } = useWidgets(activeDash?.id ?? '')
  const createWidget = useCreateWidget()
  const updateWidget = useUpdateWidget()
  const deleteWidget = useDeleteWidget()

  // ── Layout auto-save (debounced 800ms) ───────────────────────────────────────
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const currentBpRef = useRef<string>('lg')
  const isFirstLayoutRef = useRef(true)

  const handleLayoutChange = useCallback(
    (layout: Layout) => {
      // Skip sm breakpoint changes and the initial render
      if (currentBpRef.current !== 'lg') return
      if (isFirstLayoutRef.current) {
        isFirstLayoutRef.current = false
        return
      }
      if (!activeDash) return

      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => {
        layout.forEach((item) => {
          const widget = widgets.find((w) => w.id === item.i)
          if (!widget) return
          if (
            item.x !== widget.position_x ||
            item.y !== widget.position_y ||
            item.w !== widget.width ||
            item.h !== widget.height
          ) {
            updateWidget.mutate({
              dashboardId: activeDash.id,
              widgetId: widget.id,
              title: widget.title,
              widget_type: widget.widget_type,
              query_config: widget.query_config,
              viz_config: widget.viz_config,
              position_x: item.x,
              position_y: item.y,
              width: item.w,
              height: item.h,
            })
          }
        })
      }, 800)
    },
    [activeDash, widgets, updateWidget],
  )

  // Reset first-layout flag when dashboard changes
  const prevDashIdRef = useRef<string | null>(null)
  if (activeDash?.id !== prevDashIdRef.current) {
    isFirstLayoutRef.current = true
    prevDashIdRef.current = activeDash?.id ?? null
  }

  // ── Handlers ──────────────────────────────────────────────────────────────────

  const handleCreateDashboard = async () => {
    if (!newDashName.trim()) return
    const d = await createDashboard.mutateAsync({ name: newDashName })
    setActiveDashId(d.id)
    setNewDashName('')
    setShowNewDashModal(false)
    setModalStep('choose')
  }

  const handleSaveDraft = async () => {
    if (!draftTemplate) return
    await handleUseTemplate(draftTemplate)
    setDraftTemplate(null)
  }

  const handleDiscardDraft = () => setConfirmDiscard(true)

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
      // New widget: place below existing widgets
      const maxY = widgets.reduce((m, w) => Math.max(m, w.position_y + w.height), 0)
      const defaultSize = defaultWidgetSize(type)
      await createWidget.mutateAsync({
        dashboardId: activeDash.id,
        title,
        widget_type: type,
        query_config: query,
        viz_config: viz,
        position_x: 0,
        position_y: maxY,
        ...defaultSize,
      })
    }
    setShowWidgetPanel(false)
    setEditingWidget(null)
  }

  const handleUseTemplate = async (template: DashboardTemplate) => {
    setCreatingTemplate(true)
    try {
      const dash = await createDashboard.mutateAsync({ name: template.name })
      await Promise.all(
        template.widgets.map((w) =>
          createWidget.mutateAsync({
            dashboardId: dash.id,
            title: w.title,
            widget_type: w.widget_type,
            query_config: w.query_config,
            viz_config: w.viz_config,
            position_x: w.position_x,
            position_y: w.position_y,
            width: w.width,
            height: w.height,
          }),
        ),
      )
      setActiveDashId(dash.id)
    } finally {
      setCreatingTemplate(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  // ── Container width for react-grid-layout v2 ─────────────────────────────────
  const { width: gridWidth, containerRef, mounted: gridMounted } = useContainerWidth()

  // Build lg layout from stored widget positions
  const lgLayout: Layout[] = widgets.map((w) => ({
    i: w.id,
    x: w.position_x,
    y: w.position_y,
    w: w.width,
    h: w.height,
    minW: 2,
    minH: 1,
  }))

  // sm: single visible column, stack vertically
  const smLayout: Layout[] = widgets.map((w, idx) => ({
    i: w.id,
    x: 0,
    y: idx * 3,
    w: 2,
    h: 3,
    static: true,
  }))

  // ── Navigation state ─────────────────────────────────────────────────────────
  const inDashboard = activeDash !== null
  const inDraftView = draftTemplate !== null && !inDashboard

  return (
    <div
      className="min-h-screen"
      style={{ background: bg, color: t.text, fontFamily: 'Plus Jakarta Sans, sans-serif' }}
    >
      {/* ── New Dashboard modal ──────────────────────────────── */}
      {showNewDashModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { setShowNewDashModal(false); setModalStep('choose'); setNewDashName('') }} />
          <div
            className="relative w-full max-w-2xl rounded-3xl p-8 shadow-2xl"
            style={{ background: t.surface, border: `1px solid ${t.border}` }}
          >
            <button
              onClick={() => { setShowNewDashModal(false); setModalStep('choose'); setNewDashName('') }}
              className="absolute top-5 right-5 p-1.5 rounded-lg transition-colors hover:bg-black/5"
              style={{ color: t.textMuted }}
            >
              <X size={16} />
            </button>

            {modalStep === 'choose' ? (
              <TemplateSelector
                onUseTemplate={(tmpl) => { setDraftTemplate(tmpl); setShowNewDashModal(false) }}
                onBlank={() => setModalStep('blank-name')}
                loading={creatingTemplate}
              />
            ) : (
              <div>
                <p className="font-semibold text-sm mb-4" style={{ color: t.text }}>Name your dashboard</p>
                <div className="flex gap-2 max-w-sm">
                  <input
                    autoFocus
                    className="flex-1 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#6357E8]/30"
                    style={{ background: t.input, border: `1px solid ${t.inputBorder}`, color: t.text }}
                    placeholder="Dashboard name…"
                    value={newDashName}
                    onChange={(e) => setNewDashName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreateDashboard()
                      if (e.key === 'Escape') { setModalStep('choose'); setNewDashName('') }
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
                    onClick={() => { setModalStep('choose'); setNewDashName('') }}
                    className="p-2 rounded-xl transition-colors"
                    style={{ color: t.textMuted }}
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Discard draft confirm dialog ────────────────────── */}
      {confirmDiscard && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-sm rounded-2xl p-6 shadow-2xl"
            style={{ background: t.surface, border: `1px solid ${t.border}` }}
          >
            <h2 className="font-bold text-base mb-1" style={{ color: t.text }}>Discard draft?</h2>
            <p className="text-sm mb-6" style={{ color: t.textMuted }}>
              This dashboard hasn't been saved yet. If you leave now, your changes will be lost.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmDiscard(false)}
                className="px-4 py-2 rounded-xl text-sm font-medium transition-colors border"
                style={{ borderColor: t.border, color: t.textMuted, background: t.surface }}
              >
                Keep editing
              </button>
              <button
                onClick={() => { setConfirmDiscard(false); setDraftTemplate(null) }}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-red-500 text-white hover:bg-red-600 transition-colors"
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}

      {inDashboard ? (
        /* ══════════════════════════════════════════════════════
           DASHBOARD VIEW
           ══════════════════════════════════════════════════════ */
        <>
          {/* Header with back button */}
          <div className="px-8 pt-8 pb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setActiveDashId(null)}
                className="flex items-center gap-1.5 text-sm font-medium transition-colors rounded-xl px-3 py-2 -ml-3"
                style={{ color: t.textMuted }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.05)'; e.currentTarget.style.color = t.text }}
                onMouseLeave={(e) => { e.currentTarget.style.background = ''; e.currentTarget.style.color = t.textMuted }}
              >
                <ChevronLeft size={16} />
                Dashboards
              </button>
              <span style={{ color: t.border }}>/</span>
              <h1 className="text-base font-bold" style={{ color: t.text }}>{activeDash.name}</h1>
            </div>
            <div className="flex items-center gap-2">
              {/* Dashboard-level date range filter */}
              <Dropdown
                value={dashDateRange}
                onChange={setDashDateRange}
                placeholder="All time"
                theme={t}
                style={{ minWidth: '140px' }}
                options={[
                  { value: '', label: 'All time' },
                  { value: 'today', label: 'Today' },
                  { value: 'this_week', label: 'This week' },
                  { value: 'this_month', label: 'This month' },
                  { value: 'last_30_days', label: 'Last 30 days' },
                  { value: 'this_quarter', label: 'This quarter' },
                  { value: 'this_year', label: 'This year' },
                ]}
              />
              <button
                onClick={() => { setEditingWidget(null); setShowWidgetPanel(true) }}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors border"
                style={{ background: t.surface, borderColor: t.border, color: t.accent }}
              >
                <Plus size={13} />
                Add Widget
              </button>
            </div>
          </div>

          {/* Widget grid */}
          <div className="pb-16">
            {widgetsLoading ? (
              <div className="px-8 grid grid-cols-3 gap-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-40 rounded-2xl animate-pulse" style={{ background: 'rgba(0,0,0,0.06)' }} />
                ))}
              </div>
            ) : widgets.length === 0 ? (
              <div className="px-8 flex flex-col items-center justify-center h-56 gap-3 rounded-2xl border border-dashed" style={{ borderColor: t.border }}>
                <LayoutDashboard size={32} style={{ color: t.border }} />
                <p className="text-sm" style={{ color: t.textMuted }}>No widgets yet</p>
                <button
                  onClick={() => setShowWidgetPanel(true)}
                  className="text-sm font-medium"
                  style={{ color: t.accent }}
                >
                  Add your first widget
                </button>
              </div>
            ) : (
              <div className="px-4">
              <div ref={containerRef}>
                {gridMounted && (
                  <ResponsiveGridLayout
                    width={gridWidth}
                    breakpoints={BREAKPOINTS}
                    cols={COLS}
                    layouts={{ lg: lgLayout, sm: smLayout }}
                    rowHeight={ROW_HEIGHT}
                    margin={GRID_MARGIN}
                    onLayoutChange={handleLayoutChange}
                    onBreakpointChange={(bp) => { currentBpRef.current = bp }}
                    style={{ minHeight: 200 }}
                  >
                    {widgets.map((widget) => (
                      <div key={widget.id} className="cursor-grab active:cursor-grabbing">
                        <WidgetCard
                          widget={widget}
                          onEdit={() => { setEditingWidget(widget); setShowWidgetPanel(true) }}
                          onDelete={() => deleteWidget.mutate({ dashboardId: activeDash.id, widgetId: widget.id })}
                          dateRange={dashDateRange || undefined}
                        />
                      </div>
                    ))}
                  </ResponsiveGridLayout>
                )}
              </div>
              </div>
            )}
          </div>

          {/* Widget config slide-over */}
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
                <div
                  className="sticky top-0 flex items-center justify-between px-6 py-4 border-b border-white/5"
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
        </>
      ) : inDraftView ? (
        /* ══════════════════════════════════════════════════════
           DRAFT VIEW — template preview, not yet saved
           ══════════════════════════════════════════════════════ */
        <>
          {/* Unsaved banner */}
          <div className="px-8 py-2.5 flex items-center justify-between text-sm" style={{ background: '#FEF3C7', borderBottom: '1px solid #FDE68A' }}>
            <span className="font-medium text-amber-800">This dashboard hasn't been saved yet</span>
            <div className="flex gap-2">
              <button
                onClick={handleDiscardDraft}
                className="px-3 py-1 rounded-lg text-xs font-medium transition-colors hover:bg-amber-100 text-amber-700"
              >
                Discard
              </button>
              <button
                onClick={handleSaveDraft}
                disabled={creatingTemplate}
                className="px-3 py-1 rounded-lg text-xs font-medium bg-amber-800 text-white hover:bg-amber-900 transition-colors disabled:opacity-50"
              >
                {creatingTemplate ? 'Saving…' : 'Save Dashboard'}
              </button>
            </div>
          </div>

          {/* Header */}
          <div className="px-8 pt-6 pb-4 flex items-center gap-3">
            <button
              onClick={handleDiscardDraft}
              className="flex items-center gap-1.5 text-sm font-medium transition-colors rounded-xl px-3 py-2 -ml-3"
              style={{ color: t.textMuted }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.05)'; e.currentTarget.style.color = t.text }}
              onMouseLeave={(e) => { e.currentTarget.style.background = ''; e.currentTarget.style.color = t.textMuted }}
            >
              <ChevronLeft size={16} />
              Dashboards
            </button>
            <span style={{ color: t.border }}>/</span>
            <h1 className="text-base font-bold" style={{ color: t.text }}>{draftTemplate!.name}</h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-medium" style={{ background: '#FEF3C7', color: '#92400E' }}>Draft</span>
          </div>

          {/* Draft widget grid — static, read-only preview */}
          <div className="px-4 pb-16">
            <div ref={containerRef}>
              {gridMounted && (
                <ResponsiveGridLayout
                  width={gridWidth}
                  breakpoints={BREAKPOINTS}
                  cols={COLS}
                  layouts={{
                    lg: draftTemplate!.widgets.map((w, i) => ({ i: `draft-${i}`, x: w.position_x, y: w.position_y, w: w.width, h: w.height, static: true })),
                    sm: draftTemplate!.widgets.map((_, i) => ({ i: `draft-${i}`, x: 0, y: i * 3, w: 2, h: 3, static: true })),
                  }}
                  rowHeight={ROW_HEIGHT}
                  margin={GRID_MARGIN}
                  style={{ minHeight: 200 }}
                >
                  {draftTemplate!.widgets.map((w, i) => (
                    <div key={`draft-${i}`}>
                      <WidgetCard
                        widget={{
                          id: `draft-${i}`, dashboard_id: '', organisation_id: '',
                          title: w.title, widget_type: w.widget_type,
                          query_config: w.query_config, viz_config: w.viz_config,
                          position_x: w.position_x, position_y: w.position_y,
                          width: w.width, height: w.height,
                          created_at: '', updated_at: '',
                        }}
                        dateRange={dashDateRange || undefined}
                      />
                    </div>
                  ))}
                </ResponsiveGridLayout>
              )}
            </div>
          </div>
        </>
      ) : (
        /* ══════════════════════════════════════════════════════
           DASHBOARD LIST VIEW
           ══════════════════════════════════════════════════════ */
        <>
          <div className="px-8 pt-8 pb-0">
            <ReportsTabs />
          </div>
          <div className="px-8 pt-2 pb-6">
            <h1 className="text-2xl font-extrabold tracking-tight" style={typography.h1}>Dashboards</h1>
            <p className="text-sm mt-1" style={{ color: t.textMuted }}>Custom analytics for your org</p>
          </div>

          {dashLoading ? (
            <div className="px-8 flex items-center justify-center h-48" style={{ color: t.textMuted }}>Loading…</div>
          ) : (
            <div className="px-8 pb-16">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {dashboards.map((d) => (
                  <div
                    key={d.id}
                    className="group relative cursor-pointer rounded-2xl p-5 transition-all hover:shadow-md"
                    style={{ background: t.surface, border: `1px solid ${t.border}` }}
                    onClick={() => setActiveDashId(d.id)}
                  >
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: `${t.accent}15` }}>
                      <LayoutDashboard size={18} style={{ color: t.accent }} />
                    </div>
                    <p className="font-semibold text-sm pr-6" style={{ color: t.text }}>{d.name}</p>
                    <p className="text-[11px] mt-1" style={{ color: t.textMuted }}>
                      {new Date(d.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteDashboard.mutate(d.id) }}
                      className="absolute top-3 right-3 hidden group-hover:flex w-6 h-6 items-center justify-center rounded-lg transition-colors hover:bg-red-50 hover:text-red-500"
                      style={{ color: t.textMuted }}
                      title="Delete"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}

                {/* "+" card */}
                <button
                  onClick={() => setShowNewDashModal(true)}
                  className="flex flex-col items-center justify-center rounded-2xl p-5 transition-all border-2 border-dashed hover:border-[#6357E8] hover:bg-[#6357E8]/5 group"
                  style={{ borderColor: t.border, minHeight: 120 }}
                >
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-2 transition-colors group-hover:bg-[#6357E8]/15" style={{ background: 'rgba(0,0,0,0.04)' }}>
                    <Plus size={18} style={{ color: t.textMuted }} />
                  </div>
                  <p className="text-xs font-medium" style={{ color: t.textMuted }}>New Dashboard</p>
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Helper ────────────────────────────────────────────────────────────────────

function defaultWidgetSize(type: WidgetType): { width: number; height: number } {
  switch (type) {
    case 'kpi': return { width: 4, height: 2 }
    case 'bar':
    case 'line': return { width: 6, height: 3 }
    case 'table': return { width: 12, height: 4 }
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function WidgetCard({ widget, onEdit, onDelete, dateRange }: { widget: Widget; onEdit?: () => void; onDelete?: () => void; dateRange?: string }) {
  const stopProp = (fn?: () => void): (() => void) | undefined =>
    fn ? () => fn() : undefined

  if (widget.widget_type === 'kpi') {
    return <KpiWidget widget={widget} onEdit={stopProp(onEdit)} onDelete={stopProp(onDelete)} dateRange={dateRange} />
  }
  if (widget.widget_type === 'table') {
    return <TableWidget widget={widget} onEdit={stopProp(onEdit)} onDelete={stopProp(onDelete)} dateRange={dateRange} />
  }
  if (widget.widget_type === 'bar') {
    return <BarWidget widget={widget} onEdit={stopProp(onEdit)} onDelete={stopProp(onDelete)} dateRange={dateRange} />
  }
  if (widget.widget_type === 'line') {
    return <LineWidget widget={widget} onEdit={stopProp(onEdit)} onDelete={stopProp(onDelete)} dateRange={dateRange} />
  }
  return (
    <div className="h-full rounded-2xl p-5 text-sm flex items-center justify-center" style={{ background: t.surface, border: `1px solid ${t.border}`, color: t.textMuted }}>
      {widget.widget_type} — not supported
    </div>
  )
}

const TEMPLATE_ICONS = {
  'hr-overview': BarChart2,
  'task-tracker': Hash,
  'claims-monitor': Table2,
  'team-directory': Users,
}

function TemplateSelector({
  onUseTemplate,
  onBlank,
  onCancel,
  loading,
}: {
  onUseTemplate: (t: DashboardTemplate) => void
  onBlank: () => void
  onCancel?: () => void
  loading: boolean
}) {
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [name, setName] = React.useState('')
  const inputRef = React.useRef<HTMLInputElement>(null)

  const handleSelect = (tmpl: DashboardTemplate) => {
    if (selectedId === tmpl.id) {
      // second click on same card = deselect
      setSelectedId(null)
      setName('')
    } else {
      setSelectedId(tmpl.id)
      setName(tmpl.name)
      setTimeout(() => inputRef.current?.select(), 50)
    }
  }

  const handleCreate = () => {
    const tmpl = TEMPLATES.find((t) => t.id === selectedId)
    if (!tmpl || !name.trim()) return
    onUseTemplate({ ...tmpl, name: name.trim() })
    setSelectedId(null)
    setName('')
  }

  const handleCancel = () => {
    setSelectedId(null)
    setName('')
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-16" data-testid="template-selector">
        <div className="w-8 h-8 rounded-full border-2 border-[#6357E8] border-t-transparent animate-spin" />
        <p className="text-sm" style={{ color: t.textMuted }}>Creating your dashboard…</p>
      </div>
    )
  }

  return (
    <div data-testid="template-selector">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <p className="font-semibold text-sm" style={{ color: t.text }}>
            Choose a starting point
          </p>
          <p className="text-xs mt-0.5" style={{ color: t.textMuted }}>Pick a template or start from scratch</p>
        </div>
        {onCancel && (
          <button
            onClick={onCancel}
            className="p-1.5 rounded-lg transition-colors hover:bg-black/5"
            style={{ color: t.textMuted }}
            aria-label="Cancel"
          >
            <X size={16} />
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {TEMPLATES.map((tmpl) => {
          const Icon = TEMPLATE_ICONS[tmpl.id as keyof typeof TEMPLATE_ICONS] ?? LayoutDashboard
          const kpiCount = tmpl.widgets.filter((w) => w.widget_type === 'kpi').length
          const chartCount = tmpl.widgets.filter((w) => w.widget_type === 'bar' || w.widget_type === 'line').length
          const isSelected = selectedId === tmpl.id

          return (
            <button
              key={tmpl.id}
              onClick={() => handleSelect(tmpl)}
              className="group text-left p-4 rounded-2xl transition-all"
              style={{
                background: isSelected ? `${t.accent}10` : t.surface,
                border: `2px solid ${isSelected ? t.accent : t.border}`,
                boxShadow: isSelected ? `0 0 0 1px ${t.accent}30` : undefined,
              }}
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: `${t.accent}15` }}>
                <Icon size={18} style={{ color: t.accent }} />
              </div>
              <p className="font-semibold text-sm mb-1" style={{ color: t.text }}>{tmpl.name}</p>
              <p className="text-[11px] leading-relaxed mb-3" style={{ color: t.textMuted }}>{tmpl.description}</p>
              <div className="flex gap-1 flex-wrap">
                {kpiCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ background: `${t.accent}12`, color: t.accent }}>
                    {kpiCount} KPI{kpiCount !== 1 ? 's' : ''}
                  </span>
                )}
                {chartCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ background: `${t.accent}12`, color: t.accent }}>
                    {chartCount} chart{chartCount !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </button>
          )
        })}

        {/* Blank — equal card */}
        <button
          onClick={onBlank}
          className="text-left p-4 rounded-2xl transition-all hover:shadow-md border-2 border-dashed"
          style={{ borderColor: t.border }}
        >
          <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: 'rgba(0,0,0,0.04)' }}>
            <Plus size={18} style={{ color: t.textMuted }} />
          </div>
          <p className="font-semibold text-sm mb-1" style={{ color: t.text }}>Blank</p>
          <p className="text-[11px] leading-relaxed" style={{ color: t.textMuted }}>Start from scratch</p>
        </button>
      </div>

      {/* Confirm row — appears when a template is selected */}
      {selectedId && (
        <div className="mt-4 flex gap-2 max-w-sm items-center">
          <input
            ref={inputRef}
            autoFocus
            className="flex-1 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#6357E8]/30"
            style={{ background: t.input, border: `1px solid ${t.inputBorder}`, color: t.text }}
            placeholder="Dashboard name…"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate()
              if (e.key === 'Escape') handleCancel()
            }}
          />
          <button
            onClick={handleCreate}
            disabled={!name.trim()}
            className="px-4 py-2 rounded-xl bg-[#6357E8] text-white text-sm disabled:opacity-40 hover:bg-purple-500 transition-colors"
          >
            Create
          </button>
          <button
            onClick={handleCancel}
            className="p-2 rounded-xl transition-colors"
            style={{ color: t.textMuted }}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  )
}
