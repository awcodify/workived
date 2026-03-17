package main

import (
	_ "embed"
	"net/http"

	"github.com/gin-gonic/gin"
)

//go:embed openapi.yaml
var openapiSpec []byte

// registerDocsRoutes mounts two endpoints:
//
//	GET /docs              → Scalar UI (modern API explorer)
//	GET /docs/openapi.yaml → raw OpenAPI 3.1 spec
func registerDocsRoutes(r *gin.Engine) {
	r.GET("/docs", serveScalarUI)
	r.GET("/docs/openapi.yaml", serveOpenAPISpec)
}

func serveOpenAPISpec(c *gin.Context) {
	c.Data(http.StatusOK, "application/yaml; charset=utf-8", openapiSpec)
}

func serveScalarUI(c *gin.Context) {
	c.Header("Content-Type", "text/html; charset=utf-8")
	c.String(http.StatusOK, scalarHTML)
}

const scalarHTML = `<!doctype html>
<html>
  <head>
    <title>Workived API Reference</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>body { margin: 0; }</style>
  </head>
  <body>
    <script
      id="api-reference"
      data-url="/docs/openapi.yaml"
      data-configuration='{"theme":"purple","layout":"modern"}'></script>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
  </body>
</html>`
