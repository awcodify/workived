import { createFileRoute, Link } from '@tanstack/react-router'
import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import {
  ChevronDown,
  ChevronRight,
  Users,
  ArrowLeft,
  ZoomIn,
  ZoomOut,
  Minimize2,
  Maximize2,
  Search,
  X,
  Download,
  Lock,
  GripVertical,
  AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'
import { useOrgChart, useReparentEmployee } from '@/lib/hooks/useEmployees'
import { useCanManageEmployees } from '@/lib/hooks/useRole'
import { useOrganisation } from '@/lib/hooks/useOrganisation'
import { Avatar } from '@/components/workived/layout/Avatar'
import { StatusSquare } from '@/components/workived/layout/StatusSquare'
import { EmployeeDetailModal } from '@/components/workived/shared/EmployeeDetailModal'
import { moduleBackgrounds, moduleThemes, colors } from '@/design/tokens'
import type { OrgChartNode } from '@/types/api'

const t = moduleThemes.people

// ── Layout constants ─────────────────────────────────────────────────
const CARD_W = 220
const CARD_H = 120
const H_GAP = 24
const V_GAP = 64
const CANVAS_PAD = 60

export const Route = createFileRoute('/_app/org-chart')({
  component: OrgChartPage,
})

// ── Layout types ─────────────────────────────────────────────────────
interface LayoutNode {
  node: OrgChartNode
  x: number
  y: number
  children: LayoutNode[]
}

// ── Tree layout engine ───────────────────────────────────────────────
function layoutTree(roots: OrgChartNode[], collapsedIds: Set<string>): LayoutNode[] {
  let cursor = 0

  function measure(node: OrgChartNode, depth: number): LayoutNode {
    const reports =
      !collapsedIds.has(node.id) && node.direct_reports?.length ? node.direct_reports : []
    const children = reports.map((child) => measure(child, depth + 1))

    if (children.length === 0) {
      const x = cursor * (CARD_W + H_GAP) + CANVAS_PAD
      cursor++
      return { node, x, y: depth * (CARD_H + V_GAP) + CANVAS_PAD, children }
    }

    const firstX = children[0]!.x
    const lastX = children[children.length - 1]!.x
    return { node, x: (firstX + lastX) / 2, y: depth * (CARD_H + V_GAP) + CANVAS_PAD, children }
  }

  return roots.map((root) => measure(root, 0))
}

function flattenNodes(layouts: LayoutNode[]): LayoutNode[] {
  const result: LayoutNode[] = []
  function walk(ln: LayoutNode) {
    result.push(ln)
    ln.children.forEach(walk)
  }
  layouts.forEach(walk)
  return result
}

function buildConnectorPaths(layouts: LayoutNode[]): string[] {
  const paths: string[] = []

  function walk(ln: LayoutNode) {
    if (ln.children.length === 0) return
    const parentCx = ln.x + CARD_W / 2
    const parentBottom = ln.y + CARD_H

    for (const child of ln.children) {
      const childCx = child.x + CARD_W / 2
      const childTop = child.y
      const dy = childTop - parentBottom
      const offset = Math.max(Math.abs(dy) * 0.5, 30)
      paths.push(
        `M ${parentCx} ${parentBottom} C ${parentCx} ${parentBottom + offset}, ${childCx} ${childTop - offset}, ${childCx} ${childTop}`,
      )
    }
    ln.children.forEach(walk)
  }

  layouts.forEach(walk)
  return paths
}

// ── Helpers ──────────────────────────────────────────────────────────
function countDescendants(node: OrgChartNode): number {
  if (!node.direct_reports) return 0
  return node.direct_reports.reduce((sum, child) => sum + 1 + countDescendants(child), 0)
}

function collectAllNodes(roots: OrgChartNode[]): OrgChartNode[] {
  const result: OrgChartNode[] = []
  function walk(n: OrgChartNode) {
    result.push(n)
    n.direct_reports?.forEach(walk)
  }
  roots.forEach(walk)
  return result
}

function isDescendantOf(
  candidateId: string,
  ancestorId: string,
  roots: OrgChartNode[],
): boolean {
  function findAndCheck(node: OrgChartNode): boolean | null {
    if (node.id === ancestorId) return containsId(node.direct_reports ?? [])
    for (const child of node.direct_reports ?? []) {
      const result = findAndCheck(child)
      if (result !== null) return result
    }
    return null
  }
  function containsId(nodes: OrgChartNode[]): boolean {
    for (const n of nodes) {
      if (n.id === candidateId) return true
      if (containsId(n.direct_reports ?? [])) return true
    }
    return false
  }
  for (const root of roots) {
    const result = findAndCheck(root)
    if (result !== null) return result
  }
  return false
}

function findDropTargetAtPoint(
  clientX: number,
  clientY: number,
  excludeId: string,
): string | null {
  const elements = document.elementsFromPoint(clientX, clientY)
  for (const el of elements) {
    const cardEl = (el as HTMLElement).closest('[data-card-id]') as HTMLElement | null
    if (!cardEl) continue
    const nodeId = cardEl.getAttribute('data-card-id')!
    if (nodeId !== excludeId) return nodeId
  }
  return null
}


function dragCurveOffset(dist: number): number {
  return Math.max(dist * 0.5, 60)
}

// Returns the point on a card's border nearest to (toX, toY), given card center + half-dims.
function getCardBorderPoint(
  cx: number, cy: number, hw: number, hh: number,
  toX: number, toY: number,
): { x: number; y: number } {
  const dx = toX - cx
  const dy = toY - cy
  if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) return { x: cx, y: cy + hh }
  const tRight  = dx > 0 ?  hw / dx : Infinity
  const tLeft   = dx < 0 ? -hw / dx : Infinity
  const tBottom = dy > 0 ?  hh / dy : Infinity
  const tTop    = dy < 0 ? -hh / dy : Infinity
  const t = Math.min(tRight, tLeft, tBottom, tTop)
  return { x: cx + dx * t, y: cy + dy * t }
}

