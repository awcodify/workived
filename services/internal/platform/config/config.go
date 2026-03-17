package config

import (
	"fmt"
	"strings"
	"time"

	"github.com/spf13/viper"
)

type Config struct {
	Env  string `mapstructure:"ENV"`
	Port int    `mapstructure:"PORT"`

	DatabaseURL string `mapstructure:"DATABASE_URL"`
	RedisURL    string `mapstructure:"REDIS_URL"`

	JWTSecret     string        `mapstructure:"JWT_SECRET"`
	JWTAccessTTL  time.Duration `mapstructure:"JWT_ACCESS_TTL"`
	JWTRefreshTTL time.Duration `mapstructure:"JWT_REFRESH_TTL"`

	S3Bucket          string `mapstructure:"S3_BUCKET"`
	S3Region          string `mapstructure:"S3_REGION"`
	AWSAccessKeyID    string `mapstructure:"AWS_ACCESS_KEY_ID"`
	AWSSecretAccessKey string `mapstructure:"AWS_SECRET_ACCESS_KEY"`

	SMTPHost string `mapstructure:"SMTP_HOST"`
	SMTPPort int    `mapstructure:"SMTP_PORT"`
	SMTPUser string `mapstructure:"SMTP_USER"`
	SMTPPass string `mapstructure:"SMTP_PASS"`
	EmailFrom string `mapstructure:"EMAIL_FROM"`

	AppURL string `mapstructure:"APP_URL"`
	APIURL string `mapstructure:"API_URL"`
}

func Load() (*Config, error) {
	v := viper.New()

	v.SetDefault("ENV", "development")
	v.SetDefault("PORT", 8080)
	v.SetDefault("JWT_ACCESS_TTL", "15m")
	v.SetDefault("JWT_REFRESH_TTL", "720h")
	v.SetDefault("EMAIL_FROM", "noreply@workived.com")
	v.SetDefault("SMTP_PORT", 587)

	v.SetConfigName(".env")
	v.SetConfigType("env")
	v.AddConfigPath(".")
	v.AddConfigPath("../")
	v.AddConfigPath("../../")

	v.AutomaticEnv()
	v.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))

	// best-effort read of .env file; env vars take precedence
	_ = v.ReadInConfig()

	var cfg Config
	if err := v.Unmarshal(&cfg); err != nil {
		return nil, fmt.Errorf("config unmarshal: %w", err)
	}

	if cfg.JWTSecret == "" {
		return nil, fmt.Errorf("JWT_SECRET is required")
	}
	if cfg.DatabaseURL == "" {
		return nil, fmt.Errorf("DATABASE_URL is required")
	}

	return &cfg, nil
}
