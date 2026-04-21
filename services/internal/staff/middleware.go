package staff

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/workived/services/pkg/apperr"
)

// Auth is middleware that validates staff admin JWT tokens.
func Auth(jwtSecret string, repo *Repository) gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader("Authorization")
		if header == "" || !strings.HasPrefix(header, "Bearer ") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, apperr.Response(apperr.Unauthorized()))
			return
		}

		tokenStr := strings.TrimPrefix(header, "Bearer ")
		claims := &Claims{}

		token, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (any, error) {
			if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, apperr.Unauthorized()
			}
			return []byte(jwtSecret), nil
		})
		if err != nil || !token.Valid {
			c.AbortWithStatusJSON(http.StatusUnauthorized, apperr.Response(apperr.Unauthorized()))
			return
		}

		// Verify this is a staff admin token
		if claims.InternalAdminID == uuid.Nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, apperr.Response(apperr.Unauthorized()))
			return
		}

		// Verify admin is still active in database
		if !repo.IsActive(c.Request.Context(), claims.InternalAdminID) {
			c.AbortWithStatusJSON(http.StatusForbidden, apperr.Response(apperr.Forbidden()))
			return
		}

		// Store admin ID in context
		c.Set("staff_admin_id", claims.InternalAdminID)
		c.Next()
	}
}

// AdminIDFromCtx returns the authenticated staff admin's ID from context.
func AdminIDFromCtx(c *gin.Context) uuid.UUID {
	v, _ := c.Get("staff_admin_id")
	id, _ := v.(uuid.UUID)
	return id
}