// Applies draft reparent changes on top of the API tree without mutating the original.
function applyDraftChanges(apiTree: OrgChartNode[], drafts: Map<string, string | null>): OrgChartNode[] {
  if (drafts.size === 0) return apiTree
  const flat = collectAllNodes(apiTree)
  const nodeMap = new Map<string, OrgChartNode>(flat.map(n => [n.id, { ...n, direct_reports: [] }]))
  for (const [nodeId, newParent] of drafts) {
    const n = nodeMap.get(nodeId)
    if (n) n.reporting_to = newParent ?? undefined
  }
  for (const n of nodeMap.values()) {
    if (n.reporting_to) {
      const parent = nodeMap.get(n.reporting_to)
      if (parent) parent.direct_reports!.push(n)
    }
  }
  const childIds = new Set<string>()
  for (const n of nodeMap.values()) {
    if (n.reporting_to && nodeMap.has(n.reporting_to)) childIds.add(n.id)
  }
  return [...nodeMap.values()].filter(n => !childIds.has(n.id))
}

// ── Main Page ────────────────────────────────────────────────────────
function OrgChartPage() {
  const { data: tree, isLoading } = useOrgChart()
  const canEdit = useCanManageEmployees()
  const { data: org } = useOrganisation()
  const reparent = useReparentEmployee()

  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null)
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [pendingUnassign, setPendingUnassign] = useState<{ nodeId: string; employeeName: string } | null>(null)

  // Draft reparent changes — applied locally until user saves
  const [draftChanges, setDraftChanges] = useState<Map<string, string | null>>(new Map())
  const [isSaving, setIsSaving] = useState(false)

  // Reparent drag state
  const [reparentingId, setReparentingId] = useState<string | null>(null)
  const [dropTargetId, setDropTargetId] = useState<string | null>(null)
  const dropTargetRef = useRef<string | null>(null)
  const [dragCursorCanvas, setDragCursorCanvas] = useState<{ x: number; y: number } | null>(null)
  // Screen-space cursor pos — used for unassigned card drag overlay
  const [dragCurrentClient, setDragCurrentClient] = useState<{ x: number; y: number } | null>(null)
  // Center + half-dims of the unassigned card being dragged (screen coords, fixed while dragging)
  const [dragCardSrcRect, setDragCardSrcRect] = useState<{ cx: number; cy: number; hw: number; hh: number } | null>(null)
  // Screen-space top-center of the current drop target card (updated only when target changes)
  const [dropTargetClientPos, setDropTargetClientPos] = useState<{ cx: number; cy: number; hw: number; hh: number } | null>(null)

  // Zoom & pan state
  const [scale, setScale] = useState(1)
  const [translate, setTranslate] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const panStart = useRef({ x: 0, y: 0, tx: 0, ty: 0 })
  const hasMoved = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number | undefined>(undefined)

  const [isFullscreen, setIsFullscreen] = useState(false)

  const toggleCollapse = useCallback((id: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const zoomIn = useCallback(() => setScale((s) => Math.min(s + 0.15, 2)), [])
  const zoomOut = useCallback(() => setScale((s) => Math.max(s - 0.15, 0.3)), [])

  // Mouse wheel zoom
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    function onWheel(e: WheelEvent) {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        setScale((s) => Math.min(Math.max(s - e.deltaY * 0.002, 0.3), 2))
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // Pan handlers (disabled during reparent drag)
  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0 || reparentingId !== null) return
      setIsPanning(true)
      hasMoved.current = false
      panStart.current = { x: e.clientX, y: e.clientY, tx: translate.x, ty: translate.y }
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    },
    [translate, reparentingId],
  )
  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isPanning) return
      const dx = Math.abs(e.clientX - panStart.current.x)
      const dy = Math.abs(e.clientY - panStart.current.y)
      if (dx > 5 || dy > 5) hasMoved.current = true
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(() => {
        const newX = panStart.current.tx + (e.clientX - panStart.current.x)
        const newY = panStart.current.ty + (e.clientY - panStart.current.y)
        if (contentRef.current) {
          contentRef.current.style.transform = `translate(${newX}px, ${newY}px) scale(${scale})`
        }
        setTranslate({ x: newX, y: newY })
      })
    },
    [isPanning, scale],
  )
  const onPointerUp = useCallback(() => {
    setIsPanning(false)
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
  }, [])

  // Apply draft changes on top of the API tree for local-first display
  const displayTree = useMemo(
    () => (tree ? applyDraftChanges(tree, draftChanges) : undefined),
    [tree, draftChanges],
  )

  // Reparent drag callbacks
  const handleReparentStart = useCallback((
    nodeId: string,
    cardSrcRect?: { cx: number; cy: number; hw: number; hh: number },
  ) => {
    setReparentingId(nodeId)
    dropTargetRef.current = null
    setDropTargetId(null)
    setDragCursorCanvas(null)
    setDragCurrentClient(null)
    setDragCardSrcRect(cardSrcRect ?? null)
    setDropTargetClientPos(null)
    document.body.dataset.orgChartDragging = 'true'
    const dock = document.querySelector('[data-testid="dock-nav"]') as HTMLElement | null
    if (dock) dock.style.pointerEvents = 'none'
  }, [])

  const handleReparentMove = useCallback(
    (clientX: number, clientY: number) => {
      if (!reparentingId) return
      const target = findDropTargetAtPoint(clientX, clientY, reparentingId)
      if (target !== dropTargetRef.current) {
        if (target) {
          const el = document.querySelector(`[data-card-id="${CSS.escape(target)}"]`) as HTMLElement | null
          const r = el?.getBoundingClientRect()
          setDropTargetClientPos(r ? { cx: r.left + r.width / 2, cy: r.top + r.height / 2, hw: r.width / 2, hh: r.height / 2 } : null)
        } else {
          setDropTargetClientPos(null)
        }
        setDropTargetId(target)
      }
      dropTargetRef.current = target
      setDragCurrentClient({ x: clientX, y: clientY })
      const rect = containerRef.current?.getBoundingClientRect()
      if (rect) {
        setDragCursorCanvas({
          x: (clientX - rect.left - translate.x) / scale,
          y: (clientY - rect.top - translate.y) / scale,
        })
      }
    },
    [reparentingId, translate, scale],
  )

  const handleReparentEnd = useCallback(
    (nodeId: string, didMove: boolean) => {
      const target = dropTargetRef.current
      setReparentingId(null)
      dropTargetRef.current = null
      setDropTargetId(null)
      setDragCursorCanvas(null)
      setDragCurrentClient(null)
      setDragCardSrcRect(null)
      setDropTargetClientPos(null)
      delete document.body.dataset.orgChartDragging
      const dock = document.querySelector('[data-testid="dock-nav"]') as HTMLElement | null
      if (dock) dock.style.pointerEvents = ''

      if (!didMove) {
        setSelectedEmployeeId(nodeId)
        return
      }

      const allTreeNodes = displayTree ? collectAllNodes(displayTree) : []
      const node = allTreeNodes.find((n) => n.id === nodeId)
      const currentParent = node?.reporting_to ?? null

      if (target === nodeId) return
      if (target === currentParent) return
      if (target === null && currentParent === null) return

      if (target !== null && displayTree && isDescendantOf(target, nodeId, displayTree)) {
        toast.error('Cannot set a descendant as manager.')
        return
      }

      if (target === null && currentParent !== null) {
        const emp = allTreeNodes.find((n) => n.id === nodeId)
        setPendingUnassign({ nodeId, employeeName: emp?.full_name ?? 'This employee' })
        return
      }

      // Stage as draft — user saves explicitly
      setDraftChanges((prev) => {
        const next = new Map(prev)
        next.set(nodeId, target)
        return next
      })
    },
    [displayTree],
  )

  // Save all staged draft reparents to the API
  const handleSaveDrafts = useCallback(async () => {
    if (draftChanges.size === 0 || isSaving) return
    setIsSaving(true)
    try {
      await Promise.all(
        [...draftChanges.entries()].map(([id, reportingTo]) =>
          reparent.mutateAsync({ id, reportingTo }),
        ),
      )
      setDraftChanges(new Map())
      toast.success('Changes saved.')
    } catch {
      toast.error('Some changes failed. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }, [draftChanges, reparent])

  const handleDiscardDrafts = useCallback(() => {
    setDraftChanges(new Map())
  }, [])

  // Export PNG
  const handleExportPng = useCallback(async () => {
    if (org?.plan === 'free') {

      toast.error('Export is available on Pro plan. Upgrade to download your org chart.')
      return
    }
    if (!contentRef.current) return
    setIsExporting(true)
    try {
      const { toPng } = await import('html-to-image')
      const dataUrl = await toPng(contentRef.current, { cacheBust: true })
      const link = document.createElement('a')
      link.download = `org-chart-${org?.slug ?? 'export'}-${new Date().toISOString().slice(0, 10)}.png`
      link.href = dataUrl
      link.click()
    } catch {
      toast.error('Export failed. Please try again.')
    } finally {
      setIsExporting(false)
    }
  }, [org])

  // Search matching
  const matchingIds = useMemo(() => {
    if (!displayTree || !searchQuery.trim()) return new Set<string>()
    const q = searchQuery.toLowerCase()
    return new Set(
      collectAllNodes(displayTree)
        .filter(
          (n) =>
            n.full_name.toLowerCase().includes(q) ||
            (n.job_title && n.job_title.toLowerCase().includes(q)),
        )
        .map((n) => n.id),
    )
  }, [displayTree, searchQuery])

  // Split tree into hierarchy roots and unassigned
  const { hierarchyRoots, unassigned } = useMemo(() => {
    if (!displayTree) return { hierarchyRoots: [] as OrgChartNode[], unassigned: [] as OrgChartNode[] }
    const hier: OrgChartNode[] = []
    const unas: OrgChartNode[] = []
    for (const root of displayTree) {
      if ((root.direct_reports?.length ?? 0) > 0 || root.reporting_to) {
        hier.push(root)
      } else {
        unas.push(root)
      }
    }
    return { hierarchyRoots: hier, unassigned: unas }
  }, [displayTree])

  const layouts = useMemo(
    () => (hierarchyRoots.length ? layoutTree(hierarchyRoots, collapsedIds) : []),
    [hierarchyRoots, collapsedIds],
  )
  const allNodes = useMemo(() => flattenNodes(layouts), [layouts])
  const connectors = useMemo(() => buildConnectorPaths(layouts), [layouts])

  const canvasW = useMemo(() => {
    if (allNodes.length === 0) return 800
    return Math.max(...allNodes.map((n) => n.x + CARD_W)) + CANVAS_PAD * 2
  }, [allNodes])
  const canvasH = useMemo(() => {
    if (allNodes.length === 0) return 600
    return Math.max(...allNodes.map((n) => n.y + CARD_H)) + CANVAS_PAD * 2
  }, [allNodes])

  const totalPeople = useMemo(() => (displayTree ? collectAllNodes(displayTree).length : 0), [displayTree])

  // Blocked drop targets for the currently dragging node
  const blockedDropIds = useMemo<Set<string>>(() => {
    if (!reparentingId || !displayTree) return new Set()
    const blocked = new Set<string>([reparentingId])
    for (const n of collectAllNodes(displayTree)) {
      if (isDescendantOf(n.id, reparentingId, displayTree)) blocked.add(n.id)
    }
    return blocked
  }, [reparentingId, displayTree])

  const centerTree = useCallback(() => {
    const el = containerRef.current
    if (!el || allNodes.length === 0) return
    const offsetX = Math.max(0, (el.clientWidth - canvasW) / 2)
    setTranslate({ x: offsetX, y: 0 })
  }, [allNodes.length, canvasW])

  const resetView = useCallback(() => {
    setScale(1)
    centerTree()
  }, [centerTree])

  const fitToScreen = useCallback(() => {
    const el = containerRef.current
    if (!el || allNodes.length === 0) return
    const viewW = el.clientWidth - 48
    const viewH = el.clientHeight - 48
    const fitScale = Math.min(Math.min(viewW / canvasW, viewH / canvasH), 1)
    setScale(fitScale)
    const offsetX = Math.max(0, (el.clientWidth - canvasW * fitScale) / 2)
    const offsetY = Math.max(0, (el.clientHeight - canvasH * fitScale) / 2)
    setTranslate({ x: offsetX, y: offsetY })
  }, [allNodes.length, canvasW, canvasH])

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    if (!document.fullscreenElement) {
      el.requestFullscreen().catch(() => {})
    } else {
      document.exitFullscreen().catch(() => {})
    }
  }, [])

  useEffect(() => {
    function onFsChange() {
      if (document.fullscreenElement) {
        setIsFullscreen(true)
        fitToScreen()
      } else {
        setIsFullscreen(false)
      }
    }
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [fitToScreen])

  useEffect(() => {
    centerTree()
  }, [centerTree])

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  const hierarchyNodeIds = useMemo(
    () => new Set(allNodes.map((n) => n.node.id)),
    [allNodes],
  )

  const draftNodeIds = useMemo(() => new Set(draftChanges.keys()), [draftChanges])
  // True when dragging a card that has no layout position in the canvas
  const reparentingIsUnassigned = reparentingId !== null && !hierarchyNodeIds.has(reparentingId)

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: moduleBackgrounds.people }}
      data-testid="org-chart-page"
    >
      {/* Drag shield — blocks dock mouseenter/mouseleave during drag, prevents dock theme flicker */}
      {reparentingId && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 60, pointerEvents: 'auto', background: 'transparent', cursor: 'grabbing' }}
          data-testid="org-chart-drag-shield"
        />
      )}

      {/* Header */}
      <div className="flex-shrink-0 px-6 pt-6 pb-4 md:px-11 md:pt-8 md:pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link
              to="/people"
              className="flex items-center justify-center w-10 h-10 rounded-lg transition-colors"
              style={{ background: t.surface }}
              data-testid="org-chart-back"
              onMouseEnter={(e) => (e.currentTarget.style.background = t.surfaceHover)}
              onMouseLeave={(e) => (e.currentTarget.style.background = t.surface)}
            >
              <ArrowLeft size={18} style={{ color: t.text }} />
            </Link>
            <div>
              <h1
                className="font-extrabold"
                style={{ fontSize: 44, letterSpacing: '-0.05em', color: t.text, lineHeight: 1 }}
              >
                Org Chart
              </h1>
              <p className="text-sm mt-2" style={{ color: t.textMuted }}>
                {totalPeople > 0
                  ? `${totalPeople} people in your organization`
                  : 'Organizational hierarchy and reporting structure'}
              </p>
            </div>
          </div>

          {/* Controls */}
          {tree && tree.length > 0 && (
            <div className="flex items-center gap-2" data-testid="org-chart-controls">
              {/* Search */}
              <div className="relative">
                {searchOpen ? (
                  <div
                    className="flex items-center gap-2 px-3 py-2 rounded-lg"
                    style={{ background: t.surface, border: `1.5px solid ${t.inputBorder}` }}
                  >
                    <Search size={14} style={{ color: t.textMuted }} />
                    <input
                      autoFocus
                      type="text"
                      placeholder="Search people..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="bg-transparent outline-none text-sm w-44"
                      style={{ color: t.text }}
                      data-testid="org-chart-search-input"
                    />
                    <button
                      onClick={() => {
                        setSearchOpen(false)
                        setSearchQuery('')
                      }}
                      data-testid="org-chart-search-close"
                    >
                      <X size={14} style={{ color: t.textMuted }} />
                    </button>
                  </div>
                ) : (
                  <ControlButton
                    icon={<Search size={16} />}
                    onClick={() => setSearchOpen(true)}
                    testId="org-chart-search-toggle"
                  />
                )}
              </div>

              <div className="w-px h-6 mx-1" style={{ background: t.inputBorder }} />

              <ControlButton icon={<ZoomOut size={16} />} onClick={zoomOut} testId="org-chart-zoom-out" />
              <span
                className="text-xs font-semibold w-12 text-center select-none"
                style={{ color: t.textMuted }}
                data-testid="org-chart-zoom-level"
              >
                {Math.round(scale * 100)}%
              </span>
              <ControlButton icon={<ZoomIn size={16} />} onClick={zoomIn} testId="org-chart-zoom-in" />

              <div className="w-px h-6 mx-1" style={{ background: t.inputBorder }} />

              {/* Export PNG */}
              <ControlButton
                icon={
                  org?.plan === 'free' ? (
                    <Lock size={16} />
                  ) : isExporting ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2" style={{ borderColor: t.accent }} />
                  ) : (
                    <Download size={16} />
                  )
                }
                onClick={handleExportPng}
                testId="org-chart-export"
              />

              <ControlButton
                icon={isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                onClick={toggleFullscreen}
                testId="org-chart-reset-view"
              />
            </div>
          )}
        </div>
      </div>

      {/* Canvas */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center" data-testid="org-chart-loading">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: t.accent }} />
        </div>
      ) : !tree || tree.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {hierarchyRoots.length > 0 && (
            <div
              ref={containerRef}
              className="flex-1 overflow-hidden relative select-none"
              style={{
                cursor: reparentingId ? 'crosshair' : isPanning ? 'grabbing' : 'grab',
                borderRadius: isFullscreen ? 0 : 16,
                margin: isFullscreen ? 0 : '16px 24px 24px',
                border: isFullscreen ? 'none' : `1.5px solid ${t.inputBorder}`,
                background: isFullscreen ? moduleBackgrounds.people : 'rgba(255,255,255,0.55)',
                minHeight: 320,
              }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              data-testid="org-chart-canvas"
            >
              {/* Sticky drag guideline */}
              {canEdit && (
                <div
                  className="absolute top-3 left-3 flex items-center gap-1.5 px-3 py-2 rounded-lg pointer-events-none z-10"
                  style={{
                    background: 'rgba(255,255,255,0.88)',
                    border: `1px solid ${t.inputBorder}`,
                    backdropFilter: 'blur(6px)',
                  }}
                  data-testid="org-chart-drag-guide"
                >
                  <GripVertical size={13} style={{ color: t.textMuted }} />
                  <span style={{ fontSize: 12, color: t.textMuted, fontWeight: 500 }}>
                    Drag cards to reassign manager
                  </span>
                </div>
              )}

              {/* Canvas grid background */}
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage:
                    `linear-gradient(${t.inputBorder} 1px, transparent 1px), ` +
                    `linear-gradient(90deg, ${t.inputBorder} 1px, transparent 1px)`,
                  backgroundSize: '40px 40px',
                  opacity: 0.45,
                  pointerEvents: 'none',
                }}
              />
              <div
                ref={contentRef}
                style={{
                  transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
                  transformOrigin: '0 0',
                  width: canvasW,
                  height: canvasH,
                  position: 'relative',
                  willChange: isPanning ? 'transform' : 'auto',
                }}
              >
                {/* SVG connectors */}
                <svg
                  width={canvasW}
                  height={canvasH}
                  style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
                  data-testid="org-chart-connectors"
                >
                  <defs>
                    <marker id="drag-arrow-ok" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
                      <path d="M 0 0 L 7 3 L 0 6 z" fill={t.accent} />
                    </marker>
                    <marker id="drag-arrow-blocked" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
                      <path d="M 0 0 L 7 3 L 0 6 z" fill={colors.err} />
                    </marker>
                  </defs>
                  {connectors.map((d, i) => (
                    <path
                      key={i}
                      d={d}
                      fill="none"
                      stroke={t.inputBorder}
                      strokeWidth={2}
                      strokeLinecap="round"
                    />
                  ))}
                  {/* Live drag connector */}
                  {reparentingId && dragCursorCanvas && (() => {
                    const srcNode = allNodes.find((n) => n.node.id === reparentingId)
                    if (!srcNode) return null
                    const srcCx = srcNode.x + CARD_W / 2
                    const srcCy = srcNode.y + CARD_H / 2
                    const isBlocked = dropTargetId ? blockedDropIds.has(dropTargetId) : false
                    const lineColor = isBlocked ? colors.err : t.accent
                    const markerId = isBlocked ? 'drag-arrow-blocked' : 'drag-arrow-ok'

                    const tgtNode = dropTargetId ? allNodes.find((n) => n.node.id === dropTargetId) : null

                    // Exit from source bottom-center; enter at nearest border of target.
                    const exitX = srcCx
                    const exitY = srcCy + CARD_H / 2
                    let entryX: number
                    let entryY: number
                    // border normal stored to compute cp2 after curveOffset is known
                    let normalX = 0; let normalY = 1; let normalLen = 1
                    let hasBorderTarget = false
                    if (tgtNode) {
                      const tgtCx = tgtNode.x + CARD_W / 2
                      const tgtCy = tgtNode.y + CARD_H / 2
                      const border = getCardBorderPoint(tgtCx, tgtCy, CARD_W / 2, CARD_H / 2, exitX, exitY)
                      entryX = border.x; entryY = border.y
                      normalX = border.x - tgtCx
                      normalY = border.y - tgtCy
                      normalLen = Math.sqrt(normalX * normalX + normalY * normalY) || 1
                      hasBorderTarget = true
                    } else {
                      entryX = dragCursorCanvas.x; entryY = dragCursorCanvas.y
                    }
                    const totalDist = Math.sqrt((entryX - exitX) ** 2 + (entryY - exitY) ** 2)
                    const curveOffset = dragCurveOffset(totalDist)
                    const cp1x = exitX
                    const cp1y = exitY + curveOffset
                    // CP2: outward along border normal (target) or mirror of CP1 (cursor)
                    const cp2x = hasBorderTarget ? entryX + (normalX / normalLen) * curveOffset : entryX
                    const cp2y = hasBorderTarget ? entryY + (normalY / normalLen) * curveOffset : entryY - curveOffset
                    const d = `M ${exitX} ${exitY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${entryX} ${entryY}`
                    return (
                      <path
                        key="drag-line"
                        d={d}
                        fill="none"
                        stroke={lineColor}
                        strokeWidth={2.5}
                        strokeDasharray="6 4"
                        strokeLinecap="round"
                        markerEnd={`url(#${markerId})`}
                        data-testid="org-chart-drag-line"
                      />
                    )
                  })()}
                </svg>

                {/* Cards */}
                {allNodes.map((ln) => {
                  const isBlocked = blockedDropIds.has(ln.node.id)
                  const isTarget = dropTargetId === ln.node.id
                  return (
                    <OrgCard
                      key={ln.node.id}
                      layoutNode={ln}
                      onSelect={setSelectedEmployeeId}
                      onToggle={toggleCollapse}
                      isCollapsed={collapsedIds.has(ln.node.id)}
                      isHighlighted={matchingIds.size > 0 && matchingIds.has(ln.node.id)}
                      isDimmed={matchingIds.size > 0 && !matchingIds.has(ln.node.id)}
                      isDrafted={draftNodeIds.has(ln.node.id)}
                      isReparenting={reparentingId === ln.node.id}
                      isDropTarget={isTarget && !isBlocked}
                      isBlockedTarget={isTarget && isBlocked}
                      canEdit={canEdit}
                      onReparentStart={handleReparentStart}
                      onReparentMove={handleReparentMove}
                      onReparentEnd={handleReparentEnd}
                    />
                  )
                })}
              </div>

              {/* Floating controls in fullscreen */}
              {isFullscreen && (
                <div
                  className="absolute top-4 right-4 flex items-center gap-2 px-2 py-1.5 rounded-xl z-10"
                  style={{ background: t.surface, boxShadow: '0 2px 12px rgba(0,0,0,0.1)' }}
                >
                  <ControlButton icon={<ZoomOut size={16} />} onClick={zoomOut} testId="org-chart-fs-zoom-out" />
                  <span
                    className="text-xs font-semibold w-12 text-center select-none"
                    style={{ color: t.textMuted }}
                  >
                    {Math.round(scale * 100)}%
                  </span>
                  <ControlButton icon={<ZoomIn size={16} />} onClick={zoomIn} testId="org-chart-fs-zoom-in" />
                  <div className="w-px h-6 mx-1" style={{ background: t.inputBorder }} />
                  <ControlButton icon={<Minimize2 size={16} />} onClick={toggleFullscreen} testId="org-chart-fs-exit" />
                </div>
              )}
            </div>
          )}

          {/* Reparent drop hint */}
          {reparentingId && (
            <div
              className="fixed bottom-8 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full text-sm font-medium z-50 pointer-events-none"
              style={{ background: t.accent, color: t.accentText, boxShadow: '0 4px 16px rgba(0,0,0,0.15)' }}
              data-testid="org-chart-reparent-hint"
            >
              Drop on a card to change manager · Drop on background to unassign
            </div>
          )}

          {/* Draft save bar */}
          {!reparentingId && draftChanges.size > 0 && (
            <div
              className="fixed bottom-20 md:bottom-24 left-1/2 -translate-x-1/2 flex items-center gap-3 px-4 py-3 rounded-xl z-40"
              style={{
                background: t.surface,
                border: `1.5px solid ${t.accent}`,
                boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
                backdropFilter: 'blur(8px)',
              }}
              data-testid="org-chart-draft-bar"
            >
              <span style={{ fontSize: 13, color: t.text, fontWeight: 500 }}>
                {draftChanges.size} unsaved change{draftChanges.size !== 1 ? 's' : ''}
              </span>
              <button
                onClick={handleDiscardDrafts}
                className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                style={{ color: t.textMuted, background: t.surfaceHover }}
                data-testid="org-chart-discard-btn"
              >
                Discard
              </button>
              <button
                onClick={handleSaveDrafts}
                disabled={isSaving}
                className="px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors"
                style={{ background: t.accent, color: t.accentText }}
                data-testid="org-chart-save-btn"
              >
                {isSaving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          )}

          {/* Unassign confirmation dialog */}
          {pendingUnassign && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center"
              style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(2px)' }}
              data-testid="org-chart-unassign-dialog"
            >
              <div
                className="rounded-2xl p-6 max-w-sm w-full mx-4 flex flex-col gap-4"
                style={{ background: t.surface, boxShadow: '0 8px 40px rgba(0,0,0,0.18)' }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center"
                    style={{ background: '#FEF3C7' }}
                  >
                    <AlertTriangle size={18} style={{ color: '#D97706' }} />
                  </div>
                  <div>
                    <p className="font-semibold" style={{ fontSize: 15, color: t.text }}>
                      Remove from hierarchy?
                    </p>
                    <p style={{ fontSize: 13, color: t.textMuted, marginTop: 2 }}>
                      {pendingUnassign.employeeName} will not report to anyone.
                    </p>
                  </div>
                </div>
                <div className="flex gap-3 justify-end">
                  <button
                    className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                    style={{ background: t.surface, color: t.text, border: `1px solid ${t.border}` }}
                    onClick={() => setPendingUnassign(null)}
                    data-testid="org-chart-unassign-cancel"
                  >
                    Cancel
                  </button>
                  <button
                    className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                    style={{ background: '#D97706', color: '#fff' }}
                    onClick={() => {
                      const { nodeId } = pendingUnassign
                      setDraftChanges((prev) => {
                        const next = new Map(prev)
                        next.set(nodeId, null)
                        return next
                      })
                      setPendingUnassign(null)
                    }}
                    data-testid="org-chart-unassign-confirm"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Unassigned section */}
          {unassigned.length > 0 && (
            <div className="flex-shrink-0 px-6 md:px-11 pb-8" data-testid="org-chart-unassigned">
              {hierarchyRoots.length > 0 && (
                <div className="flex items-center gap-3 my-6">
                  <div className="flex-1 h-px" style={{ background: t.inputBorder }} />
                  <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: t.textMuted }}>
                    Not in hierarchy
                  </span>
                  <div className="flex-1 h-px" style={{ background: t.inputBorder }} />
                </div>
              )}
              <div className="flex flex-wrap gap-4" data-testid="org-chart-unassigned-grid">
                {unassigned.map((node) => (
                  <UnassignedCard
                    key={node.id}
                    node={node}
                    onSelect={setSelectedEmployeeId}
                    isHighlighted={matchingIds.size > 0 && matchingIds.has(node.id)}
                    isDimmed={matchingIds.size > 0 && !matchingIds.has(node.id)}
                    isDrafted={draftNodeIds.has(node.id)}
                    isReparenting={reparentingId === node.id}
                    isDropTarget={dropTargetId === node.id && !blockedDropIds.has(node.id)}
                    isBlockedTarget={dropTargetId === node.id && blockedDropIds.has(node.id)}
                    onReparentStart={handleReparentStart}
                    onReparentMove={handleReparentMove}
                    onReparentEnd={handleReparentEnd}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Employee Detail Modal */}
      {selectedEmployeeId && (
        <EmployeeDetailModal
          employeeId={selectedEmployeeId}
          onClose={() => setSelectedEmployeeId(null)}
          canEdit={canEdit}
        />
      )}

      {/* Fixed-position connector for unassigned card drag (outside canvas bounds) */}
      {reparentingIsUnassigned && dragCardSrcRect && dragCurrentClient && (() => {
        const isBlocked = dropTargetId ? blockedDropIds.has(dropTargetId) : false
        const lineColor = isBlocked ? colors.err : t.accent
        const arrowId = isBlocked ? 'drag-arrow-blocked' : 'drag-arrow-ok'

        const exitX = dragCardSrcRect.cx
        const exitY = dragCardSrcRect.cy + dragCardSrcRect.hh
        let entryX: number
        let entryY: number
        let normalX = 0; let normalY = 1; let normalLen = 1
        let hasBorderTarget = false
        if (dropTargetId && dropTargetClientPos) {
          const border = getCardBorderPoint(
            dropTargetClientPos.cx, dropTargetClientPos.cy,
            dropTargetClientPos.hw, dropTargetClientPos.hh,
            exitX, exitY,
          )
          entryX = border.x; entryY = border.y
          normalX = border.x - dropTargetClientPos.cx
          normalY = border.y - dropTargetClientPos.cy
          normalLen = Math.sqrt(normalX * normalX + normalY * normalY) || 1
          hasBorderTarget = true
        } else {
          entryX = dragCurrentClient.x; entryY = dragCurrentClient.y
        }
        const totalDist = Math.sqrt((entryX - exitX) ** 2 + (entryY - exitY) ** 2)
        const curveOffset = dragCurveOffset(totalDist)
        const cp1x = exitX
        const cp1y = exitY + curveOffset
        const cp2x = hasBorderTarget ? entryX + (normalX / normalLen) * curveOffset : entryX
        const cp2y = hasBorderTarget ? entryY + (normalY / normalLen) * curveOffset : entryY - curveOffset
        const d = `M ${exitX} ${exitY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${entryX} ${entryY}`

        return (
          <svg
            key="ua-drag-overlay"
            style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9999 }}
            width="100%"
            height="100%"
            data-testid="org-chart-unassigned-drag-line"
          >
            <defs>
              <marker id="ua-drag-arrow-ok" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
                <path d="M 0 0 L 7 3 L 0 6 z" fill={t.accent} />
              </marker>
              <marker id="ua-drag-arrow-blocked" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
                <path d="M 0 0 L 7 3 L 0 6 z" fill={colors.err} />
              </marker>
            </defs>
            <path
              d={d}
              fill="none"
              stroke={lineColor}
              strokeWidth={2.5}
              strokeDasharray="6 4"
              strokeLinecap="round"
              markerEnd={`url(#ua-${arrowId})`}
              data-testid="org-chart-unassigned-drag-path"
            />
          </svg>
        )
      })()}
    </div>
  )
}

