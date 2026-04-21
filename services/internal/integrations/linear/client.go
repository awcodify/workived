package linear

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

const (
	DefaultAPIURL = "https://api.linear.app/graphql"
)

// Client is a Linear GraphQL API client
type Client struct {
	apiURL         string
	apiKey         string
	httpClient     *http.Client
	downloadClient *http.Client // Separate client for downloads with longer timeout
}

// Config holds configuration for the Linear client
type Config struct {
	APIKey string
	APIURL string // Optional, defaults to Linear's API
}

// NewClient creates a new Linear API client
func NewClient(cfg Config) *Client {
	apiURL := cfg.APIURL
	if apiURL == "" {
		apiURL = DefaultAPIURL
	}

	return &Client{
		apiURL: apiURL,
		apiKey: cfg.APIKey,
		httpClient: &http.Client{
			Timeout: 2 * time.Minute, // Increased from 30s for large queries
		},
		downloadClient: &http.Client{
			Timeout: 5 * time.Minute, // Long timeout for downloading large images
		},
	}
}

// graphQLRequest represents a GraphQL request
type graphQLRequest struct {
	Query     string                 `json:"query"`
	Variables map[string]interface{} `json:"variables,omitempty"`
}

// graphQLResponse represents a GraphQL response
type graphQLResponse struct {
	Data   json.RawMessage `json:"data"`
	Errors []struct {
		Message string `json:"message"`
		Path    []any  `json:"path"`
	} `json:"errors"`
}

// doRequest executes a GraphQL request
func (c *Client) doRequest(ctx context.Context, query string, variables map[string]interface{}, result interface{}) error {
	reqBody := graphQLRequest{
		Query:     query,
		Variables: variables,
	}

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return fmt.Errorf("marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", c.apiURL, bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", c.apiKey)

	// Debug logging for auth issues
	keyLen := len(c.apiKey)
	if keyLen > 0 {
		// Log first 4 chars to verify key is being used
		keyPrefix := c.apiKey
		if keyLen > 4 {
			keyPrefix = c.apiKey[:4]
		}
		fmt.Printf("[DEBUG] Linear API request with key prefix: %s (length: %d)\n", keyPrefix, keyLen)
	} else {
		fmt.Printf("[DEBUG] Linear API request with EMPTY API KEY\n")
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("execute request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("linear api error: status=%d body=%s", resp.StatusCode, string(body))
	}

	var gqlResp graphQLResponse
	if err := json.Unmarshal(body, &gqlResp); err != nil {
		return fmt.Errorf("unmarshal response: %w", err)
	}

	if len(gqlResp.Errors) > 0 {
		return fmt.Errorf("graphql errors: %+v", gqlResp.Errors)
	}

	if err := json.Unmarshal(gqlResp.Data, result); err != nil {
		return fmt.Errorf("unmarshal data: %w", err)
	}

	return nil
}

// Issue represents a Linear issue
type Issue struct {
	ID               string     `json:"id"`
	Identifier       string     `json:"identifier"` // e.g., "WOR-123"
	Title            string     `json:"title"`
	Description      string     `json:"description"`      // Plain text version (fallback)
	DescriptionState string     `json:"descriptionState"` // ProseMirror JSON document (rich format)
	Priority         int        `json:"priority"`         // 0=None, 1=Urgent, 2=High, 3=Normal, 4=Low
	DueDate          *time.Time `json:"dueDate"`
	CreatedAt        time.Time  `json:"createdAt"`
	UpdatedAt        time.Time  `json:"updatedAt"`
	CompletedAt      *time.Time `json:"completedAt"`
	State            State      `json:"state"`
	Assignee         *User      `json:"assignee"`
	Creator          User       `json:"creator"`
	Team             Team       `json:"team"`
	Project          *Project   `json:"project"`
	Labels           struct {
		Nodes []Label `json:"nodes"`
	} `json:"labels"`
	Comments    Comments `json:"comments"`
	Attachments struct {
		Nodes []Attachment `json:"nodes"`
	} `json:"attachments"`
}

// State represents a Linear workflow state
type State struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Type string `json:"type"` // backlog, unstarted, started, completed, canceled
}

// User represents a Linear user
type User struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	Email  string `json:"email"`
	Active bool   `json:"active"`
}

