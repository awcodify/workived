package dashboard

import (
	"fmt"
	"strings"
)

// ── Field definition ──────────────────────────────────────────────────────────

// SourceField describes a queryable field in a data source.
type SourceField struct {
	SQLExpr    string // e.g. "t.title", "tl.name", or a subquery
	Type       string // "text", "number", "timestamp", "date", "boolean", "uuid"
	Aggregable bool   // can be SUM'd, AVG'd, etc.
	Groupable  bool   // can appear in GROUP BY
	Sortable   bool
}

// Source describes a registered data source.
type Source struct {
	BaseTable string            // e.g. "tasks t"
	Joins     []string          // additional JOINs always applied
	Fields    map[string]SourceField
	OrgIDCol  string // e.g. "t.organisation_id"
}

// ── Source registry ───────────────────────────────────────────────────────────

var sources = map[string]Source{
	"tasks": {
		BaseTable: "tasks t",
		Joins: []string{
			"LEFT JOIN task_lists tl ON tl.id = t.task_list_id",
			"LEFT JOIN employees e ON e.id = t.assignee_id",
		},
		OrgIDCol: "t.organisation_id",
		Fields: map[string]SourceField{
			"title":          {SQLExpr: "t.title", Type: "text", Groupable: true, Sortable: true},
			"status":         {SQLExpr: "tl.name", Type: "text", Groupable: true, Sortable: true},
			"assignee_id":    {SQLExpr: "t.assignee_id", Type: "uuid", Groupable: true, Sortable: false},
			"assignee_name":  {SQLExpr: "e.full_name", Type: "text", Groupable: true, Sortable: true},
			"due_date":       {SQLExpr: "t.due_date", Type: "date", Groupable: false, Sortable: true},
			"priority":       {SQLExpr: "t.priority", Type: "text", Groupable: true, Sortable: true},
			"created_at":     {SQLExpr: "t.created_at", Type: "timestamp", Groupable: false, Sortable: true},
			"completed_at":   {SQLExpr: "t.completed_at", Type: "timestamp", Groupable: false, Sortable: true},
			"is_completed":   {SQLExpr: "(t.completed_at IS NOT NULL)", Type: "boolean", Groupable: true, Sortable: false},
			"list_name":      {SQLExpr: "tl.name", Type: "text", Groupable: true, Sortable: true},
		},
	},
}

// GetSource returns the source definition, or false if not registered.
func GetSource(name string) (Source, bool) {
	s, ok := sources[name]
	return s, ok
}

// ── Custom field resolution ───────────────────────────────────────────────────

const customFieldPrefix = "field:"

// IsCustomField returns true if the field key is a custom field reference.
func IsCustomField(key string) bool {
	return strings.HasPrefix(key, customFieldPrefix)
}

// CustomFieldID extracts the UUID string from "field:UUID".
func CustomFieldID(key string) string {
	return strings.TrimPrefix(key, customFieldPrefix)
}

// CustomFieldExpr builds a scalar subquery for a custom field value.
// fieldType determines which storage column to read.
func CustomFieldExpr(fieldID, fieldType string) string {
	col := fieldTypeToColumn(fieldType)
	return fmt.Sprintf(
		`(SELECT %s FROM task_field_values WHERE task_id = t.id AND field_id = '%s' AND organisation_id = $1 LIMIT 1)`,
		col, fieldID,
	)
}

func fieldTypeToColumn(ft string) string {
	switch ft {
	case "number", "rating":
		return "value_number"
	case "date":
		return "value_date"
	case "boolean":
		return "value_boolean"
	case "select", "multi_select", "employee":
		return "value_json"
	default: // text, url
		return "value_text"
	}
}

// CustomFieldSourceField builds a SourceField for a custom field.
func CustomFieldSourceField(fieldType string) SourceField {
	var ft string
	var agg bool
	switch fieldType {
	case "number", "rating":
		ft = "number"
		agg = true
	case "date":
		ft = "date"
		agg = false
	case "boolean":
		ft = "boolean"
		agg = false
	default:
		ft = "text"
		agg = false
	}
	return SourceField{Type: ft, Aggregable: agg, Groupable: true, Sortable: true}
}