// ── Control Button ────────────────────────────────────────────────────
function ControlButton({
  icon,
  onClick,
  testId,
}: {
  icon: React.ReactNode
  onClick: () => void
  testId: string
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-center w-9 h-9 rounded-lg transition-colors"
      style={{ background: t.surface, color: t.textMuted }}
      onMouseEnter={(e) => (e.currentTarget.style.background = t.surfaceHover)}
      onMouseLeave={(e) => (e.currentTarget.style.background = t.surface)}
      data-testid={testId}
    >
      {icon}
    </button>
  )
}

// ── Org Card ──────────────────────────────────────────────────────────
function OrgCard({
  layoutNode,
  onSelect,
  onToggle,
  isCollapsed,
  isHighlighted,
  isDimmed,
  isDrafted,
  isReparenting,
  isDropTarget,
  isBlockedTarget,
  canEdit,
  onReparentStart,
  onReparentMove,
  onReparentEnd,
}: {
  layoutNode: LayoutNode
  onSelect: (id: string) => void
  onToggle: (id: string) => void
  isCollapsed: boolean
  isHighlighted: boolean
  isDimmed: boolean
  isDrafted: boolean
  isReparenting: boolean
  isDropTarget: boolean
  isBlockedTarget: boolean
  canEdit: boolean
  onReparentStart: (nodeId: string) => void
  onReparentMove: (clientX: number, clientY: number) => void
  onReparentEnd: (nodeId: string, didMove: boolean) => void
}) {
  const { node, x, y } = layoutNode
  const hasReports = (node.direct_reports?.length ?? 0) > 0
  const descendantCount = useMemo(() => countDescendants(node), [node])
  const isInvited = node.status === 'invited'

  const cardHasMoved = useRef(false)
  const dragStartPos = useRef({ x: 0, y: 0 })

  const onCardPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return
      e.stopPropagation()
      cardHasMoved.current = false
      dragStartPos.current = { x: e.clientX, y: e.clientY }
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
      onReparentStart(node.id)
    },
    [node.id, onReparentStart],
  )

  const onCardPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const dx = e.clientX - dragStartPos.current.x
      const dy = e.clientY - dragStartPos.current.y
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) cardHasMoved.current = true
      if (cardHasMoved.current) onReparentMove(e.clientX, e.clientY)
    },
    [onReparentMove],
  )

  const onCardPointerUp = useCallback(
    (_e: React.PointerEvent) => {
      onReparentEnd(node.id, cardHasMoved.current)
      cardHasMoved.current = false
    },
    [node.id, onReparentEnd],
  )

  const cardBorder = isBlockedTarget
    ? `2px solid ${colors.err}`
    : isDropTarget
      ? `2px solid ${t.accent}`
      : isHighlighted
        ? `2px solid ${t.accent}`
        : isInvited
          ? `1.5px dashed ${t.inputBorder}`
          : `1.5px solid ${t.inputBorder}`

  const cardGlow = isBlockedTarget
    ? `0 0 0 3px ${colors.err}33`
    : isDropTarget
      ? `0 0 0 3px ${t.accent}33`
      : isHighlighted
        ? `0 0 0 3px ${t.accent}22`
        : '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.03)'

  return (
    <div
      className="absolute"
      data-card-id={node.id}
      data-testid={`org-card-${node.id}`}
      style={{
        left: x,
        top: y,
        width: CARD_W,
        height: CARD_H,
        opacity: isReparenting ? 0.4 : isDimmed ? 0.35 : isInvited ? 0.6 : isDrafted ? 0.5 : 1,
        transition: 'opacity 200ms ease',
        cursor: isReparenting ? 'grabbing' : 'grab',
        zIndex: isReparenting ? 1000 : isDropTarget || isBlockedTarget ? 10 : 1,
      }}
      onPointerDown={onCardPointerDown}
      onPointerMove={onCardPointerMove}
      onPointerUp={onCardPointerUp}
    >
      <button
        onClick={() => {
          if (!cardHasMoved.current) onSelect(node.id)
        }}
        className="w-full h-full flex items-center gap-3 px-4 transition-all duration-150"
        style={{
          background: t.surface,
          borderRadius: 14,
          border: cardBorder,
          boxShadow: cardGlow,
          cursor: 'pointer',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = t.surfaceHover
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'
          if (!isHighlighted && !isDropTarget && !isBlockedTarget)
            e.currentTarget.style.borderColor = t.accent
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = t.surface
          e.currentTarget.style.boxShadow = cardGlow
          if (!isHighlighted && !isDropTarget && !isBlockedTarget)
            e.currentTarget.style.borderColor = isInvited ? t.inputBorder : t.inputBorder
        }}
        data-testid={`org-card-btn-${node.id}`}
      >
        <Avatar name={node.full_name} id={node.id} size={44} />
        <div className="flex-1 min-w-0 text-left">
          <p
            className="font-semibold truncate"
            style={{ fontSize: 13, color: t.text, lineHeight: 1.3 }}
          >
            {node.full_name}
          </p>
          <p
            className="truncate mt-0.5"
            style={{ fontSize: 11, color: t.textMuted, lineHeight: 1.3 }}
          >
            {node.job_title || node.employment_type.replace('_', ' ')}
          </p>
          <div className="flex items-center gap-2 mt-1.5">
            {isInvited ? (
              <span
                className="px-1.5 py-0.5 rounded text-xs font-medium"
                style={{ background: `${t.accent}15`, color: t.accent }}
                data-testid={`org-card-invited-badge-${node.id}`}
              >
                Pending invite
              </span>
            ) : (
              <StatusSquare status={node.status} />
            )}
            {hasReports && !isInvited && (
              <span
                className="flex items-center gap-1 px-1.5 py-0.5 rounded"
                style={{ background: `${t.accent}10`, color: t.accent, fontSize: 10, fontWeight: 600 }}
              >
                <Users size={9} />
                {descendantCount}
              </span>
            )}
          </div>
        </div>
      </button>

      {/* Draft indicator dot */}
      {isDrafted && (
        <div
          className="absolute"
          style={{
            top: 8,
            right: 8,
            width: 7,
            height: 7,
            borderRadius: 2,
            background: colors.warn,
            boxShadow: `0 0 0 2px ${moduleBackgrounds.people}`,
          }}
          data-testid={`org-card-draft-dot-${node.id}`}
        />
      )}

      {/* Expand/Collapse toggle */}
      {hasReports && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onToggle(node.id)
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-7 h-7 flex items-center justify-center rounded-full transition-all"
          style={{
            background: t.accent,
            color: t.accentText,
            border: `2.5px solid ${moduleBackgrounds.people}`,
            fontSize: 10,
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          }}
          data-testid={`org-toggle-${node.id}`}
        >
          {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        </button>
      )}

    </div>
  )
}

