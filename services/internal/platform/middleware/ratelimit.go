package middleware

import (
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"github.com/workived/services/pkg/apperr"
)

// RateLimiter limits requests per org per minute using a Redis sliding counter.
func RateLimiter(rdb *redis.Client, maxPerMinute int) gin.HandlerFunc {
	return func(c *gin.Context) {
		orgID := OrgIDFromCtx(c)
		key := fmt.Sprintf("rl:org:%s:%d", orgID, time.Now().Unix()/60)

		count, err := rdb.Incr(c.Request.Context(), key).Result()
		if err != nil {
			// Fail open — don't block requests on Redis outage.
			c.Next()
			return
		}
		if count == 1 {
			rdb.Expire(c.Request.Context(), key, 2*time.Minute)
		}
		if int(count) > maxPerMinute {
			c.AbortWithStatusJSON(http.StatusTooManyRequests,
				apperr.Response(apperr.New("RATE_LIMIT_EXCEEDED", "too many requests")))
			return
		}
		c.Next()
	}
}
