package service

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/url"
	"os"
	"path"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/google/uuid"
)

const (
	MediaCategoryImage    = "image"
	MediaCategoryAudio    = "audio"
	MediaCategoryVideo    = "video"
	MediaCategoryDocument = "document"

	mediaPutURLExpiry = 10 * time.Minute
	mediaGetURLExpiry = 24 * time.Hour // 预签名 GET 有效期；对象本身由桶前缀生命周期（MEDIA_OBJECT_RETENTION_DAYS）到期删除

	defaultMediaKeyPrefix      = "media-uploads"
	defaultMediaMaxImageMB     = 20
	defaultMediaMaxAudioMB     = 100
	defaultMediaMaxVideoMB     = 500
	defaultMediaMaxDocumentMB  = 20
	defaultMediaDailyBytes    = int64(2147483648) // 2 GiB
	defaultMediaRegion        = "us-east-1"
	maxMediaFilenameLen       = 200
	maxMediaDeclaredSizeBytes = int64(2) * 1024 * 1024 * 1024 // 单对象硬上限 2 GiB
)

var (
	ErrMediaUploadDisabled   = errors.New("media upload is disabled")
	ErrMediaUploadNotFound   = errors.New("media upload not found")
	ErrMediaUploadBadStatus  = errors.New("media upload is not pending")
	ErrMediaUploadQuota      = errors.New("daily media upload quota exceeded")
	ErrMediaUploadValidation = errors.New("invalid media upload request")
)

// MediaStorageConfig 仅从环境变量加载。
// 密钥不得写入数据库，也不得返回给前端。
type MediaStorageConfig struct {
	Enabled        bool
	Bucket         string
	Endpoint       string
	PublicEndpoint string
	Region         string
	AccessKey      string
	SecretKey      string
	ForcePathStyle bool
	KeyPrefix      string
	MaxImageMB     int
	MaxAudioMB     int
	MaxVideoMB     int
	MaxDocumentMB  int
	DailyBytes     int64
}

type mediaObjectMeta struct {
	ContentType string
	SizeBytes   int64
}

type mediaS3API interface {
	PresignPut(ctx context.Context, key, contentType string, expiry time.Duration) (string, error)
	PresignGet(ctx context.Context, key string, expiry time.Duration) (string, error)
	Head(ctx context.Context, key string) (*mediaObjectMeta, error)
	Put(ctx context.Context, key, contentType string, body io.Reader, size int64) error
	Delete(ctx context.Context, key string) error
	Copy(ctx context.Context, srcKey, dstKey string) error
}

type awsMediaS3Client struct {
	client    *s3.Client
	presigner *s3.PresignClient
	bucket    string
}

func (c *awsMediaS3Client) PresignPut(ctx context.Context, key, contentType string, expiry time.Duration) (string, error) {
	out, err := c.presigner.PresignPutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(c.bucket),
		Key:         aws.String(key),
		ContentType: aws.String(contentType),
	}, s3.WithPresignExpires(expiry))
	if err != nil {
		return "", err
	}
	return out.URL, nil
}

func (c *awsMediaS3Client) PresignGet(ctx context.Context, key string, expiry time.Duration) (string, error) {
	out, err := c.presigner.PresignGetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(c.bucket),
		Key:    aws.String(key),
	}, s3.WithPresignExpires(expiry))
	if err != nil {
		return "", err
	}
	return out.URL, nil
}