// Team represents a Linear team
type Team struct {
	ID   string `json:"id"`
	Key  string `json:"key"`
	Name string `json:"name"`
}

// Project represents a Linear project
type Project struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Slug string `json:"slugId"`
}

// Label represents a Linear label
type Label struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// Comment represents a Linear comment
type Comment struct {
	ID        string    `json:"id"`
	Body      string    `json:"body"`     // Plain text version (fallback)
	BodyData  string    `json:"bodyData"` // ProseMirror JSON document (rich format)
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
	User      User      `json:"user"`
	Parent    *Comment  `json:"parent"`
}

// Comments represents paginated comments
type Comments struct {
	Nodes    []Comment `json:"nodes"`
	PageInfo PageInfo  `json:"pageInfo"`
}

// Attachment represents a Linear attachment
type Attachment struct {
	ID       string `json:"id"`
	Title    string `json:"title"`
	URL      string `json:"url"`
	Metadata struct {
		Size int    `json:"size"`
		Type string `json:"contentType"`
	} `json:"metadata"`
}

// PageInfo represents pagination information
type PageInfo struct {
	HasNextPage bool   `json:"hasNextPage"`
	EndCursor   string `json:"endCursor"`
}

// IssuesResponse represents the response from the issues query
type IssuesResponse struct {
	Issues struct {
		Nodes    []Issue  `json:"nodes"`
		PageInfo PageInfo `json:"pageInfo"`
	} `json:"issues"`
}

// FetchIssuesParams contains parameters for fetching issues
type FetchIssuesParams struct {
	TeamID          *string
	ProjectID       *string
	StateFilter     []string
	AssigneeFilter  *string
	DateFrom        *time.Time
	DateTo          *time.Time
	IncludeComments bool
	Cursor          *string
	Limit           int
}

// FetchIssues fetches issues from Linear with the given filters
func (c *Client) FetchIssues(ctx context.Context, params FetchIssuesParams) (*IssuesResponse, error) {
	if params.Limit == 0 {
		params.Limit = 50 // Default
	}

	query := `
		query($filter: IssueFilter, $first: Int, $after: String) {
			issues(filter: $filter, first: $first, after: $after, orderBy: createdAt) {
				nodes {
					id
					identifier
					title
					description
					descriptionState
					priority
					dueDate
					createdAt
					updatedAt
					completedAt
					state {
						id
						name
						type
					}
					assignee {
						id
						name
						email
						active
					}
					creator {
						id
						name
						email
						active
					}
					team {
						id
						key
						name
					}
					project {
						id
						name
						slugId
					}
					labels {
						nodes {
							id
							name
						}
					}
					attachments {
						nodes {
							id
							title
							url
							metadata
						}
					}
					` + c.commentsFragment(params.IncludeComments) + `
				}
				pageInfo {
					hasNextPage
					endCursor
				}
			}
		}
	`

	// Build filter
	filter := make(map[string]interface{})
	if params.TeamID != nil {
		filter["team"] = map[string]interface{}{"id": map[string]interface{}{"eq": *params.TeamID}}
	}
	if params.ProjectID != nil {
		filter["project"] = map[string]interface{}{"id": map[string]interface{}{"eq": *params.ProjectID}}
	}
	if len(params.StateFilter) > 0 {
		filter["state"] = map[string]interface{}{
			"type": map[string]interface{}{
				"in": params.StateFilter,
			},
		}
	}
	if params.AssigneeFilter != nil {
		filter["assignee"] = map[string]interface{}{"id": map[string]interface{}{"eq": *params.AssigneeFilter}}
	}
	if params.DateFrom != nil {
		filter["createdAt"] = map[string]string{"gte": params.DateFrom.Format(time.RFC3339)}
	}

	variables := map[string]interface{}{
		"filter": filter,
		"first":  params.Limit,
	}
	if params.Cursor != nil {
		variables["after"] = *params.Cursor
	}

	var result IssuesResponse
	if err := c.doRequest(ctx, query, variables, &result); err != nil {
		return nil, err
	}

	return &result, nil
}

