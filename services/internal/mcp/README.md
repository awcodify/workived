# Workived MCP Server

Model Context Protocol (MCP) server for Workived - 100% API-based integration for AI assistants.

## Features

- **🚀 Pure API Client**: Zero database dependencies - all operations via HTTP API
- **🔐 Browser SSO**: Secure authentication via browser login (no passwords in config)
- **🔄 Auto Token Refresh**: Transparent access token refresh using refresh token
- **📦 24 Tools**: Complete HR operations (employees, leave, attendance, tasks, departments)
- **🎯 Context Auto-Injection**: Organisation context extracted from JWT automatically

## Architecture

```
┌─────────────────┐
│  AI Assistant   │
│  (Claude, etc)  │
└────────┬────────┘
         │ stdio (JSON-RPC)
         ▼
┌─────────────────┐      ┌──────────────────┐
│   MCP Server    │─────▶│  Workived API    │
│  (100% API)     │ HTTP │  (JWT Auth)      │
└─────────────────┘      └──────────────────┘
         │
         ▼
   ~/.workived_mcp_token
   (refresh token, mode 600)
```

## Quick Start

### 1. Build

```bash
# Using make
make mcp-build

# Or manually
cd services
go build -o ../bin/mcp ./cmd/mcp
```

### 2. Configure

Set your Workived API URL:

```bash
export WORKIVED_APP_URL="http://localhost:8080"  # or your production URL
```

That's it! No database, no Redis, no passwords.
That's it! No database, no Redis, no passwords.

### 3. Run

```bash
# First run - opens browser for SSO login
WORKIVED_APP_URL="http://localhost:8080" ./bin/mcp
```

**Authentication flow:**
1. Server checks for saved session at `~/.workived_mcp_token`
2. If not found, opens browser to Workived login page
3. You login with your credentials (email + password)
4. Browser redirects back with refresh token
5. Token saved securely (file mode 600, encrypted)
6. Future runs use saved token - no browser needed!

**Session management:**
```bash
# Force new login
./bin/mcp --login

# Logout
./bin/mcp --logout
```

## Integration with AI Assistants

### VS Code Copilot Chat

Add to `.vscode/mcp.json`:

