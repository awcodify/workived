package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/workived/services/pkg/apperr"
)

const (
	userIDKey = "user_id"
	orgIDKey  = "org_id"
)

type Claims struct {
	jwt.RegisteredClaims
	UserID uuid.UUID `json:"uid"`
	OrgID  uuid.UUID `json:"oid"`
	Role   string    `json:"role"`
}

func Auth(jwtSecret string) gin.HandlerFunc {
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

		c.Set(userIDKey, claims.UserID)
		c.Set(orgIDKey, claims.OrgID)
		c.Set("role", claims.Role)
		c.Next()
	}
}

// UserIDFromCtx returns the authenticated user's ID from context.
func UserIDFromCtx(c *gin.Context) uuid.UUID {
	v, _ := c.Get(userIDKey)
	id, _ := v.(uuid.UUID)
	return id
}

// OrgIDFromCtx returns the organisation ID extracted from the JWT — never from request body.
func OrgIDFromCtx(c *gin.Context) uuid.UUID {
	v, _ := c.Get(orgIDKey)
	id, _ := v.(uuid.UUID)
	return id
}

// RoleFromCtx returns the member's role in the current org.
func RoleFromCtx(c *gin.Context) string {
	v, _ := c.Get("role")
	role, _ := v.(string)
	return role
}
