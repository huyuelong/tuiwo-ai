package dto

// MediaUploadConfigResponse 对应 GET /api/user/media/upload-config。
// 绝不包含任何密钥字段。
type MediaUploadConfigResponse struct {
	Enabled           bool     `json:"enabled"`
	MaxImageMB        int      `json:"max_image_mb"`
	MaxAudioMB        int      `json:"max_audio_mb"`
	MaxVideoMB        int      `json:"max_video_mb"`
	DailyBytes        int64    `json:"daily_bytes"`
	AllowedCategories []string `json:"allowed_categories"`
	PutURLExpirySec   int      `json:"put_url_expiry_sec"`
	GetURLExpirySec   int      `json:"get_url_expiry_sec"`
}

// MediaUploadInitiateRequest 对应 POST /api/user/media/uploads/initiate 请求体。
type MediaUploadInitiateRequest struct {
	Filename    string `json:"filename"`
	ContentType string `json:"content_type"`
	SizeBytes   int64  `json:"size_bytes"`
}

// MediaUploadInitiateResponse 返回短时预签名 PUT URL。
type MediaUploadInitiateResponse struct {
	UploadId  string            `json:"upload_id"`
	ObjectKey string            `json:"object_key"`
	PutURL    string            `json:"put_url"`
	Headers   map[string]string `json:"headers"`
	ExpiresAt int64             `json:"expires_at"`
	Category  string            `json:"category"`
}

// MediaUploadCompleteRequest 对应 POST /api/user/media/uploads/complete 请求体。
type MediaUploadCompleteRequest struct {
	UploadId string `json:"upload_id"`
}

// MediaUploadCompleteResponse 校验通过后返回 24 小时预签名 GET URL。
type MediaUploadCompleteResponse struct {
	UploadId    string `json:"upload_id"`
	ObjectKey   string `json:"object_key"`
	GetURL      string `json:"get_url"`
	ContentType string `json:"content_type"`
	SizeBytes   int64  `json:"size_bytes"`
	Category    string `json:"category"`
	Filename    string `json:"filename"`
	ExpiresAt   int64  `json:"expires_at"`
}

// MediaPresignGetRequest 对应 POST /api/user/media/presign-get 请求体。
type MediaPresignGetRequest struct {
	ObjectKeys []string `json:"object_keys"`
}

// MediaPresignGetResponse 返回 object_key 到预签名 GET URL 的映射。
type MediaPresignGetResponse struct {
	URLs map[string]string `json:"urls"`
}
