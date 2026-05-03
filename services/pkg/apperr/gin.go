package apperr

import "github.com/gin-gonic/gin"

// Respond writes the JSON error response and stores the raw error in the gin
// context so middleware (e.g. TelegramAlert) can read the actual error message
// rather than the sanitized client-facing text.
func Respond(c *gin.Context, err error) {
	_ = c.Error(err)
	c.JSON(HTTPStatus(err), Response(err))
}
