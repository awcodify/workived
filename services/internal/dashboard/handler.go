package dashboard

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rs/zerolog"
	"github.com/workived/services/internal/platform/middleware"
	"github.com/workived/services/pkg/apperr"
)

type Handler struct {
	service ServiceInterface
	log     zerolog.Logger
}

func NewHandler(service ServiceInterface, log zerolog.Logger) *Handler {
	return &Handler{service: service, log: log.With().Str("component", "dashboard.handler").Logger()}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	d := rg.Group("/dashboards")
	d.Use(middleware.Require(middleware.PermReportsRead))

	d.GET("", h.ListDashboards)
	d.POST("", h.CreateDashboard)
	d.PUT("/:id", h.UpdateDashboard)
	d.DELETE("/:id", h.DeleteDashboard)

	d.GET("/:id/widgets", h.ListWidgets)
	d.POST("/:id/widgets", h.CreateWidget)
	d.PUT("/:id/widgets/:wid", h.UpdateWidget)
	d.DELETE("/:id/widgets/:wid", h.DeleteWidget)

	d.POST("/query", h.ExecuteQuery)
}

// ── Dashboard handlers ────────────────────────────────────────────────────────

func (h *Handler) ListDashboards(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)

	dashboards, err := h.service.ListDashboards(c.Request.Context(), orgID)
	if err != nil {
		h.logAndRespondError(c, err, "list dashboards", map[string]string{"org_id": orgID.String()})
		return
	}
	if dashboards == nil {
		dashboards = []Dashboard{}
	}
	c.JSON(http.StatusOK, gin.H{"data": dashboards})
}

func (h *Handler) CreateDashboard(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)
	userID := middleware.UserIDFromCtx(c)

	var input CreateDashboardInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, apperr.Response(apperr.New(apperr.CodeValidation, err.Error())))
		return
	}

	d, err := h.service.CreateDashboard(c.Request.Context(), orgID, userID, input)
	if err != nil {
		h.logAndRespondError(c, err, "create dashboard", map[string]string{"org_id": orgID.String()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": d})
}

func (h *Handler) UpdateDashboard(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, apperr.Response(apperr.New(apperr.CodeValidation, "invalid dashboard id")))
		return
	}

	var input UpdateDashboardInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, apperr.Response(apperr.New(apperr.CodeValidation, err.Error())))
		return
	}

	d, err := h.service.UpdateDashboard(c.Request.Context(), orgID, id, input)
	if err != nil {
		h.logAndRespondError(c, err, "update dashboard", map[string]string{"org_id": orgID.String(), "dashboard_id": id.String()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": d})
}

func (h *Handler) DeleteDashboard(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, apperr.Response(apperr.New(apperr.CodeValidation, "invalid dashboard id")))
		return
	}

	if err := h.service.DeleteDashboard(c.Request.Context(), orgID, id); err != nil {
		h.logAndRespondError(c, err, "delete dashboard", map[string]string{"org_id": orgID.String(), "dashboard_id": id.String()})
		return
	}
	c.JSON(http.StatusNoContent, nil)
}

// ── Widget handlers ───────────────────────────────────────────────────────────

func (h *Handler) ListWidgets(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)
	dashID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, apperr.Response(apperr.New(apperr.CodeValidation, "invalid dashboard id")))
		return
	}

	widgets, err := h.service.ListWidgets(c.Request.Context(), orgID, dashID)
	if err != nil {
		h.logAndRespondError(c, err, "list widgets", map[string]string{"org_id": orgID.String(), "dashboard_id": dashID.String()})
		return
	}
	if widgets == nil {
		widgets = []Widget{}
	}
	c.JSON(http.StatusOK, gin.H{"data": widgets})
}

func (h *Handler) CreateWidget(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)
	dashID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, apperr.Response(apperr.New(apperr.CodeValidation, "invalid dashboard id")))
		return
	}

	var input CreateWidgetInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, apperr.Response(apperr.New(apperr.CodeValidation, err.Error())))
		return
	}

	w, err := h.service.CreateWidget(c.Request.Context(), orgID, dashID, input)
	if err != nil {
		h.logAndRespondError(c, err, "create widget", map[string]string{"org_id": orgID.String(), "dashboard_id": dashID.String()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": w})
}

func (h *Handler) UpdateWidget(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)
	dashID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, apperr.Response(apperr.New(apperr.CodeValidation, "invalid dashboard id")))
		return
	}
	widgetID, err := uuid.Parse(c.Param("wid"))
	if err != nil {
		c.JSON(http.StatusBadRequest, apperr.Response(apperr.New(apperr.CodeValidation, "invalid widget id")))
		return
	}

	var input UpdateWidgetInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, apperr.Response(apperr.New(apperr.CodeValidation, err.Error())))
		return
	}

	w, err := h.service.UpdateWidget(c.Request.Context(), orgID, dashID, widgetID, input)
	if err != nil {
		h.logAndRespondError(c, err, "update widget", map[string]string{"org_id": orgID.String(), "widget_id": widgetID.String()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": w})
}

func (h *Handler) DeleteWidget(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)
	dashID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, apperr.Response(apperr.New(apperr.CodeValidation, "invalid dashboard id")))
		return
	}
	widgetID, err := uuid.Parse(c.Param("wid"))
	if err != nil {
		c.JSON(http.StatusBadRequest, apperr.Response(apperr.New(apperr.CodeValidation, "invalid widget id")))
		return
	}

	if err := h.service.DeleteWidget(c.Request.Context(), orgID, dashID, widgetID); err != nil {
		h.logAndRespondError(c, err, "delete widget", map[string]string{"org_id": orgID.String(), "widget_id": widgetID.String()})
		return
	}
	c.JSON(http.StatusNoContent, nil)
}

// ── Query handler ─────────────────────────────────────────────────────────────

func (h *Handler) ExecuteQuery(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)
	orgTimezone := "UTC"
	if m := middleware.OrgMemberFromCtx(c); m != nil {
		orgTimezone = m.OrgTimezone
	}

	var input ExecuteQueryInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, apperr.Response(apperr.New(apperr.CodeValidation, err.Error())))
		return
	}

	result, err := h.service.ExecuteQuery(c.Request.Context(), orgID, input, orgTimezone)
	if err != nil {
		h.logAndRespondError(c, err, "execute query", map[string]string{"org_id": orgID.String(), "source": input.QueryConfig.Source})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": result})
}

// ── Error helper ──────────────────────────────────────────────────────────────

func (h *Handler) logAndRespondError(c *gin.Context, err error, msg string, fields map[string]string) {
	event := h.log.Error().Err(err)
	for k, v := range fields {
		event = event.Str(k, v)
	}
	event.Msg(msg)
	apperr.Respond(c, err)
}
