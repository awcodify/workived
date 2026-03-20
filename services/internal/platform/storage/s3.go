package storage

import (
	"context"
	"fmt"
	"io"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

// Config holds S3/MinIO connection configuration.
type Config struct {
	Endpoint        string // MinIO: "localhost:9000", S3: ""
	Region          string
	Bucket          string
	AccessKeyID     string
	SecretAccessKey string
	UseSSL          bool // MinIO: false (local), S3: true
}

// Client wraps S3/MinIO operations.
type Client struct {
	s3Client *s3.Client
	bucket   string
}

// NewClient creates an S3/MinIO client.
func NewClient(ctx context.Context, cfg Config) (*Client, error) {
	opts := []func(*config.LoadOptions) error{
		config.WithRegion(cfg.Region),
		config.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(
			cfg.AccessKeyID,
			cfg.SecretAccessKey,
			"",
		)),
	}

	awsCfg, err := config.LoadDefaultConfig(ctx, opts...)
	if err != nil {
		return nil, fmt.Errorf("load aws config: %w", err)
	}

	s3Opts := []func(*s3.Options){}

	// MinIO-specific configuration
	if cfg.Endpoint != "" {
		scheme := "http"
		if cfg.UseSSL {
			scheme = "https"
		}
		s3Opts = append(s3Opts, func(o *s3.Options) {
			o.BaseEndpoint = aws.String(fmt.Sprintf("%s://%s", scheme, cfg.Endpoint))
			o.UsePathStyle = true // MinIO requires path-style access
		})
	}

	return &Client{
		s3Client: s3.NewFromConfig(awsCfg, s3Opts...),
		bucket:   cfg.Bucket,
	}, nil
}

// Upload uploads a file to S3/MinIO.
func (c *Client) Upload(ctx context.Context, key string, body io.Reader, contentType string) error {
	_, err := c.s3Client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(c.bucket),
		Key:         aws.String(key),
		Body:        body,
		ContentType: aws.String(contentType),
	})
	if err != nil {
		return fmt.Errorf("s3 put object: %w", err)
	}
	return nil
}

// GetPresignedURL generates a presigned URL for downloading a file (15min expiry).
func (c *Client) GetPresignedURL(ctx context.Context, key string) (string, error) {
	presignClient := s3.NewPresignClient(c.s3Client)

	req, err := presignClient.PresignGetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(c.bucket),
		Key:    aws.String(key),
	}, s3.WithPresignExpires(15*time.Minute))

	if err != nil {
		return "", fmt.Errorf("s3 presign url: %w", err)
	}

	return req.URL, nil
}

// Delete removes a file from S3/MinIO.
func (c *Client) Delete(ctx context.Context, key string) error {
	_, err := c.s3Client.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: aws.String(c.bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		return fmt.Errorf("s3 delete object: %w", err)
	}
	return nil
}
