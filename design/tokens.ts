/**
 * Workived Design Tokens
 * Source of truth for all colours, typography, spacing, and module themes.
 * Import this anywhere in the app — never hardcode values.
 */

// ── COLOURS ──────────────────────────────────────────────────
export const colors = {
  // Accent
  accent:      '#6357E8',
  accentDim:   '#EFEDFD',
  accentMid:   '#8F86F0',
  accentText:  '#4A3FBF',

  // Semantic
  ok:          '#12A05C',
  okDim:       '#E8F7EE',
  okText:      '#0D7A45',

  warn:        '#C97B2A',
  warnDim:     '#FDF2E3',
  warnText:    '#A0601A',

  err:         '#D44040',
  errDim:      '#FDECEC',
  errText:     '#AE2E2E',

  // Ink (warm neutrals — slight violet undertone)
  ink900:      '#0F0E13',  // near-black
  ink700:      '#1F1D2B',  // dark nav background
  ink500:      '#72708A',  // secondary text
  ink300:      '#B0AEBE',  // muted / placeholder
  ink150:      '#DDDBE8',  // borders
  ink100:      '#EDECF4',  // subtle borders
  ink50:       '#F3F2FB',  // page background
  ink0:        '#FFFFFF',  // pure white surfaces
} as const

// ── MODULE BACKGROUNDS ────────────────────────────────────────
// Each module is a full-screen world with its own colour temperature
export const moduleBackgrounds = {
  overview:    '#0C0C0F',  // deep violet night
  people:      '#080A12',  // deep midnight navy
  attendance:  '#111214',  // deep charcoal
  leave:       '#F3F2FB',  // soft violet
  claims:      '#F3F2FB',  // soft violet
  tasks:       '#0E0E1A',  // deep dark (dark Kanban board)
  reports:     '#0F0F1A',  // deep indigo night
} as const

// ── DOCK THEMES ───────────────────────────────────────────────
// The floating dock adapts its colour to the current module
const _dock = {
  bg:     'rgba(255,255,255,0.09)',
  border: 'rgba(255,255,255,0.12)',
  icon:   'rgba(255,255,255,0.45)',
  label:  'rgba(255,255,255,0.28)',
  active: {
    bg:    'rgba(255,255,255,0.16)',
    icon:  '#FFFFFF',
    label: 'rgba(255,255,255,0.85)',
  },
} as const

// Dock theme for light backgrounds (leave, claims)
const _dockLight = {
  bg:     'rgba(0,0,0,0.04)',
  border: 'rgba(0,0,0,0.08)',
  icon:   'rgba(0,0,0,0.50)',
  label:  'rgba(0,0,0,0.40)',
  active: {
    bg:    'rgba(0,0,0,0.08)',
    icon:  '#0F0E13', // ink900 - near black
    label: 'rgba(0,0,0,0.85)',
  },
} as const

export const dockThemes = {
  overview:   _dock,
  people:     _dock,
  attendance: _dock,
  leave:      _dockLight,
  claims:     _dockLight,
  tasks:      _dock,
  reports:    _dock,
} as const

// ── MODULE THEMES ─────────────────────────────────────────────
// Per-module colour palette for page content (text, surfaces, accents).
// All dark modules share the same structure so pages never hardcode rgba().
export const moduleThemes = {
  overview: {
    text:         '#FFE6F0', // soft warm white-pink for unique people module
    textMuted:    'rgba(200,190,255,0.45)',
    surface:      'rgba(255,255,255,0.05)',
    surfaceHover: 'rgba(255,255,255,0.10)',
    accent:       'rgba(255,255,255,0.12)',
    accentText:   '#FFFFFF',
    border:       'rgba(255,255,255,0.10)',
    input:        'rgba(255,255,255,0.07)',
    inputBorder:  'rgba(255,255,255,0.12)',
  },
  people: {
    text:         '#FFFFFF',
    textMuted:    '#B0AEBE', // gentle violet/neutral
    surface:      '#080A12', // deep navy, matches people background
    surfaceHover: '#18141A', // slightly lighter navy
    accent:       '#75293c', // soft, friendly pink for highlights
    accentText:   '#FFFFFF',
    border:       '#2A2230', // deep muted border
    input:        '#18141A',
    inputBorder:  '#2A2230',
  },
  attendance: {
    text:         'rgba(255,255,255,0.92)',
    textMuted:    'rgba(130,200,255,0.55)',
    surface:      'rgba(130,200,255,0.06)',
    surfaceHover: 'rgba(130,200,255,0.11)',
    accent:       'rgba(130,200,255,0.14)',
    accentText:   '#A8D8FF',
    border:       'rgba(130,200,255,0.14)',
    input:        'rgba(255,255,255,0.07)',
    inputBorder:  'rgba(130,200,255,0.18)',
  },
  leave: {
    text:         '#0F0E13',
    textMuted:    '#72708A',
    surface:      '#FFFFFF',
    surfaceHover: '#F3F2FB',
    accent:       '#6357E8',
    accentText:   '#FFFFFF',
    border:       'rgba(99,87,232,0.10)',
    input:        '#FFFFFF',
    inputBorder:  'rgba(99,87,232,0.12)',
  },
  claims: {
    text:         '#0F0E13',
    textMuted:    '#72708A',
    surface:      '#FFFFFF',
    surfaceHover: '#F3F2FB',
    accent:       '#6357E8',
    accentText:   '#FFFFFF',
    border:       'rgba(99,87,232,0.10)',
    input:        '#FFFFFF',
    inputBorder:  'rgba(99,87,232,0.12)',
  },
  tasks: {
    text:         'rgba(255,255,255,0.92)',
    textMuted:    'rgba(200,190,255,0.45)',
    surface:      'rgba(255,255,255,0.05)',
    surfaceHover: 'rgba(255,255,255,0.10)',
    accent:       'rgba(255,255,255,0.12)',
    accentText:   '#FFFFFF',
    border:       'rgba(255,255,255,0.10)',
    input:        'rgba(255,255,255,0.07)',
    inputBorder:  'rgba(255,255,255,0.12)',
  },
  reports: {
    text:         'rgba(255,255,255,0.92)',
    textMuted:    'rgba(160,185,255,0.45)',
    surface:      'rgba(255,255,255,0.05)',
    surfaceHover: 'rgba(255,255,255,0.10)',
    accent:       'rgba(255,255,255,0.12)',
    accentText:   '#FFFFFF',
    border:       'rgba(255,255,255,0.10)',
    input:        'rgba(255,255,255,0.07)',
    inputBorder:  'rgba(255,255,255,0.12)',
  },
} as const

