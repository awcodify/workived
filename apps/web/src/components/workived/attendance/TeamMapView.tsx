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

function locationLabel(type?: string | null): string {
  switch (type) {
    case 'office': return 'Office'
    case 'wfh': return 'WFH'
    case 'wfa':
    case 'remote': return 'Remote'
    default: return 'Unknown'
  }
}

function locationColor(type?: string | null): string {
  switch (type) {
    case 'office': return colors.ok
    case 'wfh': return colors.accent
    case 'wfa':
    case 'remote': return colors.warn
    default: return '#6B7280'
  }
}

function buildIcon(color: string, initials: string): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `
      <div style="
        position:relative;
        width:36px;
        height:44px;
        display:flex;
        flex-direction:column;
        align-items:center;
      ">
        <!-- Circle with initials -->
        <div style="
          width:36px;height:36px;border-radius:50%;
          background:${color};
          border:3px solid #fff;
          box-shadow:0 3px 10px rgba(0,0,0,0.35);
          display:flex;align-items:center;justify-content:center;
          font-family:system-ui,sans-serif;
          font-size:13px;font-weight:700;
          color:#fff;
          letter-spacing:-0.5px;
        ">${initials}</div>
        <!-- Pointer tail -->
        <div style="
          width:0;height:0;
          border-left:6px solid transparent;
          border-right:6px solid transparent;
          border-top:8px solid ${color};
          margin-top:-1px;
          filter:drop-shadow(0 2px 2px rgba(0,0,0,0.2));
        "></div>
      </div>
    `,
    iconSize: [36, 44],
    iconAnchor: [18, 44],
    popupAnchor: [0, -46],
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

      // Inject popup styles once
      if (!document.getElementById('workived-map-styles')) {
        const style = document.createElement('style')
        style.id = 'workived-map-styles'
        style.textContent = `
          .workived-popup .leaflet-popup-content-wrapper {
            border-radius: 12px;
            box-shadow: 0 8px 24px rgba(0,0,0,0.15);
            padding: 0;
            overflow: hidden;
          }
          .workived-popup .leaflet-popup-content {
            margin: 12px;
            min-width: 200px;
          }
          .workived-popup .leaflet-popup-tip-container {
            margin-top: -1px;
          }
        `
        document.head.appendChild(style)
      }

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
      const initials = entry.employee_name
        .split(' ')
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() ?? '')
        .join('')
      const icon = buildIcon(color, initials)

      const photoHtml = entry.clock_in_photo_url
        ? `<img src="${entry.clock_in_photo_url}" alt="" style="
            width:100%;height:120px;object-fit:cover;
            border-radius:8px;margin-bottom:10px;display:block;
          "/>`
        : ''

      const clockOut = entry.clock_out_at
        ? `<div style="display:flex;align-items:center;gap:6px;">
            <div style="width:6px;height:6px;border-radius:50%;background:#9CA3AF;flex-shrink:0;"></div>
            <span style="color:#6B7280;font-size:11px;">Out</span>
            <span style="color:#111;font-size:12px;font-weight:600;margin-left:auto;">${formatTime(entry.clock_out_at, timezone)}</span>
          </div>`
        : `<div style="display:flex;align-items:center;gap:6px;">
            <div style="width:6px;height:6px;border-radius:50%;background:#D1FAE5;flex-shrink:0;"></div>
            <span style="color:#6B7280;font-size:11px;">Still working</span>
          </div>`

      const popup = L.popup({ maxWidth: 220, className: 'workived-popup' }).setContent(`
        <div style="font-family:system-ui,-apple-system,sans-serif;padding:2px;">
          ${photoHtml}
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
            <div style="
              width:32px;height:32px;border-radius:50%;flex-shrink:0;
              background:${color};display:flex;align-items:center;justify-content:center;
              font-size:12px;font-weight:700;color:#fff;
            ">${initials}</div>
            <div style="min-width:0;">
              <div style="font-weight:700;font-size:13px;color:#111;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                ${entry.employee_name}
              </div>
              <div style="
                display:inline-flex;align-items:center;gap:3px;
                padding:1px 7px;border-radius:99px;font-size:10px;font-weight:700;
                background:${color}1A;color:${color};margin-top:1px;
              ">
                <div style="width:5px;height:5px;border-radius:50%;background:${color};"></div>
                ${locationLabel(entry.work_location_type)}
              </div>
            </div>
          </div>
          <div style="
            background:#F9FAFB;border-radius:8px;padding:8px 10px;
            display:flex;flex-direction:column;gap:5px;
          ">
            <div style="display:flex;align-items:center;gap:6px;">
              <div style="width:6px;height:6px;border-radius:50%;background:#10B981;flex-shrink:0;"></div>
              <span style="color:#6B7280;font-size:11px;">In</span>
              <span style="color:#111;font-size:12px;font-weight:600;margin-left:auto;">${formatTime(entry.clock_in_at, timezone)}</span>
            </div>
            ${clockOut}
          </div>
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
        {(['office', 'wfh', 'remote', undefined] as (string | undefined)[]).map((type) => (
          <div key={type ?? 'unknown'} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: '50%',
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
