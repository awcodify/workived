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
  people:      '#F5F0E8',  // warm cream
  attendance:  '#E8F5EE',  // fresh green morning
  leave:       '#F3F2FB',  // soft violet
  claims:      '#F3F2FB',  // soft violet
  tasks:       '#FDF4E3',  // warm amber energy
  reports:     '#0F0F1A',  // deep indigo night
} as const

// ── DOCK THEMES ───────────────────────────────────────────────
// The floating dock adapts its colour to the current module
export const dockThemes = {
  overview: {
    bg:     'rgba(255,255,255,0.07)',
    border: 'rgba(255,255,255,0.1)',
    icon:   'rgba(255,255,255,0.45)',
    label:  'rgba(255,255,255,0.28)',
    active: {
      bg:    'rgba(255,255,255,0.15)',
      icon:  '#FFFFFF',
      label: 'rgba(255,255,255,0.85)',
    },
  },
  people: {
    bg:     'rgba(26,18,8,0.07)',
    border: 'rgba(26,18,8,0.10)',
    icon:   'rgba(26,18,8,0.28)',
    label:  'rgba(26,18,8,0.28)',
    active: {
      bg:    'rgba(26,18,8,0.12)',
      icon:  '#1A1208',
      label: '#1A1208',
    },
  },
  attendance: {
    bg:     'rgba(10,46,26,0.07)',
    border: 'rgba(10,46,26,0.10)',
    icon:   'rgba(10,46,26,0.28)',
    label:  'rgba(10,46,26,0.28)',
    active: {
      bg:    'rgba(10,46,26,0.12)',
      icon:  '#0A2E1A',
      label: '#0A2E1A',
    },
  },
  leave: {
    bg:     'rgba(99,87,232,0.07)',
    border: 'rgba(99,87,232,0.12)',
    icon:   'rgba(99,87,232,0.35)',
    label:  'rgba(99,87,232,0.35)',
    active: {
      bg:    'rgba(99,87,232,0.14)',
      icon:  '#4A3FBF',
      label: '#4A3FBF',
    },
  },
  claims: {
    bg:     'rgba(99,87,232,0.07)',
    border: 'rgba(99,87,232,0.12)',
    icon:   'rgba(99,87,232,0.35)',
    label:  'rgba(99,87,232,0.35)',
    active: {
      bg:    'rgba(99,87,232,0.14)',
      icon:  '#4A3FBF',
      label: '#4A3FBF',
    },
  },
  tasks: {
    bg:     'rgba(255,255,255,0.07)',
    border: 'rgba(255,255,255,0.1)',
    icon:   'rgba(255,255,255,0.45)',
    label:  'rgba(255,255,255,0.28)',
    active: {
      bg:    'rgba(255,255,255,0.15)',
      icon:  '#FFFFFF',
      label: 'rgba(255,255,255,0.85)',
    },
  },
  reports: {
    bg:     'rgba(255,255,255,0.07)',
    border: 'rgba(255,255,255,0.1)',
    icon:   'rgba(255,255,255,0.45)',
    label:  'rgba(255,255,255,0.28)',
    active: {
      bg:    'rgba(255,255,255,0.15)',
      icon:  '#FFFFFF',
      label: 'rgba(255,255,255,0.85)',
    },
  },
} as const

// ── LOGO MARK COLOURS PER MODULE ─────────────────────────────
export const logoMarkColors = {
  overview:    { bg: '#1E1A3A', primary: '#9B8FF7', textPrimary: '#FFFFFF', textAccent: '#9B8FF7' },
  people:      { bg: '#EAE4D8', primary: '#7C5C2E', textPrimary: '#1A1208', textAccent: '#7C5C2E' },
  attendance:  { bg: '#D0EDD9', primary: '#0A6E35', textPrimary: '#0A2E1A', textAccent: '#0A6E35' },
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
export function getAvatarColor(seed: string) {
  const idx = seed.charCodeAt(0) % avatarColors.length
  return avatarColors[idx]
}