```json
{
  "servers": {
    "workived-dev": {
      "command": "/absolute/path/to/bin/mcp",
      "env": {
        "WORKIVED_APP_URL": "http://localhost:8080",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS):

```json
{
  "mcpServers": {
    "workived": {
      "command": "/absolute/path/to/bin/mcp",
      "env": {
        "WORKIVED_APP_URL": "https://api.workived.com",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

**Then reload the AI assistant** to load the MCP server.

**Then reload the AI assistant** to load the MCP server.

## Available Tools (24 total)

All tools automatically use your authenticated organisation context - **no need to specify organisation_id**!

### Employee Operations
- `workived_list_employees` - List employees (filter by department, status, search)
- `workived_get_employee` - Get employee details
- `workived_create_employee` - Create new employee

### Leave Operations
- `workived_list_leave_requests` - List leave requests (filter by status, employee, dates)
- `workived_get_leave_balances` - Get employee leave balances
- `workived_submit_leave_request` - Submit new leave request
- `workived_approve_leave_request` - Approve/reject pending request

### Attendance Operations
- `workived_clock_in` - Clock in employee
- `workived_clock_out` - Clock out employee
- `workived_get_attendance_report` - Get attendance report

### Task Management
**Task Lists:**
- `workived_list_task_lists` - List task lists/columns
- `workived_create_task_list` - Create new task list

**Tasks:**
- `workived_list_tasks` - List tasks (filter by list, assignee, priority, status, search)
- `workived_get_task` - Get task details
- `workived_create_task` - Create new task
- `workived_update_task` - Update task
- `workived_move_task` - Move task to different list
- `workived_toggle_task_completion` - Toggle complete/incomplete
- `workived_delete_task` - Delete task

**Comments:**
- `workived_list_task_comments` - List comments (with nested replies)
- `workived_create_task_comment` - Add comment (markdown supported)
- `workived_delete_task_comment` - Delete comment

### Other
- `workived_list_departments` - List departments
- `workived_get_dashboard_stats` - Get dashboard statistics

## Usage Examples

Simply use natural language with your AI assistant:

```
"Show me all active employees"
"List pending leave requests"
"Create a high priority task called 'Fix login bug'"
"Clock me in"
"Get dashboard stats"
"What tasks are assigned to John?"
```

The MCP server:
- ✅ Extracts organisation_id from your JWT automatically
- ✅ Injects employee_id when you say "me" or for your actions
- ✅ Enforces API-level permissions and multi-tenancy
- ✅ Refreshes access tokens transparently
- ✅ Returns formatted results in MCP protocol

## Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `WORKIVED_APP_URL` | Workived API base URL | Yes | - |
| `LOG_LEVEL` | Log level (debug, info, warn, error) | No | info |

## Security

- **No database access**: MCP server never touches your database directly
- **JWT authentication**: All API calls use JWT tokens with organisation context
- **Token encryption**: Refresh token stored encrypted at `~/.workived_mcp_token` (mode 600)
- **API enforced permissions**: Multi-tenancy and RBAC handled by API layer
- **Secure token refresh**: Automatic access token refresh via `/api/v1/auth/refresh`

## Troubleshooting

**"MCP authentication failed"**
- Run `./bin/mcp --logout` then try again
- Check WORKIVED_APP_URL is correct
- Verify API is running and accessible

**"Access token expired"**
- Token refresh happens automatically
- If refresh fails, run `./bin/mcp --login` to re-authenticate

**"Tool execution failed"**
- Check API logs for detailed error
- Verify your role has permission for the operation
- Ensure required parameters are provided

## Development

```bash
# Build
make mcp-build

# Test with sample requests
make mcp-test

# Run go vet
cd services && go vet ./internal/mcp/... ./cmd/mcp/...
```

## Architecture Details

**100% API-based design:**
- No database or Redis dependencies
- All operations via HTTP to Workived API
- JWT tokens contain all user context (user_id, org_id, role, employee_id)
- API handles multi-tenancy, permissions, audit logging
- MCP server is a stateless client

**Files:**
- `cmd/mcp/main.go` - Entry point (62 lines)
- `internal/mcp/server.go` - MCP protocol server (244 lines)
- `internal/mcp/api_client.go` - HTTP client with auto-refresh (215 lines)
- `internal/mcp/handler_api.go` - 24 tool implementations via API (609 lines)
- `internal/mcp/tools.go` - Tool definitions (541 lines)
- `internal/mcp/sso.go` - Browser SSO flow (372 lines)
- `internal/mcp/types.go` - MCP protocol types (43 lines)
- `internal/auth/handler_mcp.go` - SSO login page (290 lines)

**Total: ~2,380 lines of Go code**

## Authentication & Security

### How Authentication Works

The MCP server uses **browser-based SSO authentication**:

1. **Browser SSO**: On first run, opens browser to Workived login page
2. **Secure Token Storage**: Refresh token saved to `~/.workived_mcp_token` (mode 600)
3. **Automatic Renewal**: Uses saved token for future runs - no repeated logins
4. **Session Context**: Your user_id, organisation_id, employee_id, and role are cached
5. **Auto-Injection**: All tool calls automatically use your context - no need to specify IDs
6. **Permission Enforcement**: Operations respect your role-based permissions

### Authentication Flow

```
First Run:
MCP Startup → Check Token File → Not Found → Open Browser → User Logs In
  → Callback with Token → Save Token → Fetch User Context → Ready

Subsequent Runs:
MCP Startup → Check Token File → Found → Refresh Token → Fetch User Context → Ready
```

### Configuration

Set these environment variables:

```bash
export WORKIVED_APP_URL="http://localhost:8080"     # Your Workived instance URL
export DATABASE_URL="postgresql://..."               # Database connection
export REDIS_URL="redis://localhost:6379"           # Redis connection
```

### Security Model

✅ **What's Secured:**
- **No passwords in config files** - browser-based SSO only
- Refresh token stored with strict file permissions (mode 600)
- Token file location: `~/.workived_mcp_token`
- Multi-tenancy automatically enforced (you can only access your org's data)
- Role-based permissions inherited from your account
- Audit logs automatically attribute actions to you
- Local execution (MCP runs on your machine, not remotely)

⚠️ **Security Considerations:**
- Token file grants access - protect `~/.workived_mcp_token`
- Tokens valid for 30 days (configurable in code)
- Anyone with access to your token file can impersonate you
- Use `./bin/mcp --logout` to invalidate local session

### Session Management

```bash
# Normal run (uses saved session if available)
./bin/mcp

# Force new login (opens browser even if token exists)
./bin/mcp --login

# Logout (delete saved token)
./bin/mcp --logout
```

### Recommended Security Setup

**For Development:**
```json
{
  "mcpServers": {
    "workived-dev": {
      "command": "/path/to/bin/mcp",
      "env": {
        "DATABASE_URL": "postgresql://localhost:5432/workived_dev",
        "REDIS_URL": "redis://localhost:6379",
        "LOG_LEVEL": "debug"
      }
    }
  }
}
```

**For Production Access:**
```json
{
  "mcpServers": {
    "workived-prod": {
      "command": "/path/to/bin/mcp",
      "env": {
        "DATABASE_URL": "postgresql://readonly_user:pass@prod-db:5432/workived",
        "REDIS_URL": "redis://prod-redis:6379",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

**Pro Tip:** Use a **read-only database user** for production to prevent accidental modifications:
```sql
-- Create read-only user for MCP
CREATE USER mcp_readonly WITH PASSWORD 'secure-password';
GRANT CONNECT ON DATABASE workived TO mcp_readonly;
GRANT USAGE ON SCHEMA public TO mcp_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO mcp_readonly;
```

### Access Control Best Practices

1. **Personal Use Only**: MCP server should only be installed on machines you trust
2. **One Person Per Instance**: Don't share your Claude Desktop config with others
3. **Separate Environments**: Use different MCP configs for dev/staging/prod
4. **Read-Only Where Possible**: Use read-only database access if you only need to query data
5. **Monitor Audit Logs**: Regularly review audit logs for unexpected activity

### Future Enhancements

Planned security improvements:
- [ ] Role-based access control (RBAC) integration
- [ ] Per-employee permission checking
- [ ] API key authentication option
- [ ] Request rate limiting
- [ ] IP whitelist support

## Development

### Project Structure

```
services/
├── cmd/
│   ├── mcp/           # MCP server (stdio)
│   └── mcp-docs/      # Documentation server (HTTP)
└── internal/
    └── mcp/
        ├── server.go  # MCP protocol handler
        ├── handler.go # Tool execution logic
        ├── tools.go   # Tool definitions
        ├── types.go   # MCP types
        └── docs.go    # Scalar/OpenAPI integration
```

### Adding New Tools

1. Define tool in `tools.go`:
```go
{
    Name:        "workived_new_tool",
    Description: "Description of what it does",
    InputSchema: map[string]interface{}{
        "type": "object",
        "properties": map[string]interface{}{
            "param": map[string]interface{}{
                "type": "string",
                "description": "Parameter description",
            },
        },
        "required": []string{"param"},
    },
}
```

2. Implement handler in `handler.go`:
```go
func (h *ToolHandler) newTool(ctx context.Context, args map[string]interface{}) (interface{}, error) {
    // Implementation
    return successResult("Success message", data)
}
```

3. Register in `ExecuteTool` switch statement

## Testing

```bash
# Test MCP protocol manually
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' | ./bin/mcp

# Expected response:
# {"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2024-11-05",...}}

# Test listing tools
echo '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' | ./bin/mcp

# Test calling a tool
echo '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"workived_list_employees","arguments":{"organisation_id":"..."}}}' | ./bin/mcp
```

## Production Deployment

For production use:

1. **Run MCP server as a service** (systemd, supervisor, etc.)
2. **Use connection pooling** for database
3. **Set proper log levels** (`LOG_LEVEL=info`)
4. **Monitor stdio streams** for errors
5. **Consider rate limiting** at AI assistant level

## Troubleshooting

### Common Issues

**"Invalid organisation_id"**
- Ensure you're passing valid UUID v4 format
- Check that organisation exists in database

**"Failed to connect database"**
- Verify `DATABASE_URL` is correct
- Check network connectivity to database
- Ensure database has proper schema (run migrations)

**"Tool not found"**
- Check tool name spelling (case-sensitive)
- Run `tools/list` to see available tools

## License

Proprietary - Workived © 2026

## Support

For issues or questions:
- Email: support@workived.com
- Docs: https://docs.workived.com