// commentsFragment returns the GraphQL fragment for comments
func (c *Client) commentsFragment(include bool) string {
	if !include {
		return ""
	}
	return `
		comments(first: 100) {
			nodes {
				id
				body
				bodyData
				createdAt
				updatedAt
				user {
					id
					name
					email
					active
				}
				parent {
					id
				}
			}
			pageInfo {
				hasNextPage
				endCursor
			}
		}
	`
}

// FetchAllComments fetches all comments for an issue, handling pagination
func (c *Client) FetchAllComments(ctx context.Context, issueID string) ([]Comment, error) {
	query := `
		query($issueId: String!, $after: String) {
			issue(id: $issueId) {
				comments(first: 100, after: $after) {
					nodes {
						id
						body
						bodyData
						createdAt
						updatedAt
						user {
							id
							name
							email
							active
						}
						parent {
							id
						}
					}
					pageInfo {
						hasNextPage
						endCursor
					}
				}
			}
		}
	`

	var allComments []Comment
	var cursor *string

	for {
		variables := map[string]interface{}{
			"issueId": issueID,
		}
		if cursor != nil {
			variables["after"] = *cursor
		}

		var result struct {
			Issue struct {
				Comments Comments `json:"comments"`
			} `json:"issue"`
		}

		if err := c.doRequest(ctx, query, variables, &result); err != nil {
			return nil, err
		}

		allComments = append(allComments, result.Issue.Comments.Nodes...)

		if !result.Issue.Comments.PageInfo.HasNextPage {
			break
		}
		cursor = &result.Issue.Comments.PageInfo.EndCursor
	}

	return allComments, nil
}

// DownloadAttachment downloads an attachment from Linear with retry logic
// Linear's image URLs are presigned but may still require API key authentication
func (c *Client) DownloadAttachment(ctx context.Context, url string) ([]byte, error) {
	var lastErr error
	maxRetries := 3

	for attempt := 0; attempt < maxRetries; attempt++ {
		if attempt > 0 {
			// Exponential backoff: 1s, 2s, 4s
			backoff := time.Duration(1<<uint(attempt-1)) * time.Second
			select {
			case <-time.After(backoff):
			case <-ctx.Done():
				return nil, ctx.Err()
			}
		}

		// Use a fresh context with timeout for each download attempt
		// This prevents cascading context cancellations
		downloadCtx, cancel := context.WithTimeout(context.Background(), 3*time.Minute)
		req, err := http.NewRequestWithContext(downloadCtx, "GET", url, nil)
		if err != nil {
			cancel()
			return nil, fmt.Errorf("create request: %w", err)
		}

		// Add Linear API authorization header - some images require it
		if c.apiKey != "" {
			req.Header.Set("Authorization", c.apiKey)
		}

		resp, err := c.downloadClient.Do(req)
		if err != nil {
			cancel()
			lastErr = fmt.Errorf("download attempt %d: %w", attempt+1, err)
			continue
		}

		if resp.StatusCode != http.StatusOK {
			resp.Body.Close()
			cancel()
			lastErr = fmt.Errorf("download failed: status=%d (attempt %d)", resp.StatusCode, attempt+1)
			continue
		}

		data, err := io.ReadAll(resp.Body)
		resp.Body.Close()
		cancel()

		if err != nil {
			lastErr = fmt.Errorf("read body attempt %d: %w", attempt+1, err)
			continue
		}

		return data, nil
	}

	return nil, fmt.Errorf("failed after %d attempts: %w", maxRetries, lastErr)
}

// ProjectSummary represents a Linear project with stats for mapping
type ProjectSummary struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	TeamID     string `json:"teamId"`
	TeamName   string `json:"teamName"`
	TeamKey    string `json:"teamKey"`
	IssueCount int    `json:"issueCount"`
}

