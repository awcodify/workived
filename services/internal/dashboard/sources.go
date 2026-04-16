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
	BaseTable   string            // e.g. "tasks t"
	Joins       []string          // additional JOINs always applied
	Fields      map[string]SourceField
	OrgIDCol    string   // e.g. "t.organisation_id"
	DateCol     string   // default date column for date_range filtering and date_bucket
	BaseFilters []string // extra AND conditions always appended (e.g. "e.is_active = TRUE")
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
		DateCol:  "t.created_at",
		Fields: map[string]SourceField{
			"title":         {SQLExpr: "t.title", Type: "text", Groupable: true, Sortable: true},
			"status":        {SQLExpr: "tl.name", Type: "text", Groupable: true, Sortable: true},
			"assignee_id":   {SQLExpr: "t.assignee_id", Type: "uuid", Groupable: true, Sortable: false},
			"assignee_name": {SQLExpr: "e.full_name", Type: "text", Groupable: true, Sortable: true},
			"due_date":      {SQLExpr: "t.due_date", Type: "date", Groupable: false, Sortable: true},
			"priority":      {SQLExpr: "t.priority", Type: "text", Groupable: true, Sortable: true},
			"created_at":    {SQLExpr: "t.created_at", Type: "timestamp", Groupable: false, Sortable: true},
			"completed_at":  {SQLExpr: "t.completed_at", Type: "timestamp", Groupable: false, Sortable: true},
			"is_completed":  {SQLExpr: "(t.completed_at IS NOT NULL)", Type: "boolean", Groupable: true, Sortable: false},
			"list_name":     {SQLExpr: "tl.name", Type: "text", Groupable: true, Sortable: true},
		},
	},

	"attendance": {
		BaseTable: "attendance_records ar",
		Joins: []string{
			"JOIN employees e ON e.id = ar.employee_id",
			"LEFT JOIN departments d ON d.id = e.department_id",
		},
		OrgIDCol: "ar.organisation_id",
		DateCol:  "ar.date",
		Fields: map[string]SourceField{
			"employee_id":        {SQLExpr: "ar.employee_id", Type: "uuid", Groupable: true, Sortable: false},
			"employee_name":      {SQLExpr: "e.full_name", Type: "text", Groupable: true, Sortable: true},
			"date":               {SQLExpr: "ar.date", Type: "date", Groupable: false, Sortable: true},
			"clock_in_at":        {SQLExpr: "ar.clock_in_at", Type: "timestamp", Groupable: false, Sortable: true},
			"clock_out_at":       {SQLExpr: "ar.clock_out_at", Type: "timestamp", Groupable: false, Sortable: true},
			"is_late":            {SQLExpr: "ar.is_late", Type: "boolean", Groupable: true, Sortable: false},
			"work_location_type": {SQLExpr: "ar.work_location_type", Type: "text", Groupable: true, Sortable: true},
			"department_id":      {SQLExpr: "e.department_id", Type: "uuid", Groupable: true, Sortable: false},
			"department_name":    {SQLExpr: "d.name", Type: "text", Groupable: true, Sortable: true},
			"hours_worked":       {SQLExpr: "EXTRACT(EPOCH FROM (ar.clock_out_at - ar.clock_in_at))/3600", Type: "number", Aggregable: true, Groupable: false, Sortable: true},
			"status": {
				SQLExpr:   "CASE WHEN ar.is_late THEN 'late' WHEN ar.clock_in_at IS NOT NULL THEN 'present' ELSE 'absent' END",
				Type:      "text",
				Groupable: true,
				Sortable:  false,
			},
		},
	},

	"leave": {
		BaseTable: "leave_requests lr",
		Joins: []string{
			"JOIN employees e ON e.id = lr.employee_id",
			"JOIN leave_policies lp ON lp.id = lr.leave_policy_id",
		},
		OrgIDCol: "lr.organisation_id",
		DateCol:  "lr.created_at",
		Fields: map[string]SourceField{
			"employee_id":   {SQLExpr: "lr.employee_id", Type: "uuid", Groupable: true, Sortable: false},
			"employee_name": {SQLExpr: "e.full_name", Type: "text", Groupable: true, Sortable: true},
			"leave_type":    {SQLExpr: "lp.name", Type: "text", Groupable: true, Sortable: true},
			"start_date":    {SQLExpr: "lr.start_date", Type: "date", Groupable: false, Sortable: true},
			"end_date":      {SQLExpr: "lr.end_date", Type: "date", Groupable: false, Sortable: true},
			"total_days":    {SQLExpr: "lr.total_days", Type: "number", Aggregable: true, Groupable: false, Sortable: true},
			"status":        {SQLExpr: "lr.status", Type: "text", Groupable: true, Sortable: true},
			"department_id": {SQLExpr: "e.department_id", Type: "uuid", Groupable: true, Sortable: false},
			"created_at":    {SQLExpr: "lr.created_at", Type: "timestamp", Groupable: false, Sortable: true},
		},
	},

	"employees": {
		BaseTable: "employees e",
		Joins: []string{
			"LEFT JOIN departments d ON d.id = e.department_id",
		},
		OrgIDCol:    "e.organisation_id",
		DateCol:     "e.created_at",
		BaseFilters: []string{"e.is_active = TRUE"},
		Fields: map[string]SourceField{
			"full_name":       {SQLExpr: "e.full_name", Type: "text", Groupable: true, Sortable: true},
			"email":           {SQLExpr: "e.email", Type: "text", Groupable: true, Sortable: true},
			"job_title":       {SQLExpr: "e.job_title", Type: "text", Groupable: true, Sortable: true},
			"employment_type": {SQLExpr: "e.employment_type", Type: "text", Groupable: true, Sortable: true},
			"status":          {SQLExpr: "e.status", Type: "text", Groupable: true, Sortable: true},
			"department_name": {SQLExpr: "d.name", Type: "text", Groupable: true, Sortable: true},
			"department_id":   {SQLExpr: "e.department_id", Type: "uuid", Groupable: true, Sortable: false},
			"gender":          {SQLExpr: "e.gender", Type: "text", Groupable: true, Sortable: true},
			"start_date":      {SQLExpr: "e.start_date", Type: "date", Groupable: false, Sortable: true},
			"created_at":      {SQLExpr: "e.created_at", Type: "timestamp", Groupable: false, Sortable: true},
		},
	},

	"claims": {
		BaseTable: "claims c",
		Joins: []string{
			"JOIN employees e ON e.id = c.employee_id",
			"JOIN claim_categories cc ON cc.id = c.category_id",
		},
		OrgIDCol: "c.organisation_id",
		DateCol:  "c.created_at",
		Fields: map[string]SourceField{
			"employee_id":   {SQLExpr: "c.employee_id", Type: "uuid", Groupable: true, Sortable: false},
			"employee_name": {SQLExpr: "e.full_name", Type: "text", Groupable: true, Sortable: true},
			"category_name": {SQLExpr: "cc.name", Type: "text", Groupable: true, Sortable: true},
			"amount":        {SQLExpr: "c.amount", Type: "number", Aggregable: true, Groupable: false, Sortable: true},
			"currency_code": {SQLExpr: "c.currency_code", Type: "text", Groupable: true, Sortable: true},
			"status":        {SQLExpr: "c.status", Type: "text", Groupable: true, Sortable: true},
			"submitted_at":  {SQLExpr: "c.created_at", Type: "timestamp", Groupable: false, Sortable: true},
			"claim_date":    {SQLExpr: "c.claim_date", Type: "date", Groupable: false, Sortable: true},
			"department_id": {SQLExpr: "e.department_id", Type: "uuid", Groupable: true, Sortable: false},
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
