package config

import (
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/rs/zerolog"
	"github.com/spf13/viper"
)

type Config struct {
	Env      string `mapstructure:"ENV"`
	Port     int    `mapstructure:"PORT"`
	LogLevel string `mapstructure:"LOG_LEVEL"`

	DatabaseURL string `mapstructure:"DATABASE_URL"`
	RedisURL    string `mapstructure:"REDIS_URL"`

	JWTSecret     string        `mapstructure:"JWT_SECRET"`
	JWTAccessTTL  time.Duration `mapstructure:"JWT_ACCESS_TTL"`
	JWTRefreshTTL time.Duration `mapstructure:"JWT_REFRESH_TTL"`

	S3Endpoint         string `mapstructure:"S3_ENDPOINT"`        // MinIO: localhost:9000 (no protocol!), AWS: leave empty
	S3PublicEndpoint   string `mapstructure:"S3_PUBLIC_ENDPOINT"` // Override host in presigned URLs (e.g. 192.168.1.109:9000 for local dev)
	S3Bucket           string `mapstructure:"S3_BUCKET"`
	S3Region           string `mapstructure:"S3_REGION"`
	S3UseSSL           bool   `mapstructure:"S3_USE_SSL"` // false for local MinIO, true for production
	AWSAccessKeyID     string `mapstructure:"AWS_ACCESS_KEY_ID"`
	AWSSecretAccessKey string `mapstructure:"AWS_SECRET_ACCESS_KEY"`

	SMTPHost     string `mapstructure:"SMTP_HOST"`
	SMTPPort     int    `mapstructure:"SMTP_PORT"`
	SMTPUser     string `mapstructure:"SMTP_USER"`
	SMTPPass     string `mapstructure:"SMTP_PASS"`
	EmailFrom    string `mapstructure:"EMAIL_FROM"`
	EmailEnabled bool   `mapstructure:"EMAIL_ENABLED"` // Set to true to actually send emails

	ResendAPIKey string `mapstructure:"RESEND_API_KEY"` // If set, uses Resend instead of SMTP

	AppURL string `mapstructure:"APP_URL"`
	APIURL string `mapstructure:"API_URL"`

	DocsUsername string `mapstructure:"DOCS_USERNAME"`
	DocsPassword string `mapstructure:"DOCS_PASSWORD"`

	// OAuth Configuration
	GoogleClientID     string `mapstructure:"GOOGLE_CLIENT_ID"`
	GoogleClientSecret string `mapstructure:"GOOGLE_CLIENT_SECRET"`
	GoogleRedirectURL  string `mapstructure:"GOOGLE_REDIRECT_URL"` // e.g., http://localhost:8080/api/v1/auth/google/callback

	// Telegram Notifications
	TelegramBotToken string `mapstructure:"TELEGRAM_BOT_TOKEN"`
	TelegramChatID   string `mapstructure:"TELEGRAM_CHAT_ID"`
}

func Load() (*Config, error) {
	v := viper.New()

	v.SetDefault("ENV", "development")
	v.SetDefault("PORT", 8080)
	v.SetDefault("LOG_LEVEL", "info")
	v.SetDefault("JWT_ACCESS_TTL", "15m")
	v.SetDefault("JWT_REFRESH_TTL", "720h")
	v.SetDefault("EMAIL_FROM", "noreply@workived.com")
	v.SetDefault("SMTP_PORT", 587)
	v.SetDefault("S3_USE_SSL", true) // default true for production S3
	v.SetDefault("S3_REGION", "ap-southeast-1")

	v.SetConfigName(".env")
	v.SetConfigType("env")
	v.AddConfigPath(".")
	v.AddConfigPath("../")
	v.AddConfigPath("../../")

	v.AutomaticEnv()

	// Explicitly bind environment variables to config keys
	// This is required for unmarshaling to work correctly with AutomaticEnv
	_ = v.BindEnv("ENV")
	_ = v.BindEnv("PORT")
	_ = v.BindEnv("LOG_LEVEL")
	_ = v.BindEnv("DATABASE_URL")
	_ = v.BindEnv("REDIS_URL")
	_ = v.BindEnv("JWT_SECRET")
	_ = v.BindEnv("JWT_ACCESS_TTL")
	_ = v.BindEnv("JWT_REFRESH_TTL")
	_ = v.BindEnv("S3_ENDPOINT")
	_ = v.BindEnv("S3_PUBLIC_ENDPOINT")
	_ = v.BindEnv("S3_BUCKET")
	_ = v.BindEnv("S3_REGION")
	_ = v.BindEnv("S3_USE_SSL")
	_ = v.BindEnv("AWS_ACCESS_KEY_ID")
	_ = v.BindEnv("AWS_SECRET_ACCESS_KEY")
	_ = v.BindEnv("SMTP_HOST")
	_ = v.BindEnv("SMTP_PORT")
	_ = v.BindEnv("SMTP_USER")
	_ = v.BindEnv("SMTP_PASS")
	_ = v.BindEnv("EMAIL_FROM")
	_ = v.BindEnv("EMAIL_ENABLED")
	_ = v.BindEnv("RESEND_API_KEY")
	_ = v.BindEnv("APP_URL")
	_ = v.BindEnv("API_URL")
	_ = v.BindEnv("DOCS_USERNAME")
	_ = v.BindEnv("DOCS_PASSWORD")
	_ = v.BindEnv("GOOGLE_CLIENT_ID")
	_ = v.BindEnv("GOOGLE_CLIENT_SECRET")
	_ = v.BindEnv("GOOGLE_REDIRECT_URL")

	// best-effort read of .env file; env vars take precedence
	_ = v.ReadInConfig()

	var cfg Config
	if err := v.Unmarshal(&cfg); err != nil {
		return nil, fmt.Errorf("config unmarshal: %w", err)
	}

	// Debug: log what viper actually sees (only in debug mode)
	if strings.ToLower(cfg.LogLevel) == "debug" {
		log := zerolog.New(os.Stdout).With().Timestamp().Logger()
		log.Debug().
			Str("viper_jwt_secret", v.GetString("JWT_SECRET")).
			Int("viper_jwt_secret_len", len(v.GetString("JWT_SECRET"))).
			Str("config_jwt_secret", cfg.JWTSecret).
			Int("config_jwt_secret_len", len(cfg.JWTSecret)).
			Msg("config debug: JWT_SECRET loading")
	}

	if cfg.JWTSecret == "" {
		return nil, fmt.Errorf("JWT_SECRET is required")
	}
	if cfg.DatabaseURL == "" {
		return nil, fmt.Errorf("DATABASE_URL is required")
	}

	return &cfg, nil
}
