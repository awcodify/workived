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
	PublicEndpoint  string // Public-facing endpoint for presigned URLs (e.g. "192.168.1.109:9000" for local dev). Empty = use Endpoint.
	Region          string
	Bucket          string
	AccessKeyID     string
	SecretAccessKey string
	UseSSL          bool // MinIO: false (local), S3: true
}

// Client wraps S3/MinIO operations.
type Client struct {
	s3Client       *s3.Client // used for internal ops (upload, delete)
	presignS3      *s3.Client // used for generating presigned URLs; may target a different host
	bucket         string
}

// NewClient creates an S3/MinIO client.
func NewClient(ctx context.Context, cfg Config) (*Client, error) {
	baseOpts := []func(*config.LoadOptions) error{
		config.WithRegion(cfg.Region),
		config.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(
			cfg.AccessKeyID,
			cfg.SecretAccessKey,
			"",
		)),
	}

	awsCfg, err := config.LoadDefaultConfig(ctx, baseOpts...)
	if err != nil {
		return nil, fmt.Errorf("load aws config: %w", err)
	}

	scheme := "http"
	if cfg.UseSSL {
		scheme = "https"
	}

	// Internal client — used for Upload, Delete, etc.
	var internalOpts []func(*s3.Options)
	if cfg.Endpoint != "" {
		endpoint := fmt.Sprintf("%s://%s", scheme, cfg.Endpoint)
		internalOpts = append(internalOpts, func(o *s3.Options) {
			o.BaseEndpoint = aws.String(endpoint)
			o.UsePathStyle = true
		})
	}
	internalClient := s3.NewFromConfig(awsCfg, internalOpts...)

	// Presign client — uses PublicEndpoint when set so that the generated URL
	// is reachable by mobile clients. Signature is computed for the correct host.
	presignEndpoint := cfg.PublicEndpoint
	if presignEndpoint == "" {
		presignEndpoint = cfg.Endpoint
	}
	var presignOpts []func(*s3.Options)
	if presignEndpoint != "" {
		ep := fmt.Sprintf("%s://%s", scheme, presignEndpoint)
		presignOpts = append(presignOpts, func(o *s3.Options) {
			o.BaseEndpoint = aws.String(ep)
			o.UsePathStyle = true
		})
	}
	presignClient := s3.NewFromConfig(awsCfg, presignOpts...)

	return &Client{
		s3Client:  internalClient,
		presignS3: presignClient,
		bucket:    cfg.Bucket,
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
	pc := s3.NewPresignClient(c.presignS3)

	req, err := pc.PresignGetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(c.bucket),
		Key:    aws.String(key),
	}, s3.WithPresignExpires(15*time.Minute))
	if err != nil {
		return "", fmt.Errorf("s3 presign url: %w", err)
	}

	return req.URL, nil
}

// GetPresignedUploadURL generates a presigned PUT URL for uploading a file (15min expiry).
// The URL is signed for PublicEndpoint (if set) so mobile clients can PUT directly to MinIO.
func (c *Client) GetPresignedUploadURL(ctx context.Context, key, contentType string) (string, error) {
	pc := s3.NewPresignClient(c.presignS3)

	req, err := pc.PresignPutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(c.bucket),
		Key:         aws.String(key),
		ContentType: aws.String(contentType),
	}, s3.WithPresignExpires(15*time.Minute))
	if err != nil {
		return "", fmt.Errorf("s3 presign upload url: %w", err)
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