// FetchProjects fetches all projects from Linear for mapping configuration
func (c *Client) FetchProjects(ctx context.Context) ([]ProjectSummary, error) {
	query := `
		query {
			projects(first: 100) {
				nodes {
					id
					name
					teams {
						nodes {
							id
							name
							key
						}
					}
					issues {
						nodes {
							id
						}
					}
				}
			}
		}
	`

	var result struct {
		Projects struct {
			Nodes []struct {
				ID    string `json:"id"`
				Name  string `json:"name"`
				Teams struct {
					Nodes []struct {
						ID   string `json:"id"`
						Name string `json:"name"`
						Key  string `json:"key"`
					} `json:"nodes"`
				} `json:"teams"`
				Issues struct {
					Nodes []struct {
						ID string `json:"id"`
					} `json:"nodes"`
				} `json:"issues"`
			} `json:"nodes"`
		} `json:"projects"`
	}

	if err := c.doRequest(ctx, query, nil, &result); err != nil {
		return nil, err
	}

	summaries := make([]ProjectSummary, 0)
	for _, proj := range result.Projects.Nodes {
		teamID := ""
		teamName := ""
		teamKey := ""
		if len(proj.Teams.Nodes) > 0 {
			teamID = proj.Teams.Nodes[0].ID
			teamName = proj.Teams.Nodes[0].Name
			teamKey = proj.Teams.Nodes[0].Key
		}

		summaries = append(summaries, ProjectSummary{
			ID:         proj.ID,
			Name:       proj.Name,
			TeamID:     teamID,
			TeamName:   teamName,
			TeamKey:    teamKey,
			IssueCount: len(proj.Issues.Nodes),
		})
	}

	return summaries, nil
}

// UserSummary represents a Linear user for actor mapping
type UserSummary struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	Email  string `json:"email"`
	Active bool   `json:"active"`
}

// FetchUsers fetches all active users from Linear for actor mapping
func (c *Client) FetchUsers(ctx context.Context) ([]UserSummary, error) {
	query := `
		query {
			users(first: 100) {
				nodes {
					id
					name
					email
					active
				}
			}
		}
	`

	var result struct {
		Users struct {
			Nodes []UserSummary `json:"nodes"`
		} `json:"users"`
	}

	if err := c.doRequest(ctx, query, nil, &result); err != nil {
		return nil, err
	}

	// Filter only active users
	activeUsers := make([]UserSummary, 0)
	for _, user := range result.Users.Nodes {
		if user.Active {
			activeUsers = append(activeUsers, user)
		}
	}

	return activeUsers, nil
}

// WorkflowStateSummary represents a Linear workflow state for mapping
type WorkflowStateSummary struct {
	ID         string  `json:"id"`
	Name       string  `json:"name"`
	Type       string  `json:"type"` // backlog, unstarted, started, completed, canceled
	TeamName   string  `json:"teamName"`
	TeamKey    string  `json:"teamKey"`
	IssueCount int     `json:"issueCount"`
	Color      string  `json:"color"`
	Position   float64 `json:"position"`
}

// FetchWorkflowStates fetches all workflow states from Linear for mapping configuration
func (c *Client) FetchWorkflowStates(ctx context.Context) ([]WorkflowStateSummary, error) {
	query := `
		query {
			workflowStates(first: 100) {
				nodes {
					id
					name
					type
					color
					position
					team {
						id
						name
						key
					}
					issues {
						nodes {
							id
						}
					}
				}
			}
		}
	`

	var result struct {
		WorkflowStates struct {
			Nodes []struct {
				ID       string  `json:"id"`
				Name     string  `json:"name"`
				Type     string  `json:"type"`
				Color    string  `json:"color"`
				Position float64 `json:"position"`
				Team     struct {
					ID   string `json:"id"`
					Name string `json:"name"`
					Key  string `json:"key"`
				} `json:"team"`
				Issues struct {
					Nodes []struct {
						ID string `json:"id"`
					} `json:"nodes"`
				} `json:"issues"`
			} `json:"nodes"`
		} `json:"workflowStates"`
	}

	if err := c.doRequest(ctx, query, nil, &result); err != nil {
		return nil, err
	}

	summaries := make([]WorkflowStateSummary, 0)
	for _, state := range result.WorkflowStates.Nodes {
		summaries = append(summaries, WorkflowStateSummary{
			ID:         state.ID,
			Name:       state.Name,
			Type:       state.Type,
			TeamName:   state.Team.Name,
			TeamKey:    state.Team.Key,
			IssueCount: len(state.Issues.Nodes),
			Color:      state.Color,
			Position:   state.Position,
		})
	}

	return summaries, nil
}
