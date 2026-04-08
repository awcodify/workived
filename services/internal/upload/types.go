package upload

// PresignRequest is the request body for generating a presigned upload URL.
type PresignRequest struct {
	ContentType string `json:"content_type" validate:"required,oneof=image/jpeg image/png"`
	Purpose     string `json:"purpose"      validate:"required,oneof=clock_in clock_out"`
}

// PresignResponse is the response containing the presigned URL and storage key.
type PresignResponse struct {
	UploadURL string `json:"upload_url"`
	Key       string `json:"key"`
}
