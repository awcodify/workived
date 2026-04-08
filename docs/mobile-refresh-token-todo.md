# Mobile Authentication - Refresh Token Issue

## Problem

The backend currently sends `refresh_token` via httpOnly cookie, which doesn't work for mobile apps (React Native/Expo). Mobile apps cannot access httpOnly cookies.

## Current Backend Behavior

```go
// services/internal/auth/handler.go
func (h *Handler) Login(c *gin.Context) {
    // ...
    resp, refreshToken, err := h.service.Login(c.Request.Context(), req)
    
    // Refresh token in httpOnly cookie - DOESN'T WORK FOR MOBILE
    c.SetCookie("refresh_token", refreshToken, 30*24*3600, "/", "", true, true)
    
    // Only access_token and user in response body
    c.JSON(http.StatusOK, gin.H{"data": resp})
}
```

## Solution Options

### Option 1: Return refresh_token in response for mobile clients (Recommended)

Detect mobile clients via User-Agent or custom header and include refresh_token in JSON response:

```go
func (h *Handler) Login(c *gin.Context) {
    // ...
    resp, refreshToken, err := h.service.Login(c.Request.Context(), req)
    
    // Always set cookie for web clients
    c.SetCookie("refresh_token", refreshToken, 30*24*3600, "/", "", true, true)
    
    // Check if mobile client
    userAgent := c.GetHeader("User-Agent")
    isMobile := strings.Contains(userAgent, "Expo") || 
                c.GetHeader("X-Client-Type") == "mobile"
    
    if isMobile {
        // Include refresh_token in response for mobile
        c.JSON(http.StatusOK, gin.H{
            "data": gin.H{
                "access_token":  resp.AccessToken,
                "refresh_token": refreshToken,  // Add this
                "user":          resp.User,
            },
        })
    } else {
        // Web clients get it from cookie only
        c.JSON(http.StatusOK, gin.H{"data": resp})
    }
}
```

### Option 2: Separate mobile endpoint

Create `/api/v1/auth/mobile/login` that returns refresh_token in body.

### Option 3: Use authorization code flow

More complex but more secure - use OAuth2-style authorization code flow.

## Temporary Mobile Workaround

Currently, the mobile app:
- Stores `access_token` successfully
- Skips `refresh_token` storage if not present
- Will need manual re-login when access_token expires

## TODO

- [ ] Update backend to support mobile refresh tokens (Option 1 recommended)
- [ ] Test refresh flow on mobile after backend update
- [ ] Update mobile app to handle token refresh
- [ ] Add refresh token tests

## Files Modified (Mobile)

- `apps/mobile/src/types/api.ts` - Made `refresh_token` optional
- `apps/mobile/src/contexts/AuthContext.tsx` - Conditional refresh_token storage
- `apps/mobile/src/api/client.ts` - Unwrap `{ data: ... }` response wrapper

## Files to Modify (Backend - Future)

- `services/internal/auth/handler.go` - Add mobile client detection + response
- `services/internal/auth/types.go` - Potentially update LoginResponse
- `services/internal/auth/handler_test.go` - Add mobile client tests