func (c *awsMediaS3Client) Head(ctx context.Context, key string) (*mediaObjectMeta, error) {
	out, err := c.client.HeadObject(ctx, &s3.HeadObjectInput{
		Bucket: aws.String(c.bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		return nil, err
	}
	meta := &mediaObjectMeta{}
	if out.ContentType != nil {
		meta.ContentType = *out.ContentType
	}
	if out.ContentLength != nil {
		meta.SizeBytes = *out.ContentLength
	}
	return meta, nil
}

func (c *awsMediaS3Client) Put(ctx context.Context, key, contentType string, body io.Reader, size int64) error {
	input := &s3.PutObjectInput{
		Bucket: aws.String(c.bucket),
		Key:    aws.String(key),
		Body:   body,
	}
	if contentType != "" {
		input.ContentType = aws.String(contentType)
	}
	if size > 0 {
		input.ContentLength = aws.Int64(size)
	}
	_, err := c.client.PutObject(ctx, input)
	return err
}

func (c *awsMediaS3Client) Delete(ctx context.Context, key string) error {
	_, err := c.client.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: aws.String(c.bucket),
		Key:    aws.String(key),
	})
	return err
}

func (c *awsMediaS3Client) Copy(ctx context.Context, srcKey, dstKey string) error {
	_, err := c.client.CopyObject(ctx, &s3.CopyObjectInput{
		Bucket:     aws.String(c.bucket),
		CopySource: aws.String(url.PathEscape(c.bucket + "/" + srcKey)),
		Key:        aws.String(dstKey),
	})
	return err
}

var (
	mediaConfigOnce sync.Once
	mediaConfig     MediaStorageConfig
	mediaClientOnce sync.Once
	mediaClient     mediaS3API
	mediaClientErr  error
)

// LoadMediaStorageConfig 返回进程内缓存的媒体存储配置。
func LoadMediaStorageConfig() MediaStorageConfig {
	mediaConfigOnce.Do(func() {
		mediaConfig = readMediaStorageConfig()
	})
	return mediaConfig
}

// ResetMediaStorageConfigForTest 清空配置与客户端缓存（仅测试使用）。
func ResetMediaStorageConfigForTest() {
	mediaConfigOnce = sync.Once{}
	mediaClientOnce = sync.Once{}
	mediaConfig = MediaStorageConfig{}
	mediaClient = nil
	mediaClientErr = nil
}

// SetMediaS3ClientForTest 注入假 S3 客户端，并标记 once 已完成（仅测试使用）。
func SetMediaS3ClientForTest(client mediaS3API, err error) {
	mediaClientOnce.Do(func() {})
	mediaClient = client
	mediaClientErr = err
}

func readMediaStorageConfig() MediaStorageConfig {
	return MediaStorageConfig{
		Enabled:        common.GetEnvOrDefaultBool("MEDIA_UPLOAD_ENABLED", false),
		Bucket:         strings.TrimSpace(os.Getenv("MEDIA_S3_BUCKET")),
		Endpoint:       strings.TrimSpace(os.Getenv("MEDIA_S3_ENDPOINT")),
		PublicEndpoint: strings.TrimSpace(os.Getenv("MEDIA_S3_PUBLIC_ENDPOINT")),
		Region:         common.GetEnvOrDefaultString("MEDIA_S3_REGION", defaultMediaRegion),
		AccessKey:      strings.TrimSpace(os.Getenv("MEDIA_S3_ACCESS_KEY")),
		SecretKey:      strings.TrimSpace(os.Getenv("MEDIA_S3_SECRET_KEY")),
		ForcePathStyle: common.GetEnvOrDefaultBool("MEDIA_S3_FORCE_PATH_STYLE", false),
		KeyPrefix:      strings.Trim(common.GetEnvOrDefaultString("MEDIA_S3_KEY_PREFIX", defaultMediaKeyPrefix), "/"),
		MaxImageMB:     common.GetEnvOrDefault("MEDIA_UPLOAD_MAX_IMAGE_MB", defaultMediaMaxImageMB),
		MaxAudioMB:     common.GetEnvOrDefault("MEDIA_UPLOAD_MAX_AUDIO_MB", defaultMediaMaxAudioMB),
		MaxVideoMB:     common.GetEnvOrDefault("MEDIA_UPLOAD_MAX_VIDEO_MB", defaultMediaMaxVideoMB),
		MaxDocumentMB:  common.GetEnvOrDefault("MEDIA_UPLOAD_MAX_DOCUMENT_MB", defaultMediaMaxDocumentMB),
		DailyBytes:     getEnvOrDefaultInt64("MEDIA_UPLOAD_DAILY_BYTES", defaultMediaDailyBytes),
	}
}