// ── LOGO MARK COLOURS PER MODULE ─────────────────────────────
export const logoMarkColors = {
  overview:    { bg: '#1E1A3A', primary: '#9B8FF7', textPrimary: '#FFFFFF', textAccent: '#9B8FF7' },
  people:      { bg: '#0D1224', primary: '#FF8AAE', textPrimary: '#FFFFFF', textAccent: '#FF8AAE' },
  attendance:  { bg: '#1E2026', primary: '#5BB8F5', textPrimary: '#FFFFFF', textAccent: '#5BB8F5' },
  leave:       { bg: '#DEDAF8', primary: '#6357E8', textPrimary: '#0F0E13', textAccent: '#6357E8' },
  claims:      { bg: '#DEDAF8', primary: '#6357E8', textPrimary: '#0F0E13', textAccent: '#6357E8' },
  tasks:       { bg: '#1E1A3A', primary: '#818CF8', textPrimary: '#FFFFFF', textAccent: '#818CF8' },
  reports:     { bg: '#1A1A2E', primary: '#60A5FA', textPrimary: '#FFFFFF', textAccent: '#60A5FA' },
} as const

// ── TYPOGRAPHY ────────────────────────────────────────────────
export const typography = {
  fontFamily:  "'Plus Jakarta Sans', sans-serif",
  fontMono:    "'SF Mono', 'Fira Code', monospace",

  // Scale
  display:  { size: '44px', weight: 800, tracking: '-0.05em', lineHeight: '1.0' },
  h1:       { size: '32px', weight: 800, tracking: '-0.04em', lineHeight: '1.05' },
  h2:       { size: '22px', weight: 700, tracking: '-0.03em', lineHeight: '1.1' },
  h3:       { size: '16px', weight: 700, tracking: '-0.02em', lineHeight: '1.2' },
  body:     { size: '14px', weight: 400, tracking: 'normal',  lineHeight: '1.6' },
  label:    { size: '13px', weight: 500, tracking: '-0.01em', lineHeight: '1.4' },
  caption:  { size: '11px', weight: 500, tracking: '0.04em',  lineHeight: '1.4' },
  tiny:     { size: '10px', weight: 600, tracking: '0.08em',  lineHeight: '1.3' },
  mono:     { size: '12px', weight: 400, tracking: '0.02em',  lineHeight: '1.5' },
} as const

// ── SPACING ───────────────────────────────────────────────────
export const spacing = {
  1:   '4px',
  2:   '8px',
  3:   '12px',
  4:   '16px',
  5:   '20px',
  6:   '24px',
  7:   '28px',
  8:   '32px',
  10:  '40px',
  12:  '48px',
} as const

// ── RADIUS ────────────────────────────────────────────────────
export const radius = {
  sm:   '6px',
  md:   '9px',
  lg:   '12px',
  xl:   '14px',
  '2xl':'18px',
  full: '9999px',
  status: '2px',   // Status squares — NOT full radius
} as const

// ── STATUS INDICATOR ──────────────────────────────────────────
// Small coloured squares — NOT pills or badges
export const statusConfig = {
  active:     { color: '#12A05C', label: 'Active' },
  probation:  { color: '#6357E8', label: 'Probation' },
  on_leave:   { color: '#C97B2A', label: 'On leave' },
  inactive:   { color: '#B0AEBE', label: 'Inactive' },
  absent:     { color: '#D44040', label: 'Absent' },
  present:    { color: '#12A05C', label: 'Present' },
  late:       { color: '#C97B2A', label: 'Late' },
  pending:    { color: '#C97B2A', label: 'Pending' },
  approved:   { color: '#12A05C', label: 'Approved' },
  rejected:   { color: '#D44040', label: 'Rejected' },
  paid:       { color: '#6357E8', label: 'Paid' },
} as const

export type StatusKey = keyof typeof statusConfig

// ── AVATAR COLOURS ────────────────────────────────────────────
// Rotate through these for employee avatars
export const avatarColors = [
  { bg: '#EFEDFD', text: '#4A3FBF' },
  { bg: '#E8F7EE', text: '#0D7A45' },
  { bg: '#FDF2E3', text: '#A0601A' },
  { bg: '#FDECEC', text: '#AE2E2E' },
  { bg: '#EDECF4', text: '#72708A' },
] as const

// Deterministic avatar colour from a string (employee ID or name)
export function getAvatarColor(seed: string): { bg: string; text: string } {
  const idx = seed.charCodeAt(0) % avatarColors.length
  return avatarColors[idx] ?? avatarColors[0]!
}
