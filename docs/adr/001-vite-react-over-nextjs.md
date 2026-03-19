# ADR-001: Vite + React over Next.js for Dashboard Frontend

**Status:** Accepted
**Date:** 2026-03-18
**Decision makers:** Product Owner, Software Architect

## Context

Workived needs a frontend for the dashboard application (employee management, attendance, leave, claims, tasks). The original plan specified Next.js 14 (App Router). Before implementation, we reassessed whether Next.js is the right tool.

## Decision

Use **Vite 8 + React 19 + TanStack Router** as a pure SPA instead of Next.js.

The marketing/landing page will be a **separate app** using **Astro** (SSG) for SEO.

## Rationale

### Next.js is overengineered for this use case

The Workived dashboard is an authenticated admin app. Every page is behind a JWT wall. There is:
- No public content to index (no SEO requirement)
- No server-side rendering requirement
- No static site generation requirement
- No edge middleware requirement

Next.js's value proposition (SSR, SSG, ISR, server components, edge functions) is unused. We'd pay the complexity tax for features we never touch.

### Ethical concern

Vercel (Next.js's parent company) has corporate ties that conflict with the founder's values. Vite is community-driven (created by Evan You, MIT licensed).

### Vite + React advantages

1. **Simpler architecture.** Pure SPA — no server runtime, no hydration, no server components.
2. **Simpler deployment.** `vite build` produces a static `dist/` folder. Serve from any CDN, S3, Nginx, or even embedded in the Go binary via `go:embed`. No Node.js server in production.
3. **Faster development.** Vite's HMR is near-instant. No Next.js compilation overhead.
4. **Full React ecosystem.** shadcn/ui, TanStack Query, Zustand, React Hook Form — all work identically without Next.js.

### TanStack Router over React Router

- Fully type-safe route params and search params
- File-based routing via Vite plugin
- Built by the same team as TanStack Query — designed to work together

### Separate landing page (Astro)

The landing page and dashboard have opposite requirements:
- Landing: SEO-critical, static content, anonymous visitors
- Dashboard: no SEO, dynamic data, authenticated users

Mixing them into one codebase means marketing copy changes trigger app CI/CD, and SPA routing fights with static page routing. Separate apps deploy independently.

## Alternatives considered

| Option | Verdict |
|--------|---------|
| Next.js 16 | Overengineered + ethical concern |
| Remix / React Router v7 | Server-focused (loaders/actions) — we have a Go backend |
| Vue 3 + Vite | Loses React ecosystem (shadcn/ui, TanStack Query, React Hook Form) |
| Astro (for dashboard) | Designed for content sites, not highly interactive SPAs |

## Consequences

### Positive
- Simpler mental model (just a React app with a router)
- Faster builds and dev server
- Framework-agnostic deployment (static files)
- No corporate dependency concern

### Negative
- If we ever need SSR (unlikely for an admin dashboard), we'd need to add it manually or migrate
- TanStack Router has a smaller community than React Router (but is mature and stable)
- CLAUDE.md and project brief needed updating (one-time cost, done)

### Neutral
- Design system, component patterns, testing approach all carry over unchanged
- Vitest replaces Jest (same API, Vite-native — zero config overhead)

## Implementation

```
apps/web/           -> Vite + React 19 + TanStack Router (dashboard SPA)
apps/landing/       -> Astro (marketing site, future Sprint 7)
design/tokens.ts    -> Shared design tokens (imported by both apps)
```