func getEnvOrDefaultInt64(env string, defaultValue int64) int64 {
	raw := os.Getenv(env)
	if raw == "" {
		return defaultValue
	}
	n, err := strconv.ParseInt(raw, 10, 64)
	if err != nil {
		common.SysError(fmt.Sprintf("failed to parse %s: %s, using default value: %d", env, err.Error(), defaultValue))
		return defaultValue
	}
	return n
}

// IsReady 表示上传功能已开启且具备最小配置。
// AccessKey/SecretKey 可为空，此时走 AWS 默认凭证链（如 IAM Role）；
// OSS / MinIO / R2 建议显式配置密钥。
func (cfg MediaStorageConfig) IsReady() bool {
	return cfg.Enabled && cfg.Bucket != "" && cfg.Region != ""
}

// HasStaticCredentials 是否配置了静态访问密钥。
func (cfg MediaStorageConfig) HasStaticCredentials() bool {
	return cfg.AccessKey != "" && cfg.SecretKey != ""
}

func (cfg MediaStorageConfig) MaxBytesForCategory(category string) int64 {
	var mb int
	switch category {
	case MediaCategoryImage:
		mb = cfg.MaxImageMB
	case MediaCategoryAudio:
		mb = cfg.MaxAudioMB
	case MediaCategoryVideo:
		mb = cfg.MaxVideoMB
	case MediaCategoryDocument:
		mb = cfg.MaxDocumentMB
	default:
		return 0
	}
	if mb <= 0 {
		return 0
	}
	return int64(mb) * 1024 * 1024
}

// MediaUploadConfigResponse 组装给前端的非密钥配置。
func MediaUploadConfigResponse() dto.MediaUploadConfigResponse {
	cfg := LoadMediaStorageConfig()
	return dto.MediaUploadConfigResponse{
		Enabled:           cfg.IsReady(),
		MaxImageMB:        cfg.MaxImageMB,
		MaxAudioMB:        cfg.MaxAudioMB,
		MaxVideoMB:        cfg.MaxVideoMB,
		MaxDocumentMB:     cfg.MaxDocumentMB,
		DailyBytes:        cfg.DailyBytes,
		AllowedCategories: []string{MediaCategoryImage, MediaCategoryAudio, MediaCategoryVideo, MediaCategoryDocument},
		PutURLExpirySec:   int(mediaPutURLExpiry / time.Second),
		GetURLExpirySec:   int(mediaGetURLExpiry / time.Second),
	}
}

func getMediaS3Client() (mediaS3API, error) {
	mediaClientOnce.Do(func() {
		cfg := LoadMediaStorageConfig()
		if !cfg.IsReady() {
			mediaClientErr = ErrMediaUploadDisabled
			return
		}
		client, err := newAWSMediaS3Client(cfg)
		if err != nil {
			mediaClientErr = err
			return
		}
		mediaClient = client
	})
	return mediaClient, mediaClientErr
}

func newAWSMediaS3Client(cfg MediaStorageConfig) (*awsMediaS3Client, error) {
	var awsCfg aws.Config
	if cfg.HasStaticCredentials() {
		awsCfg = aws.Config{
			Region:      cfg.Region,
			Credentials: credentials.NewStaticCredentialsProvider(cfg.AccessKey, cfg.SecretKey, ""),
		}
	} else {
		loaded, err := config.LoadDefaultConfig(context.Background(), config.WithRegion(cfg.Region))
		if err != nil {
			return nil, fmt.Errorf("load default aws credentials: %w", err)
		}
		awsCfg = loaded
	}

	client := s3.NewFromConfig(awsCfg, func(o *s3.Options) {
		if cfg.Endpoint != "" {
			o.BaseEndpoint = aws.String(cfg.Endpoint)
		}
		o.UsePathStyle = cfg.ForcePathStyle
	})
	presignClient := client
	if cfg.PublicEndpoint != "" {
		presignClient = s3.NewFromConfig(awsCfg, func(o *s3.Options) {
			o.BaseEndpoint = aws.String(cfg.PublicEndpoint)
			o.UsePathStyle = cfg.ForcePathStyle
		})
	}
	return &awsMediaS3Client{
		client:    client,
		presigner: s3.NewPresignClient(presignClient),
		bucket:    cfg.Bucket,
	}, nil
}

