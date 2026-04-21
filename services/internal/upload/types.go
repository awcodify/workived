package upload

// PresignRequest is the request body for generating a presigned upload URL.
type PresignRequest struct {
	ContentType string `json:"content_type" validate:"required,oneof=image/jpeg image/png image/gif image/webp"`
	Purpose     string `json:"purpose"      validate:"required,oneof=clock_in clock_out task_attachment comment_attachment"`
}

// PresignResponse is the response containing the presigned URL and storage key.
type PresignResponse struct {
	UploadURL string `json:"upload_url"` // Presigned PUT URL for uploading (15min expiry)
	Key       string `json:"key"`        // Storage key
	PublicURL string `json:"public_url"` // Public GET URL for accessing the uploaded file
}
