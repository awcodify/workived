import React, { useState, useRef, useCallback, useEffect } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { ResponsiveGridLayout, type Layout } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import { LayoutDashboard, Plus, X, BarChart2, LineChart, Table2, Hash, ChevronLeft, Users } from 'lucide-react'
import { Dropdown } from '@/components/workived/shared/Dropdown'
import { moduleBackgrounds, moduleThemes, typography, colors } from '@/design/tokens'
import { DateTime } from '@/components/workived/shared/DateTime'
import { NotificationBell } from '@/components/workived/shared/NotificationBell'
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
import { DividerWidget } from '@/components/dashboard/DividerWidget'
import { TextWidget } from '@/components/dashboard/TextWidget'
import { WidgetConfigPanel } from '@/components/dashboard/WidgetConfigPanel'
import type { Widget, QueryConfig, VizConfig, WidgetType } from '@/types/api'

export const Route = createFileRoute('/_app/reports/dashboards')({
  validateSearch: (search: Record<string, unknown>) => ({
    dashboardId: typeof search.dashboardId === 'string' ? search.dashboardId : undefined,
  }),
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
      // Text — top brief
      {
        title: 'About This Dashboard',
        widget_type: 'text',
        query_config: { source: 'attendance', aggregate: 'count' },
        viz_config: { content: 'Tracks attendance health, late arrivals, leave pipeline, and work-hour trends.\n\nData refreshes automatically. Use the date range filter at the top to zoom in on a specific period.' },
        position_x: 0, position_y: 0, width: 12, height: 2,
      },
      // Row 1 — 4 KPIs
      {
        title: 'Present This Month',
        widget_type: 'kpi',
        query_config: { source: 'attendance', aggregate: 'count', date_range: 'this_month' },
        viz_config: { color: '#12A05C' },
        position_x: 0, position_y: 2, width: 3, height: 2,
      },
      {
        title: 'Late Arrivals This Month',
        widget_type: 'kpi',
        query_config: { source: 'attendance', aggregate: 'count', filters: [{ field: 'is_late', op: 'eq', value: true }], date_range: 'this_month' },
        viz_config: { color: '#D44040' },
        position_x: 3, position_y: 2, width: 3, height: 2,
      },
      {
        title: 'Avg Work Hours / Day',
        widget_type: 'kpi',
        query_config: { source: 'attendance', aggregate: 'avg', field: 'hours_worked', date_range: 'this_month' },
        viz_config: { color: '#6357E8', unit: 'hrs' },
        position_x: 6, position_y: 2, width: 3, height: 2,
      },
      {
        title: 'Pending Leave Requests',
        widget_type: 'kpi',
        query_config: { source: 'leave', aggregate: 'count', filters: [{ field: 'status', op: 'eq', value: 'pending' }] },
        viz_config: { color: '#C97B2A' },
        position_x: 9, position_y: 2, width: 3, height: 2,
      },
      // Row 2 — attendance trend + status breakdown
      {
        title: 'Daily Attendance (Last 30 Days)',
        widget_type: 'line',
        query_config: { source: 'attendance', aggregate: 'count', date_bucket: 'day', date_range: 'last_30_days' },
        viz_config: { color: '#6357E8' },
        position_x: 0, position_y: 4, width: 8, height: 3,
      },
      {
        title: 'Attendance by Status',
        widget_type: 'bar',
        query_config: { source: 'attendance', aggregate: 'count', group_by: 'status', date_range: 'this_month' },
        viz_config: { color: '#12A05C' },
        position_x: 8, position_y: 4, width: 4, height: 3,
      },
      // Row 3 — leave breakdown
      {
        title: 'Leave Days by Type',
        widget_type: 'bar',
        query_config: { source: 'leave', aggregate: 'sum', field: 'total_days', group_by: 'leave_type' },
        viz_config: { color: '#6357E8' },
        position_x: 0, position_y: 7, width: 6, height: 3,
      },
      {
        title: 'Leave Requests by Status',
        widget_type: 'kpi',
        query_config: { source: 'leave', aggregate: 'count', group_by: 'status' },
        viz_config: { color: '#C97B2A' },
        position_x: 6, position_y: 7, width: 3, height: 3,
      },
      {
        title: 'Late Arrivals Trend (Weekly)',
        widget_type: 'line',
        query_config: { source: 'attendance', aggregate: 'count', date_bucket: 'week', filters: [{ field: 'is_late', op: 'eq', value: true }], date_range: 'this_quarter' },
        viz_config: { color: '#D44040' },
        position_x: 9, position_y: 7, width: 3, height: 3,
      },
    ],
  },
  {
    id: 'task-tracker',
    name: 'Task Tracker',
    description: 'Open tasks, overdue risk, velocity trend, and workload distribution',
    widgets: [
      // Text — top brief
      {
        title: 'How to use',
        widget_type: 'text',
        query_config: { source: 'tasks', aggregate: 'count' },
        viz_config: { content: 'Monitor task velocity and workload distribution across the team.\n\nHigh overdue count = bottleneck risk. Check assignee workload and reassign if needed.' },
        position_x: 0, position_y: 0, width: 12, height: 2,
      },
      // Row 1 — 4 KPIs
      {
        title: 'Open Tasks',
        widget_type: 'kpi',
        query_config: { source: 'tasks', aggregate: 'count', filters: [{ field: 'is_completed', op: 'eq', value: false }] },
        viz_config: { color: '#6357E8' },
        position_x: 0, position_y: 2, width: 3, height: 2,
      },
      {
        title: 'Overdue',
        widget_type: 'kpi',
        query_config: { source: 'tasks', aggregate: 'count', filters: [{ field: 'is_completed', op: 'eq', value: false }, { field: 'due_date', op: 'lt', value: 'today' }] },
        viz_config: { color: '#D44040' },
        position_x: 3, position_y: 2, width: 3, height: 2,
      },
      {
        title: 'Completed This Month',
        widget_type: 'kpi',
        query_config: { source: 'tasks', aggregate: 'count', filters: [{ field: 'completed_at', op: 'gte', value: 'this_month' }, { field: 'is_completed', op: 'eq', value: true }] },
        viz_config: { color: '#12A05C' },
        position_x: 6, position_y: 2, width: 3, height: 2,
      },
      {
        title: 'Completed This Week',
        widget_type: 'kpi',
        query_config: { source: 'tasks', aggregate: 'count', filters: [{ field: 'completed_at', op: 'gte', value: 'this_week' }, { field: 'is_completed', op: 'eq', value: true }] },
        viz_config: { color: '#12A05C' },
        position_x: 9, position_y: 2, width: 3, height: 2,
      },
      // Row 2 — velocity + priority
      {
        title: 'Task Completion Trend (Daily)',
        widget_type: 'line',
        query_config: { source: 'tasks', aggregate: 'count', date_bucket: 'day', date_range: 'last_30_days', filters: [{ field: 'is_completed', op: 'eq', value: true }] },
        viz_config: { color: '#12A05C' },
        position_x: 0, position_y: 4, width: 8, height: 3,
      },
      {
        title: 'Open Tasks by Priority',
        widget_type: 'kpi',
        query_config: { source: 'tasks', aggregate: 'count', group_by: 'priority', filters: [{ field: 'is_completed', op: 'eq', value: false }] },
        viz_config: { color: '#6357E8' },
        position_x: 8, position_y: 4, width: 4, height: 3,
      },
      // Row 3 — workload distribution
      {
        title: 'Open Tasks by Assignee',
        widget_type: 'bar',
        query_config: { source: 'tasks', aggregate: 'count', group_by: 'assignee_name', filters: [{ field: 'is_completed', op: 'eq', value: false }] },
        viz_config: { color: '#6357E8' },
        position_x: 0, position_y: 7, width: 6, height: 3,
      },
      {
        title: 'Tasks by Status',
        widget_type: 'bar',
        query_config: { source: 'tasks', aggregate: 'count', group_by: 'status' },
        viz_config: { color: '#C97B2A' },
        position_x: 6, position_y: 7, width: 6, height: 3,
      },
    ],
  },
  {
    id: 'claims-monitor',
    name: 'Claims Monitor',
    description: 'Spend visibility, approval pipeline, category breakdown, and monthly trends',
    widgets: [
      // Text — top brief
      {
        title: 'Reminder',
        widget_type: 'text',
        query_config: { source: 'claims', aggregate: 'count' },
        viz_config: { content: 'Approve pending claims within 3 business days per policy.\n\nHigh avg claim amount may indicate a category policy review is needed.' },
        position_x: 0, position_y: 0, width: 12, height: 2,
      },
      // Row 1 — 4 KPIs
      {
        title: 'Claims This Month',
        widget_type: 'kpi',
        query_config: { source: 'claims', aggregate: 'count', date_range: 'this_month' },
        viz_config: { color: '#6357E8' },
        position_x: 0, position_y: 2, width: 3, height: 2,
      },
      {
        title: 'Total Spend This Month',
        widget_type: 'kpi',
        query_config: { source: 'claims', aggregate: 'sum', field: 'amount', date_range: 'this_month' },
        viz_config: { color: '#6357E8' },
        position_x: 3, position_y: 2, width: 3, height: 2,
      },
      {
        title: 'Pending Approval',
        widget_type: 'kpi',
        query_config: { source: 'claims', aggregate: 'count', filters: [{ field: 'status', op: 'eq', value: 'pending' }] },
        viz_config: { color: '#C97B2A' },
        position_x: 6, position_y: 2, width: 3, height: 2,
      },
      {
        title: 'Avg Claim Amount',
        widget_type: 'kpi',
        query_config: { source: 'claims', aggregate: 'avg', field: 'amount', date_range: 'this_month' },
        viz_config: { color: '#3B82F6' },
        position_x: 9, position_y: 2, width: 3, height: 2,
      },
      // Row 2 — monthly trend + status
      {
        title: 'Monthly Claim Volume (This Year)',
        widget_type: 'line',
        query_config: { source: 'claims', aggregate: 'count', date_bucket: 'month', date_range: 'this_year' },
        viz_config: { color: '#6357E8' },
        position_x: 0, position_y: 4, width: 8, height: 3,
      },
      {
        title: 'Claims by Status',
        widget_type: 'kpi',
        query_config: { source: 'claims', aggregate: 'count', group_by: 'status' },
        viz_config: { color: '#C97B2A' },
        position_x: 8, position_y: 4, width: 4, height: 3,
      },
      // Row 3 — spend breakdown
      {
        title: 'Spend by Category',
        widget_type: 'bar',
        query_config: { source: 'claims', aggregate: 'sum', field: 'amount', group_by: 'category_name' },
        viz_config: { color: '#6357E8' },
        position_x: 0, position_y: 7, width: 7, height: 3,
      },
      {
        title: 'Monthly Spend Trend',
        widget_type: 'line',
        query_config: { source: 'claims', aggregate: 'sum', field: 'amount', date_bucket: 'month', date_range: 'this_year' },
        viz_config: { color: '#12A05C' },
        position_x: 7, position_y: 7, width: 5, height: 3,
      },
    ],
  },
  {
    id: 'team-directory',
    name: 'Team Directory',
    description: 'A quick-glance table of all employees with leave, tasks, and claims at a glance',
    widgets: [
      // Text — top brief
      {
        title: 'About This Dashboard',
        widget_type: 'text',
        query_config: { source: 'employees', aggregate: 'count' },
        viz_config: { content: 'Snapshot of all employees and key HR metrics at a glance.\n\nUse this dashboard to quickly check headcount, leave, open tasks, and pending claims.' },
        position_x: 0, position_y: 0, width: 12, height: 2,
      },
      // Full-width employee table
      {
        title: 'All Employees',
        widget_type: 'table',
        query_config: { source: 'employees', columns: ['full_name', 'job_title', 'department_name', 'employment_type', 'status', 'start_date'] },
        viz_config: {},
        position_x: 0, position_y: 2, width: 12, height: 5,
      },
      // Row 2 — summary KPIs
      {
        title: 'Total Headcount',
        widget_type: 'kpi',
        query_config: { source: 'employees', aggregate: 'count' },
        viz_config: { color: '#6357E8' },
        position_x: 0, position_y: 7, width: 3, height: 2,
      },
      {
        title: 'On Leave Today',
        widget_type: 'kpi',
        query_config: { source: 'leave', aggregate: 'count', filters: [{ field: 'status', op: 'eq', value: 'approved' }], date_range: 'today' },
        viz_config: { color: '#C97B2A' },
        position_x: 3, position_y: 7, width: 3, height: 2,
      },
      {
        title: 'Open Tasks',
        widget_type: 'kpi',
        query_config: { source: 'tasks', aggregate: 'count', filters: [{ field: 'status', op: 'eq', value: 'pending' }] },
        viz_config: { color: '#12A05C' },
        position_x: 6, position_y: 7, width: 3, height: 2,
      },
      {
        title: 'Pending Claims',
        widget_type: 'kpi',
        query_config: { source: 'claims', aggregate: 'count', filters: [{ field: 'status', op: 'eq', value: 'pending' }] },
        viz_config: { color: '#D44040' },
        position_x: 9, position_y: 7, width: 3, height: 2,
      },
      // Row 3 — leave trend
      {
        title: 'Leave Requests by Month',
        widget_type: 'bar',
        query_config: { source: 'leave', aggregate: 'count', date_bucket: 'month', date_range: 'this_year' },
        viz_config: { color: '#C97B2A' },
        position_x: 0, position_y: 9, width: 6, height: 3,
      },
      {
        title: 'Headcount by Department',
        widget_type: 'kpi',
        query_config: { source: 'employees', aggregate: 'count', group_by: 'department_name' },
        viz_config: { color: '#6357E8' },
        position_x: 6, position_y: 9, width: 6, height: 3,
      },
    ],
  },
]

