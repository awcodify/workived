import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { DailyEntry } from '@/types/api'

// ── Mock Leaflet (no DOM map in jsdom) ────────────────────────────────────────

const mockMap = {
  remove: vi.fn(),
  addLayer: vi.fn(),
  removeLayer: vi.fn(),
  fitBounds: vi.fn(),
}

const mockLayerGroup = {
  addTo: vi.fn(() => mockLayerGroup),
}

const mockMarker = {
  bindPopup: vi.fn(() => mockMarker),
  addTo: vi.fn(() => mockMarker),
}

vi.mock('leaflet', () => ({
  default: {
    map: vi.fn(() => mockMap),
    tileLayer: vi.fn(() => ({ addTo: vi.fn() })),
    layerGroup: vi.fn(() => mockLayerGroup),
    marker: vi.fn(() => mockMarker),
    popup: vi.fn(() => ({ setContent: vi.fn(() => ({ setContent: vi.fn() })) })),
    divIcon: vi.fn(() => ({})),
    latLngBounds: vi.fn(() => ({})),
    Icon: {
      Default: {
        prototype: {},
        mergeOptions: vi.fn(),
      },
    },
  },
}))

// Mock CSS import
vi.mock('leaflet/dist/leaflet.css', () => ({}))

import { TeamMapView } from './TeamMapView'

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeEntry(overrides: Partial<DailyEntry> = {}): DailyEntry {
  return {
    employee_id: 'emp-1',
    employee_name: 'Alice',
    status: 'present',
    clock_in_at: '2026-04-08T01:00:00Z',
    clock_in_latitude: -6.2,
    clock_in_longitude: 106.8,
    work_location_type: 'office',
    ...overrides,
  }
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('TeamMapView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows empty state when no entries have location', () => {
    const entries: DailyEntry[] = [
      makeEntry({ clock_in_latitude: undefined, clock_in_longitude: undefined }),
      { employee_id: 'emp-2', employee_name: 'Bob', status: 'absent' },
    ]
    render(<TeamMapView entries={entries} date="2026-04-08" timezone="Asia/Jakarta" />)
    expect(screen.getByText(/no location data/i)).toBeTruthy()
  })

  it('renders map container when entries have location', () => {
    const entries = [makeEntry(), makeEntry({ employee_id: 'emp-2', employee_name: 'Bob' })]
    const { container } = render(
      <TeamMapView entries={entries} date="2026-04-08" timezone="Asia/Jakarta" />,
    )
    // Map container div should be present
    expect(container.querySelector('[style*="height: 480px"]') ?? container.querySelector('div')).toBeTruthy()
  })

  it('shows employee count in legend', () => {
    const entries = [
      makeEntry(),
      makeEntry({ employee_id: 'emp-2', employee_name: 'Bob', clock_in_latitude: -6.3, clock_in_longitude: 106.9 }),
      // one without location
      { employee_id: 'emp-3', employee_name: 'Carol', status: 'absent' as const },
    ]
    render(<TeamMapView entries={entries} date="2026-04-08" timezone="Asia/Jakarta" />)
    expect(screen.getByText(/2 of 3 employees with location/i)).toBeTruthy()
  })

  it('shows location type labels in legend', () => {
    render(
      <TeamMapView entries={[makeEntry()]} date="2026-04-08" timezone="Asia/Jakarta" />,
    )
    expect(screen.getByText('Office')).toBeTruthy()
    expect(screen.getByText('WFH')).toBeTruthy()
    expect(screen.getByText('Remote')).toBeTruthy()
  })
})
