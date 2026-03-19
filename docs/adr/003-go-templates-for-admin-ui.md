# ADR-003: Go Templates for Admin UI (Super Admin Only)

**Status:** Accepted
**Date:** 2026-03-20
**Decision makers:** Product Owner, Software Architect, Security

## Context

Workived requires an internal admin dashboard for super admins (Workived team only) to:
- View system-wide statistics (total organizations, license distribution)
- Manage feature flags and system-wide configuration
- Monitor licenses and organization plans

Initial implementation added admin pages to the React SPA (`apps/web/src/routes/_app/admin/*`), protected by role-based access control checking for `super_admin` JWT role.

Before shipping, we identified a critical security concern: **mixing admin UI with user-facing code in the same bundle creates unnecessary attack surface**.

## Decision

Build the admin UI using **Go `html/template`** served directly from the backend.

**Remove all admin-related code from the React SPA.**

## Rationale

### Security: Physical Separation

**Problem with React admin:**
1. **Bundle exposure** — Admin code ships to every user's browser, even when routes are protected
2. **Attack surface** — Any XSS vulnerability could expose admin UI code/logic
3. **Accidental leakage** — Easy to import admin utilities in user-facing components
4. **Shared session state** — Same auth store, localStorage, cookies

**Go template solution:**
- Admin code **never touches the user-facing bundle**
- Admin UI served from separate route tree (e.g., `/admin/*` → HTML, not JSON)
- Physical isolation prevents accidental exposure
- Different authentication flow possible (separate session, IP whitelist, etc.)

### Architectural Simplicity

**React SPA admin requires:**
- Frontend UI code (`apps/web/src/routes/_app/admin/*`)
- API client (`apps/web/src/lib/api/admin.ts`)
- React Query hooks (`apps/web/src/lib/hooks/useAdmin.ts`)
- JSON API handlers (`services/internal/admin/handler.go` → JSON responses)
- Service layer (`services/internal/admin/service.go`)
- Repository layer (`services/internal/admin/repository.go`)

**Go template admin requires:**
- Go template handlers (`services/internal/admin/ui_handler.go` → HTML responses)
- Service layer (same)
- Repository layer (same)

**No need for:**
- JSON serialization/deserialization
- API type definitions
- Frontend state management
- Separate API client

### Internal Tool Appropriateness

The admin dashboard is:
- **Used by Workived team only** (not customers)
- **Low traffic** (handful of internal users, occasional access)
- **CRUD-heavy** (forms, tables, config updates — not highly interactive)

Go templates + minimal JS (htmx or Alpine.js) are **perfect for internal tools**:
- Fast to build
- Easy to maintain
- No build step complexity
- Direct data → HTML rendering

React/SPA is **overengineered** for this use case.

## Alternatives Considered

| Option | Verdict |
|--------|---------|
| React admin in SPA | Security risk + unnecessary complexity |
| Separate React app for admin | Still requires JSON API + build pipeline + deployment |
| Go templates + htmx | ✅ **Chosen** — secure, simple, appropriate for internal tool |
| Just use Swagger/API docs | Not user-friendly for non-technical team members |

## Implementation

### File Structure
```
services/
  internal/
    admin/
      service.go          # Business logic (unchanged)
      repository.go       # Database queries (unchanged)
      ui_handler.go       # NEW: HTML template rendering handlers
      templates/
        base.html         # Base layout
        dashboard.html    # System stats overview
        config.html       # Feature flags & config
        licenses.html     # License management
        orgs.html         # Organization list
      static/
        admin.css         # Minimal styling (Tailwind CDN)
```

### Routing
```go
// services/cmd/api/main.go
adminUI := r.Group("/admin")
adminUI.Use(middleware.RequireAuth())
adminUI.Use(middleware.RequireSuperAdmin())
{
    adminUI.GET("/", adminHandler.Dashboard)        // Renders HTML
    adminUI.GET("/config", adminHandler.Config)     // Renders HTML
    adminUI.POST("/config", adminHandler.UpdateConfig) // Form POST → redirect
    adminUI.GET("/licenses", adminHandler.Licenses)
    // ...
}
```

### Example Handler
```go
func (h *UIHandler) Dashboard(c *gin.Context) {
    stats, err := h.adminService.GetSystemStats(c.Request.Context())
    if err != nil {
        c.HTML(500, "error.html", gin.H{"error": err.Error()})
        return
    }
    
    c.HTML(200, "dashboard.html", gin.H{
        "stats": stats,
        "user": c.MustGet("user"),
    })
}
```

### Tech Stack
- **Templating:** Go `html/template`
- **Styling:** Tailwind CSS (CDN for simplicity)
- **Interactivity:** htmx (for AJAX form submissions, live updates)
- **Charts (optional):** Chart.js CDN

## Consequences

### Positive
- **Security:** Admin code physically separated from user-facing app
- **Simplicity:** No JSON API needed, direct data → HTML rendering
- **Maintainability:** Fewer layers, easier to debug
- **Deployment:** No separate admin frontend build/deploy
- **Performance:** No React hydration overhead for simple pages

### Negative
- **Limited interactivity:** Not suitable for highly dynamic UIs (but admin pages are mostly CRUD)
- **Two frontend paradigms:** React for user app, Go templates for admin (acceptable tradeoff for security)
- **Less familiar:** Team more comfortable with React (but Go templates are simpler)

### Migration Required
- **Remove:** `apps/web/src/routes/_app/admin/*`
- **Remove:** `apps/web/src/lib/api/admin.ts`
- **Remove:** `apps/web/src/lib/hooks/useAdmin.ts`
- **Remove:** Admin link from React settings menu
- **Add:** `services/internal/admin/ui_handler.go`
- **Add:** `services/internal/admin/templates/`

## Security Notes

1. **Authentication:** Admin routes MUST use `RequireSuperAdmin()` middleware
2. **CSRF protection:** Forms MUST include CSRF tokens (Gin middleware available)
3. **Content-Security-Policy:** Admin pages should have strict CSP headers
4. **IP whitelist (optional):** Can restrict `/admin/*` to VPN/office IPs
5. **Audit logging:** All admin actions MUST be logged to `audit_logs` table

## Future Considerations

- If admin UI complexity grows significantly (unlikely), can migrate to separate React app with isolated deployment
- For now, Go templates are the right tool for the job
