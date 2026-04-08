import { useEffect, useRef } from 'react'
import type { Map as LeafletMap, LayerGroup } from 'leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { DailyEntry } from '@/types/api'
import { colors } from '@/design/tokens'

// Fix Leaflet's broken default icon paths in bundlers
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

interface TeamMapViewProps {
  entries: DailyEntry[]
  date: string
  timezone: string
}

function locationLabel(type?: string): string {
  switch (type) {
    case 'office': return 'Office'
    case 'wfh': return 'WFH'
    case 'wfa': return 'WFA'
    default: return 'Unknown'
  }
}

function locationColor(type?: string): string {
  switch (type) {
    case 'office': return colors.ok
    case 'wfh': return colors.accent
    case 'wfa': return colors.warn
    default: return '#888'
  }
}

function buildIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:14px;height:14px;border-radius:3px;
      background:${color};border:2px solid #fff;
      box-shadow:0 1px 4px rgba(0,0,0,0.4);
    "></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    popupAnchor: [0, -10],
  })
}

function formatTime(iso?: string, tz?: string): string {
  if (!iso) return '—'
  try {
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: tz ?? 'UTC',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

export function TeamMapView({ entries, date, timezone }: TeamMapViewProps) {
  const mapRef = useRef<LeafletMap | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const clusterRef = useRef<LayerGroup | null>(null)

  const located = entries.filter(
    (e) => e.clock_in_latitude != null && e.clock_in_longitude != null,
  )

  useEffect(() => {
    if (!containerRef.current) return

    // Init map once
    if (!mapRef.current) {
      mapRef.current = L.map(containerRef.current, {
        center: [0, 0],
        zoom: 12,
        zoomControl: true,
      })

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(mapRef.current)
    }

    const map = mapRef.current

    // Remove previous cluster layer
    if (clusterRef.current) {
      map.removeLayer(clusterRef.current)
      clusterRef.current = null
    }

    if (located.length === 0) return

    // Use native layer group (no MarkerCluster plugin needed for basic grouping)
    const group = L.layerGroup()

    for (const entry of located) {
      const lat = entry.clock_in_latitude!
      const lng = entry.clock_in_longitude!
      const color = locationColor(entry.work_location_type)
      const icon = buildIcon(color)

      const photoHtml = entry.clock_in_photo_url
        ? `<img src="${entry.clock_in_photo_url}" alt="Clock-in photo" style="width:100%;border-radius:4px;margin-top:6px;"/>`
        : ''

      const popup = L.popup({ maxWidth: 200 }).setContent(`
        <div style="font-family:system-ui,sans-serif;font-size:13px;line-height:1.4">
          <div style="font-weight:700;margin-bottom:2px">${entry.employee_name}</div>
          <div style="
            display:inline-block;padding:1px 6px;border-radius:3px;font-size:11px;
            background:${color}22;color:${color};font-weight:600;margin-bottom:4px;
          ">${locationLabel(entry.work_location_type)}</div>
          <div style="color:#555">Clocked in: ${formatTime(entry.clock_in_at, timezone)}</div>
          ${entry.clock_out_at ? `<div style="color:#555">Clocked out: ${formatTime(entry.clock_out_at, timezone)}</div>` : ''}
          ${photoHtml}
        </div>
      `)

      L.marker([lat, lng], { icon }).bindPopup(popup).addTo(group)
    }

    // Use a simple cluster-like layer group
    group.addTo(map)
    clusterRef.current = group

    // Fit bounds to all markers
    const bounds = L.latLngBounds(located.map((e) => [e.clock_in_latitude!, e.clock_in_longitude!]))
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 })
  }, [located, timezone]) // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [])

  if (located.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: 400,
          color: '#888',
          fontSize: 14,
          gap: 8,
        }}
      >
        <div style={{ fontSize: 32 }}>📍</div>
        <div>No location data for {date}</div>
        <div style={{ fontSize: 12, color: '#aaa' }}>
          Employees who clock in with GPS will appear here
        </div>
      </div>
    )
  }

  return (
    <div style={{ position: 'relative' }}>
      {/* Legend */}
      <div
        style={{
          display: 'flex',
          gap: 16,
          marginBottom: 12,
          fontSize: 12,
          color: '#555',
        }}
      >
        {(['office', 'wfh', 'wfa'] as const).map((type) => (
          <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: 2,
                background: locationColor(type),
                flexShrink: 0,
              }}
            />
            <span>{locationLabel(type)}</span>
          </div>
        ))}
        <div style={{ marginLeft: 'auto', color: '#888' }}>
          {located.length} of {entries.length} employees with location
        </div>
      </div>

      {/* Map container */}
      <div
        ref={containerRef}
        style={{
          height: 480,
          borderRadius: 10,
          overflow: 'hidden',
          border: '1px solid #e5e5e5',
        }}
      />
    </div>
  )
}