// ClassifyMediaContentType 将 MIME 归类为 image/audio/video/document，无法识别则返回空串。
func ClassifyMediaContentType(contentType string) string {
	ct := strings.ToLower(strings.TrimSpace(contentType))
	if ct == "" {
		return ""
	}
	if i := strings.IndexByte(ct, ';'); i >= 0 {
		ct = strings.TrimSpace(ct[:i])
	}
	switch {
	case strings.HasPrefix(ct, "image/"):
		return MediaCategoryImage
	case strings.HasPrefix(ct, "audio/"):
		return MediaCategoryAudio
	case strings.HasPrefix(ct, "video/"):
		return MediaCategoryVideo
	case ct == "application/pdf",
		strings.HasPrefix(ct, "text/"),
		strings.HasPrefix(ct, "application/vnd."):
		return MediaCategoryDocument
	default:
		return ""
	}
}

// SanitizeMediaFilename 校验客户端文件名，返回安全的基础名。
func SanitizeMediaFilename(filename string) (string, error) {
	name := strings.TrimSpace(filename)
	// 统一分隔符，确保各平台都能剥掉路径穿越。
	name = strings.ReplaceAll(name, "\\", "/")
	name = path.Base(name)
	if name == "" || name == "." || name == ".." {
		return "", fmt.Errorf("%w: invalid filename", ErrMediaUploadValidation)
	}
	if strings.Contains(name, "..") || strings.ContainsAny(name, `/\`) {
		return "", fmt.Errorf("%w: invalid filename", ErrMediaUploadValidation)
	}
	if len(name) > maxMediaFilenameLen {
		return "", fmt.Errorf("%w: filename too long", ErrMediaUploadValidation)
	}
	ext := strings.ToLower(path.Ext(name))
	if ext == "" || ext == "." {
		return "", fmt.Errorf("%w: filename must include an extension", ErrMediaUploadValidation)
	}
	return name, nil
}

// GenerateMediaObjectKey 仅由服务端生成对象键。
// 格式：{prefix}/{userId}/{YYYY}/{MM}/{DD}/{uuid}{ext}
func GenerateMediaObjectKey(prefix string, userId int, filename string, now time.Time) (string, error) {
	if userId <= 0 {
		return "", fmt.Errorf("%w: invalid user id", ErrMediaUploadValidation)
	}
	safeName, err := SanitizeMediaFilename(filename)
	if err != nil {
		return "", err
	}
	ext := strings.ToLower(path.Ext(safeName))
	p := strings.Trim(prefix, "/")
	if p == "" {
		p = defaultMediaKeyPrefix
	}
	day := now.Format("2006/01/02")
	return fmt.Sprintf("%s/%d/%s/%s%s", p, userId, day, uuid.NewString(), ext), nil
}

// ValidateMediaUploadRequest 校验 MIME 分类与声明大小是否符合上限。
func ValidateMediaUploadRequest(cfg MediaStorageConfig, filename, contentType string, sizeBytes int64) (category string, safeName string, err error) {
	safeName, err = SanitizeMediaFilename(filename)
	if err != nil {
		return "", "", err
	}
	category = ClassifyMediaContentType(contentType)
	if category == "" {
		return "", "", fmt.Errorf("%w: content_type must be image/*, audio/*, or video/*", ErrMediaUploadValidation)
	}
	if sizeBytes <= 0 {
		return "", "", fmt.Errorf("%w: size_bytes must be positive", ErrMediaUploadValidation)
	}
	if sizeBytes > maxMediaDeclaredSizeBytes {
		return "", "", fmt.Errorf("%w: size_bytes exceeds hard limit", ErrMediaUploadValidation)
	}
	maxBytes := cfg.MaxBytesForCategory(category)
	if maxBytes <= 0 || sizeBytes > maxBytes {
		return "", "", fmt.Errorf("%w: %s size exceeds limit of %d MB", ErrMediaUploadValidation, category, maxBytes/(1024*1024))
	}
	return category, safeName, nil
}

func contentTypesCompatible(declared, actual string) bool {
	declaredCat := ClassifyMediaContentType(declared)
	actualCat := ClassifyMediaContentType(actual)
	if declaredCat == "" || actualCat == "" {
		return false
	}
	return declaredCat == actualCat
}

// InitiateMediaUpload 校验请求、占用当日额度、创建 pending 记录，并返回 10 分钟预签名 PUT URL。
func InitiateMediaUpload(ctx context.Context, userId int, req dto.MediaUploadInitiateRequest) (*dto.MediaUploadInitiateResponse, error) {
	cfg := LoadMediaStorageConfig()
	if !cfg.IsReady() {
		return nil, ErrMediaUploadDisabled
	}

	category, safeName, err := ValidateMediaUploadRequest(cfg, req.Filename, req.ContentType, req.SizeBytes)
	if err != nil {
		return nil, err
	}

	used, err := model.SumMediaUploadBytesForUserToday(userId)
	if err != nil {
		return nil, err
	}
	if used > cfg.DailyBytes || req.SizeBytes > cfg.DailyBytes-used {
		return nil, ErrMediaUploadQuota
	}

	objectKey, err := GenerateMediaObjectKey(cfg.KeyPrefix, userId, safeName, time.Now())
	if err != nil {
		return nil, err
	}

	client, err := getMediaS3Client()
	if err != nil {
		return nil, err
	}

	contentType := strings.TrimSpace(req.ContentType)
	if i := strings.IndexByte(contentType, ';'); i >= 0 {
		contentType = strings.TrimSpace(contentType[:i])
	}
	putURL, err := client.PresignPut(ctx, objectKey, contentType, mediaPutURLExpiry)
	if err != nil {
		return nil, fmt.Errorf("failed to presign put url: %w", err)
	}

	uploadId := uuid.NewString()
	now := time.Now()
	expiresAt := now.Add(mediaPutURLExpiry).Unix()
	record := &model.MediaUpload{
		UploadId:     uploadId,
		UserId:       userId,
		ObjectKey:    objectKey,
		Filename:     safeName,
		ContentType:  contentType,
		Category:     category,
		DeclaredSize: req.SizeBytes,
		Status:       model.MediaUploadStatusPending,
		CreatedAt:    now.Unix(),
		UpdatedAt:    now.Unix(),
		ExpiresAt:    expiresAt,
	}
	if err := model.CreateMediaUpload(record); err != nil {
		return nil, err
	}

	return &dto.MediaUploadInitiateResponse{
		UploadId:  uploadId,
		ObjectKey: objectKey,
		PutURL:    putURL,
		Headers: map[string]string{
			"Content-Type": contentType,
		},
		ExpiresAt: expiresAt,
		Category:  category,
	}, nil
}

// CompleteMediaUpload 对对象做 HEAD 校验（大小/MIME），成功后返回 24 小时预签名 GET URL；
// 校验失败会删除对象并将记录标为 failed。
func CompleteMediaUpload(ctx context.Context, userId int, uploadId string) (*dto.MediaUploadCompleteResponse, error) {
	cfg := LoadMediaStorageConfig()
	if !cfg.IsReady() {
		return nil, ErrMediaUploadDisabled
	}
	uploadId = strings.TrimSpace(uploadId)
	if uploadId == "" {
		return nil, fmt.Errorf("%w: upload_id is required", ErrMediaUploadValidation)
	}

	record, err := model.GetMediaUploadByUploadIdForUser(uploadId, userId)
	if err != nil {
		return nil, err
	}
	if record == nil {
		return nil, ErrMediaUploadNotFound
	}
	if record.Status != model.MediaUploadStatusPending {
		return nil, ErrMediaUploadBadStatus
	}
	if record.ExpiresAt > 0 && time.Now().Unix() > record.ExpiresAt {
		client, clientErr := getMediaS3Client()
		if clientErr != nil {
			client = nil
		}
		_ = markMediaUploadFailedAndDelete(ctx, client, record)
		return nil, fmt.Errorf("%w: upload put url expired", ErrMediaUploadValidation)
	}

	client, err := getMediaS3Client()
	if err != nil {
		return nil, err
	}

	meta, err := client.Head(ctx, record.ObjectKey)
	if err != nil {
		_ = markMediaUploadFailedAndDelete(ctx, client, record)
		return nil, fmt.Errorf("uploaded object not found or inaccessible: %w", err)
	}

	maxBytes := cfg.MaxBytesForCategory(record.Category)
	if meta.SizeBytes <= 0 || meta.SizeBytes > maxBytes {
		_ = markMediaUploadFailedAndDelete(ctx, client, record)
		return nil, fmt.Errorf("%w: object size is invalid or exceeds limit", ErrMediaUploadValidation)
	}
	// 实际大小不得大于声明大小，防止超额占用。
	if meta.SizeBytes > record.DeclaredSize {
		_ = markMediaUploadFailedAndDelete(ctx, client, record)
		return nil, fmt.Errorf("%w: object size exceeds declared size", ErrMediaUploadValidation)
	}
	if !contentTypesCompatible(record.ContentType, meta.ContentType) {
		_ = markMediaUploadFailedAndDelete(ctx, client, record)
		return nil, fmt.Errorf("%w: object content type mismatch", ErrMediaUploadValidation)
	}

	// 完成时二次校验日额度：used 含本条 pending 的 declared，换成 actual 后再比
	used, err := model.SumMediaUploadBytesForUserToday(userId)
	if err != nil {
		return nil, err
	}
	otherUsed := used - record.DeclaredSize
	if otherUsed < 0 {
		otherUsed = 0
	}
	if otherUsed > cfg.DailyBytes || meta.SizeBytes > cfg.DailyBytes-otherUsed {
		_ = markMediaUploadFailedAndDelete(ctx, client, record)
		return nil, ErrMediaUploadQuota
	}

	getURL, err := client.PresignGet(ctx, record.ObjectKey, mediaGetURLExpiry)
	if err != nil {
		return nil, fmt.Errorf("failed to presign get url: %w", err)
	}

	now := time.Now()
	record.ActualSize = meta.SizeBytes
	if meta.ContentType != "" {
		record.ContentType = meta.ContentType
	}
	record.Status = model.MediaUploadStatusCompleted
	record.CompletedAt = now.Unix()
	if err := model.UpdateMediaUpload(record); err != nil {
		return nil, err
	}

	return &dto.MediaUploadCompleteResponse{
		UploadId:    record.UploadId,
		ObjectKey:   record.ObjectKey,
		GetURL:      getURL,
		ContentType: record.ContentType,
		SizeBytes:   record.ActualSize,
		Category:    record.Category,
		Filename:    record.Filename,
		ExpiresAt:   now.Add(mediaGetURLExpiry).Unix(),
	}, nil
}

func markMediaUploadFailedAndDelete(ctx context.Context, client mediaS3API, record *model.MediaUpload) error {
	if client != nil && record.ObjectKey != "" {
		_ = client.Delete(ctx, record.ObjectKey)
	}
	record.Status = model.MediaUploadStatusFailed
	return model.UpdateMediaUpload(record)
}
