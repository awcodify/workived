package auth

import (
	"encoding/base64"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/workived/services/pkg/apperr"
	"github.com/workived/services/pkg/validate"
)

// HandleMCPLogin renders a login page for MCP SSO flow
func (h *Handler) HandleMCPLogin(c *gin.Context) {
	callback := c.Query("callback")
	state := c.Query("state")

	if callback == "" || state == "" {
		c.JSON(http.StatusBadRequest, apperr.Response(apperr.New(apperr.CodeValidation, "missing callback or state")))
		return
	}

	// Validate callback can be decoded (but don't use the decoded value here)
	_, err := base64.URLEncoding.DecodeString(callback)
	if err != nil {
		c.JSON(http.StatusBadRequest, apperr.Response(apperr.New(apperr.CodeValidation, "invalid callback URL encoding")))
		return
	}

	// Render login page with ENCODED callback (will be decoded in HandleMCPAuth)
	c.Header("Content-Type", "text/html")
	c.String(http.StatusOK, mcpLoginHTML, callback, state)
}

// HandleMCPAuth handles the MCP authentication and redirect
func (h *Handler) HandleMCPAuth(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, apperr.Response(apperr.New(apperr.CodeValidation, err.Error())))
		return
	}
	// Validate request
	if err := validate.Struct(req); err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}

	resp, refreshToken, err := h.service.Login(c.Request.Context(), req)
	if err != nil {
		apperr.Respond(c, err)
		return
	}

	callback := c.Query("callback")
	state := c.Query("state")

	if callback == "" || state == "" {
		c.JSON(http.StatusBadRequest, apperr.Response(apperr.New(apperr.CodeValidation, "missing callback or state")))
		return
	}

	// Decode callback URL
	callbackBytes, err := base64.URLEncoding.DecodeString(callback)
	if err != nil {
		c.JSON(http.StatusBadRequest, apperr.Response(apperr.New(apperr.CodeValidation, "invalid callback URL")))
		return
	}
	callbackURL := string(callbackBytes)

	// Redirect to callback with token
	c.JSON(http.StatusOK, gin.H{
		"redirect_url": callbackURL + "?token=" + refreshToken +
			"&user_id=" + resp.User.ID.String() +
			"&email=" + resp.User.Email +
			"&state=" + state,
	})
}

const mcpLoginHTML = `
<!DOCTYPE html>
<html>
<head>
    <title>Workived MCP - Login</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%%, #764ba2 100%%);
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 20px;
        }
        .container {
            background: white;
            border-radius: 16px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            max-width: 420px;
            width: 100%%;
            padding: 3rem;
        }
        .logo {
            text-align: center;
            margin-bottom: 2rem;
        }
        .logo h1 {
            font-size: 28px;
            color: #1f2937;
            margin-bottom: 0.5rem;
        }
        .logo p {
            color: #6b7280;
            font-size: 14px;
        }
        .form-group {
            margin-bottom: 1.5rem;
        }
        label {
            display: block;
            color: #374151;
            font-weight: 500;
            margin-bottom: 0.5rem;
            font-size: 14px;
        }
        input {
            width: 100%%;
            padding: 0.75rem 1rem;
            border: 2px solid #e5e7eb;
            border-radius: 8px;
            font-size: 15px;
            transition: all 0.2s;
        }
        input:focus {
            outline: none;
            border-color: #667eea;
            box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }
        .btn {
            width: 100%%;
            padding: 0.875rem;
            background: linear-gradient(135deg, #667eea 0%%, #764ba2 100%%);
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: transform 0.2s, box-shadow 0.2s;
        }
        .btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 20px rgba(102, 126, 234, 0.3);
        }
        .btn:active {
            transform: translateY(0);
        }
        .btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
            transform: none;
        }
        .error {
            background: #fef2f2;
            border: 1px solid #fecaca;
            color: #dc2626;
            padding: 0.875rem;
            border-radius: 8px;
            margin-bottom: 1.5rem;
            font-size: 14px;
            display: none;
        }
        .info {
            background: #f0f9ff;
            border: 1px solid #bae6fd;
            color: #0369a1;
            padding: 0.875rem;
            border-radius: 8px;
            margin-bottom: 1.5rem;
            font-size: 14px;
        }
        .spinner {
            display: inline-block;
            width: 16px;
            height: 16px;
            border: 2px solid #ffffff;
            border-top-color: transparent;
            border-radius: 50%%;
            animation: spin 0.8s linear infinite;
            margin-right: 8px;
            vertical-align: middle;
        }
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">
            <h1>🔐 Workived MCP</h1>
            <p>Sign in to continue to MCP server</p>
        </div>
        
        <div class="info">
            <strong>🖥️ CLI Authentication</strong><br>
            This login is for the Workived MCP command-line tool.
        </div>
        
        <div class="error" id="error"></div>
        
        <form id="loginForm">
            <div class="form-group">
                <label for="email">Email</label>
                <input type="email" id="email" name="email" required autocomplete="email" placeholder="you@company.com">
            </div>
            
            <div class="form-group">
                <label for="password">Password</label>
                <input type="password" id="password" name="password" required autocomplete="current-password" placeholder="••••••••">
            </div>
            
            <button type="submit" class="btn" id="submitBtn">
                Sign In
            </button>
        </form>
    </div>

    <script>
        const form = document.getElementById('loginForm');
        const errorDiv = document.getElementById('error');
        const submitBtn = document.getElementById('submitBtn');
        
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            
            // Show loading state
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="spinner"></span> Signing in...';
            errorDiv.style.display = 'none';
            
            try {
                const response = await fetch('/api/v1/mcp/auth?callback=%s&state=%s', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ email, password }),
                });
                
                const data = await response.json();
                
                if (!response.ok) {
                    // Handle error response
                    let errorMsg = 'Login failed';
                    if (data.error && data.error.message) {
                        errorMsg = data.error.message;
                    } else if (data.message) {
                        errorMsg = data.message;
                    }
                    throw new Error(errorMsg);
                }
                
                // Redirect to callback URL
                if (data.redirect_url) {
                    window.location.href = data.redirect_url;
                } else {
                    throw new Error('No redirect URL received');
                }
                
            } catch (error) {
                errorDiv.textContent = error.message;
                errorDiv.style.display = 'block';
                submitBtn.disabled = false;
                submitBtn.innerHTML = 'Sign In';
                console.error('Login error:', error);
            }
        });
    </script>
</body>
</html>
`