// ── Page ──────────────────────────────────────────────────────────────────────

function DashboardsPage() {
  const { data: dashboards = [], isLoading: dashLoading } = useDashboards()
  const createDashboard = useCreateDashboard()
  const deleteDashboard = useDeleteDashboard()
  const navigate = useNavigate()
  const { dashboardId: activeDashId } = Route.useSearch()

  const setActiveDashId = (id: string | null) =>
    navigate({ to: '/reports/dashboards', search: id ? { dashboardId: id } : {} })
  const [draftTemplate, setDraftTemplate] = useState<DashboardTemplate | null>(null)
  const [showNewDashModal, setShowNewDashModal] = useState(false)
  const [modalStep, setModalStep] = useState<'choose' | 'blank-name'>('choose')
  const [newDashName, setNewDashName] = useState('')
  const [showWidgetPanel, setShowWidgetPanel] = useState(false)
  const [editingWidget, setEditingWidget] = useState<Widget | null>(null)
  const [creatingTemplate, setCreatingTemplate] = useState(false)
  const [dashDateRange, setDashDateRange] = useState<string>('')
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [confirmDeleteDashId, setConfirmDeleteDashId] = useState<string | null>(null)

  // Guard browser tab close / refresh when a draft is open
  useEffect(() => {
    if (!draftTemplate) return
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [draftTemplate])

  const activeDash = activeDashId ? (dashboards.find((d) => d.id === activeDashId) ?? null) : null
  // Also set activeDashId after template creation completes (handleUseTemplate sets it via setActiveDashId)
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
    try {
      await handleUseTemplate(draftTemplate)
    } finally {
      setDraftTemplate(null)
    }
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
      // allSettled: individual widget failures (e.g. unsupported types) don't abort navigation
      await Promise.allSettled(
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

  // ── Container width — callback ref so measurement fires whenever the grid
  //    div enters/exits the DOM (it lives inside conditional branches).
  const [gridWidth, setGridWidth] = useState(0)
  const [gridMounted, setGridMounted] = useState(false)
  const roRef = useRef<ResizeObserver | null>(null)

  const containerRef = useCallback((el: HTMLDivElement | null) => {
    if (roRef.current) { roRef.current.disconnect(); roRef.current = null }
    if (!el) return
    // Immediate measurement
    const w = el.getBoundingClientRect().width
    if (w > 0) { setGridWidth(w); setGridMounted(true) }
    // ResizeObserver for subsequent size changes
    const ro = new ResizeObserver(([entry]) => {
      const cw = entry.contentRect.width
      if (cw > 0) { setGridWidth(cw); setGridMounted(true) }
    })
    ro.observe(el)
    roRef.current = ro
  }, [])

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
      data-testid="dashboards-page"
      style={{ background: bg, color: t.text, fontFamily: 'Plus Jakarta Sans, sans-serif' }}
    >
      {/* ── New Dashboard modal ──────────────────────────────── */}
      {showNewDashModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" data-testid="new-dashboard-modal">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { setShowNewDashModal(false); setModalStep('choose'); setNewDashName('') }} />
          <div
            className="relative w-full max-w-2xl rounded-3xl p-8 shadow-2xl"
            style={{ background: t.surface, border: `1px solid ${t.border}` }}
          >
            <button
              onClick={() => { setShowNewDashModal(false); setModalStep('choose'); setNewDashName('') }}
              className="absolute top-5 right-5 p-1.5 rounded-lg transition-colors hover:bg-black/5"
              data-testid="new-dashboard-modal-close-btn"
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
                    data-testid="new-dashboard-name-input"
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
                    data-testid="new-dashboard-create-btn"
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

      {/* ── Delete dashboard confirm ────────────────────── */}
      {confirmDeleteDashId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setConfirmDeleteDashId(null)} />
          <div
            className="relative w-full max-w-sm rounded-2xl p-6 shadow-2xl"
            style={{ background: t.surface, border: `1px solid ${t.border}` }}
          >
            <h2 className="font-bold text-base mb-1" style={{ color: t.text }}>Delete dashboard?</h2>
            <p className="text-sm mb-6" style={{ color: t.textMuted }}>
              This will permanently delete the dashboard and all its widgets. This action cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmDeleteDashId(null)}
                className="px-4 py-2 rounded-xl text-sm font-medium transition-colors border"
                style={{ borderColor: t.border, color: t.textMuted, background: t.surface }}
              >
                Cancel
              </button>
              <button
                onClick={() => { deleteDashboard.mutate(confirmDeleteDashId); setConfirmDeleteDashId(null) }}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-red-500 text-white hover:bg-red-600 transition-colors"
              >
                Delete
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
                data-testid="dashboard-back-btn"
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
                data-testid="dashboard-add-widget-btn"
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
              <div className="px-8 grid grid-cols-3 gap-3" data-testid="dashboard-skeleton">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-40 rounded-2xl animate-pulse" style={{ background: 'rgba(0,0,0,0.06)' }} />
                ))}
              </div>
            ) : widgets.length === 0 ? (
              <div className="px-8 flex flex-col items-center justify-center h-56 gap-3 rounded-2xl border border-dashed" data-testid="dashboard-empty" style={{ borderColor: t.border }}>
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
              <div className="px-8">
              <div ref={containerRef} className="w-full">
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
            <div className="fixed inset-0 z-50 flex" data-testid="widget-config-panel">
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
          <div className="px-8 py-2.5 flex items-center justify-between text-sm" data-testid="draft-banner" style={{ background: '#FEF3C7', borderBottom: '1px solid #FDE68A' }}>
            <span className="font-medium text-amber-800">This dashboard hasn't been saved yet</span>
            <div className="flex gap-2">
              <button
                onClick={handleDiscardDraft}
                className="px-3 py-1 rounded-lg text-xs font-medium transition-colors hover:bg-amber-100 text-amber-700"
                data-testid="draft-discard-btn"
              >
                Discard
              </button>
              <button
                onClick={handleSaveDraft}
                disabled={creatingTemplate}
                data-testid="draft-save-btn"
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
          <div className="px-8 pb-16">
            <div ref={containerRef} className="w-full">
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
          {/* Header — matches other module pages */}
          <div className="px-8 pt-8 pb-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h1
                  className="font-extrabold"
                  style={{ fontSize: typography.display.size, letterSpacing: typography.display.tracking, color: t.text, lineHeight: typography.display.lineHeight }}
                >
                  Dashboards
                </h1>
                <p className="text-sm mt-2" style={{ color: t.textMuted }}>
                  {dashboards.length} dashboard{dashboards.length !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <DateTime textColor={t.text} textMutedColor={t.textMuted} borderColor={t.border} />
                <NotificationBell
                  surfaceColor={t.surface}
                  borderColor={t.border}
                  accentColor={colors.accent}
                  textColor={t.text}
                  textMutedColor={t.textMuted}
                />
              </div>
            </div>
          </div>

          {dashLoading ? (
            <div className="px-8 flex items-center justify-center h-48" style={{ color: t.textMuted }}>Loading…</div>
          ) : dashboards.length === 0 ? (
            /* Empty state */
            <div className="flex flex-col items-center justify-center py-20 text-center px-8">
              <div className="flex items-end gap-2 mb-8" style={{ height: 72 }}>
                {[38, 56, 44, 72, 52, 36, 60, 48].map((h, i) => (
                  <div
                    key={i}
                    className="rounded-sm"
                    style={{
                      width: 12,
                      height: h,
                      background: i % 3 === 0 ? t.accent : i % 3 === 1 ? '#34D399' : '#F59E0B',
                      opacity: 0.25 + (i % 3) * 0.15,
                    }}
                  />
                ))}
              </div>
              <h2 className="font-bold" style={{ fontSize: 22, letterSpacing: '-0.03em', color: t.text }}>
                Build your first dashboard
              </h2>
              <p className="text-sm mt-2 max-w-xs" style={{ color: t.textMuted }}>
                Connect your HR data to custom charts, KPIs, and tables — all in one place.
              </p>
              <button
                onClick={() => setShowNewDashModal(true)}
                className="mt-6 flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors hover:opacity-90"
                style={{ background: t.accent, color: t.accentText }}
              >
                <Plus size={14} />
                Create Dashboard
              </button>
            </div>
          ) : (
            <div className="px-8 pb-16">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {dashboards.map((d) => (
                  <DashboardCard
                    key={d.id}
                    dashboard={d}
                    theme={t}
                    onClick={() => setActiveDashId(d.id)}
                    onDelete={() => setConfirmDeleteDashId(d.id)}
                  />
                ))}

                {/* Minimal + card */}
                <button
                  onClick={() => setShowNewDashModal(true)}
                  className="flex flex-col items-center justify-center rounded-2xl transition-all border-2 border-dashed hover:border-[#6357E8] hover:bg-[#6357E8]/5 group"
                  style={{ borderColor: 'rgba(99,87,232,0.2)', minHeight: 148 }}
                >
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors group-hover:bg-[#6357E8]/15"
                    style={{ background: 'rgba(99,87,232,0.06)' }}
                  >
                    <Plus size={16} style={{ color: t.textMuted }} />
                  </div>
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function DashboardCard({
  dashboard: d,
  theme: t,
  onClick,
  onDelete,
}: {
  dashboard: { id: string; name: string; updated_at?: string; created_at: string }
  theme: typeof import('@/design/tokens').moduleThemes.reports
  onClick: () => void
  onDelete: () => void
}) {
  const { data: widgets = [] } = useWidgets(d.id)

  const kpi = widgets.filter((w) => w.widget_type === 'kpi').length
  const chart = widgets.filter((w) => w.widget_type === 'bar' || w.widget_type === 'line').length
  const table = widgets.filter((w) => w.widget_type === 'table').length
  // dividers are layout elements, excluded from pill summary
  const parts: string[] = []
  if (kpi > 0) parts.push(`${kpi} KPI${kpi > 1 ? 's' : ''}`)
  if (chart > 0) parts.push(`${chart} chart${chart > 1 ? 's' : ''}`)
  if (table > 0) parts.push(`${table} table${table > 1 ? 's' : ''}`)
  const summary = parts.length > 0 ? parts.join(' · ') : 'No widgets yet'

  return (
    <div
      className="group relative cursor-pointer rounded-2xl p-4 transition-all hover:shadow-lg"
      style={{ background: t.surface, border: `1px solid ${t.border}`, boxShadow: '0 1px 4px rgba(99,87,232,0.06)' }}
      onClick={onClick}
    >
      <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: `${t.accent}15` }}>
        <LayoutDashboard size={18} style={{ color: t.accent }} />
      </div>
      <p className="font-semibold text-sm pr-6 leading-snug" style={{ color: t.text }}>{d.name}</p>
      <p className="text-[11px] mt-1.5" style={{ color: t.accent, fontWeight: 500 }}>{summary}</p>
      <p className="text-[10px] mt-1" style={{ color: t.textMuted }}>Updated {timeAgo((d.updated_at ?? '') || d.created_at)}</p>
      <button
        onClick={(e) => { e.stopPropagation(); onDelete() }}
        className="absolute top-3 right-3 hidden group-hover:flex w-6 h-6 items-center justify-center rounded-lg transition-colors hover:bg-red-50 hover:text-red-500"
        style={{ color: t.textMuted }}
        title="Delete"
      >
        <X size={12} />
      </button>
    </div>
  )
}

function defaultWidgetSize(type: WidgetType): { width: number; height: number } {
  switch (type) {
    case 'kpi': return { width: 4, height: 2 }
    case 'bar':
    case 'line': return { width: 6, height: 3 }
    case 'table': return { width: 12, height: 4 }
    case 'divider': return { width: 12, height: 1 }
    case 'text': return { width: 4, height: 2 }
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function WidgetCard({ widget, onEdit, onDelete, dateRange }: { widget: Widget; onEdit?: () => void; onDelete?: () => void; dateRange?: string }) {
  const stopProp = (fn?: () => void): (() => void) | undefined =>
    fn ? () => fn() : undefined

  if (widget.widget_type === 'divider') {
    return <DividerWidget widget={widget} onEdit={stopProp(onEdit)} onDelete={stopProp(onDelete)} />
  }
  if (widget.widget_type === 'text') {
    return <TextWidget widget={widget} onEdit={stopProp(onEdit)} onDelete={stopProp(onDelete)} />
  }
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