// ── Unassigned Card ───────────────────────────────────────────────────
function UnassignedCard({
  node,
  onSelect,
  isHighlighted,
  isDimmed,
  isDrafted,
  isReparenting,
  isDropTarget,
  isBlockedTarget,
  onReparentStart,
  onReparentMove,
  onReparentEnd,
}: {
  node: OrgChartNode
  onSelect: (id: string) => void
  isHighlighted: boolean
  isDimmed: boolean
  isDrafted: boolean
  isReparenting: boolean
  isDropTarget: boolean
  isBlockedTarget: boolean
  onReparentStart: (nodeId: string, cardSrcRect?: { cx: number; cy: number; hw: number; hh: number }) => void
  onReparentMove: (clientX: number, clientY: number) => void
  onReparentEnd: (nodeId: string, didMove: boolean) => void
}) {
  const isInvited = node.status === 'invited'
  const cardHasMoved = useRef(false)
  const dragStartPos = useRef({ x: 0, y: 0 })

  const onCardPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return
      e.stopPropagation()
      cardHasMoved.current = false
      dragStartPos.current = { x: e.clientX, y: e.clientY }
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
      const r = e.currentTarget.getBoundingClientRect()
      onReparentStart(node.id, { cx: r.left + r.width / 2, cy: r.top + r.height / 2, hw: r.width / 2, hh: r.height / 2 })
    },
    [node.id, onReparentStart],
  )

  const onCardPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const dx = e.clientX - dragStartPos.current.x
      const dy = e.clientY - dragStartPos.current.y
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) cardHasMoved.current = true
      if (cardHasMoved.current) onReparentMove(e.clientX, e.clientY)
    },
    [onReparentMove],
  )

  const onCardPointerUp = useCallback(
    (_e: React.PointerEvent) => {
      onReparentEnd(node.id, cardHasMoved.current)
      cardHasMoved.current = false
    },
    [node.id, onReparentEnd],
  )

  const cardBorder = isBlockedTarget
    ? `2px solid ${colors.err}`
    : isDropTarget
      ? `2px solid ${t.accent}`
      : isHighlighted
        ? `2px solid ${t.accent}`
        : isInvited
          ? `1.5px dashed ${t.inputBorder}`
          : `1.5px solid ${t.inputBorder}`

  const cardGlow = isBlockedTarget
    ? `0 0 0 3px ${colors.err}33`
    : isDropTarget
      ? `0 0 0 3px ${t.accent}33`
      : isHighlighted
        ? `0 0 0 3px ${t.accent}22`
        : '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.03)'

  return (
    <div
      className="relative"
      data-card-id={node.id}
      data-testid={`org-unassigned-wrapper-${node.id}`}
      style={{ cursor: isReparenting ? 'grabbing' : 'grab' }}
      onPointerDown={onCardPointerDown}
      onPointerMove={onCardPointerMove}
      onPointerUp={onCardPointerUp}
    >
      <button
        onClick={() => { if (!cardHasMoved.current) onSelect(node.id) }}
        className="flex items-center gap-3 px-4 py-3 transition-all duration-150"
        style={{
          width: CARD_W,
          background: t.surface,
          borderRadius: 14,
          border: cardBorder,
          boxShadow: cardGlow,
          cursor: 'inherit',
          opacity: isReparenting ? 0.4 : isDimmed ? 0.35 : isInvited ? 0.6 : isDrafted ? 0.5 : 1,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = t.surfaceHover
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'
          if (!isHighlighted && !isDropTarget && !isBlockedTarget)
            e.currentTarget.style.borderColor = t.accent
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = t.surface
          e.currentTarget.style.boxShadow = cardGlow
          if (!isHighlighted && !isDropTarget && !isBlockedTarget)
            e.currentTarget.style.borderColor = t.inputBorder
        }}
        data-testid={`org-unassigned-${node.id}`}
      >
        <Avatar name={node.full_name} id={node.id} size={40} />
        <div className="flex-1 min-w-0 text-left">
          <p
            className="font-semibold truncate"
            style={{ fontSize: 13, color: t.text, lineHeight: 1.3 }}
          >
            {node.full_name}
          </p>
          <p
            className="truncate mt-0.5"
            style={{ fontSize: 11, color: t.textMuted, lineHeight: 1.3 }}
          >
            {node.job_title || node.employment_type.replace('_', ' ')}
          </p>
          <div className="mt-1">
            {isInvited ? (
              <span
                className="px-1.5 py-0.5 rounded text-xs font-medium"
                style={{ background: `${t.accent}15`, color: t.accent }}
              >
                Pending invite
              </span>
            ) : (
              <StatusSquare status={node.status} />
            )}
          </div>
        </div>
      </button>

      {/* Draft indicator dot */}
      {isDrafted && (
        <div
          className="absolute"
          style={{
            top: 8,
            right: 8,
            width: 7,
            height: 7,
            borderRadius: 2,
            background: colors.warn,
            boxShadow: `0 0 0 2px ${t.surface}`,
          }}
          data-testid={`org-card-draft-dot-${node.id}`}
        />
      )}

    </div>
  )
}

// ── Empty State ───────────────────────────────────────────────────────
function EmptyState() {
  const canManageEmployees = useCanManageEmployees()

  return (
    <div
      className="flex-1 flex flex-col items-center justify-center gap-3"
      data-testid="org-chart-empty"
    >
      <div
        className="grid place-items-center"
        style={{ width: 48, height: 48, borderRadius: 14, background: t.accent }}
      >
        <Users size={22} style={{ color: t.accentText }} />
      </div>
      <p className="font-bold" style={{ fontSize: 15, color: t.text }}>
        No organizational structure yet
      </p>
      <p style={{ fontSize: 13, color: t.textMuted }}>
        Add employees and assign managers to build your org chart.
      </p>
      {canManageEmployees && (
        <Link
          to="/people/new"
          search={{ user_id: undefined, reporting_to: undefined }}
          className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2.5 mt-2 transition-colors hover:opacity-90"
          style={{ background: t.accent, color: t.accentText, borderRadius: 12 }}
          data-testid="org-chart-add-employee"
        >
          Add employee
        </Link>
      )}
    </div>
  )
}
