package service

import (
	"errors"
	"net/url"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/dto"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGenerateMediaObjectKeyPathIsolation(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 8, 5, 12, 0, 0, 0, time.UTC)
	keyA, err := GenerateMediaObjectKey("media-uploads", 7, "frame.png", now)
	require.NoError(t, err)
	keyB, err := GenerateMediaObjectKey("media-uploads", 8, "frame.png", now)
	require.NoError(t, err)

	assert.True(t, strings.HasPrefix(keyA, "media-uploads/7/2026/08/05/"))
	assert.True(t, strings.HasPrefix(keyB, "media-uploads/8/2026/08/05/"))
	assert.True(t, strings.HasSuffix(keyA, ".png"))
	assert.NotEqual(t, keyA, keyB)
	assert.NotContains(t, keyA, "..")
	assert.NotContains(t, keyA, "frame.png")

	_, err = GenerateMediaObjectKey("media-uploads", 1, "../etc/passwd", now)
	require.Error(t, err)
	assert.ErrorIs(t, err, ErrMediaUploadValidation)

	_, err = GenerateMediaObjectKey("media-uploads", 1, "noext", now)
	require.Error(t, err)

	_, err = GenerateMediaObjectKey("media-uploads", 0, "a.png", now)
	require.Error(t, err)
}

func TestSanitizeMediaFilenameRejectsPathTraversal(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		input   string
		wantErr bool
		want    string
	}{
		{name: "plain", input: "photo.jpg", want: "photo.jpg"},
		{name: "nested path uses base", input: "a/b/c.mp4", want: "c.mp4"},
		{name: "windows path uses base", input: `a\b\c.wav`, want: "c.wav"},
		{name: "empty", input: "   ", wantErr: true},
		{name: "dotdot", input: "..", wantErr: true},
		{name: "no extension", input: "readme", wantErr: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			got, err := SanitizeMediaFilename(tt.input)
			if tt.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
			assert.Equal(t, tt.want, got)
		})
	}
}

func TestValidateMediaUploadRequestMIMEAndSize(t *testing.T) {
	t.Parallel()

	cfg := MediaStorageConfig{
		MaxImageMB:    20,
		MaxAudioMB:    100,
		MaxVideoMB:    500,
		MaxDocumentMB: 20,
	}

	tests := []struct {
		name        string
		filename    string
		contentType string
		sizeBytes   int64
		wantCat     string
		wantErr     bool
	}{
		{
			name:        "image ok",
			filename:    "a.png",
			contentType: "image/png",
			sizeBytes:   1024,
			wantCat:     MediaCategoryImage,
		},
		{
			name:        "audio ok with charset param",
			filename:    "a.mp3",
			contentType: "audio/mpeg; charset=binary",
			sizeBytes:   1024,
			wantCat:     MediaCategoryAudio,
		},
		{
			name:        "video over limit",
			filename:    "a.mp4",
			contentType: "video/mp4",
			sizeBytes:   int64(501) * 1024 * 1024,
			wantErr:     true,
		},
		{
			name:        "pdf document ok",
			filename:    "a.pdf",
			contentType: "application/pdf",
			sizeBytes:   1024,
			wantCat:     MediaCategoryDocument,
		},
		{
			name:        "unsupported mime",
			filename:    "a.bin",
			contentType: "application/octet-stream",
			sizeBytes:   10,
			wantErr:     true,
		},
		{
			name:        "zero size",
			filename:    "a.png",
			contentType: "image/png",
			sizeBytes:   0,
			wantErr:     true,
		},
		{
			name:        "negative size",
			filename:    "a.png",
			contentType: "image/png",
			sizeBytes:   -1,
			wantErr:     true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			cat, _, err := ValidateMediaUploadRequest(cfg, tt.filename, tt.contentType, tt.sizeBytes)
			if tt.wantErr {
				require.Error(t, err)
				assert.True(t, errors.Is(err, ErrMediaUploadValidation))
				return
			}
			require.NoError(t, err)
			assert.Equal(t, tt.wantCat, cat)
		})
	}
}

func TestContentTypesCompatibleSameCategory(t *testing.T) {
	t.Parallel()
	assert.True(t, contentTypesCompatible("image/png", "image/jpeg"))
	assert.True(t, contentTypesCompatible("video/mp4", "video/webm"))
	assert.False(t, contentTypesCompatible("image/png", "video/mp4"))
	assert.False(t, contentTypesCompatible("image/png", "application/octet-stream"))
}

func TestMediaUploadConfigDisabledByDefault(t *testing.T) {
	ResetMediaStorageConfigForTest()
	t.Cleanup(ResetMediaStorageConfigForTest)

	_ = os.Unsetenv("MEDIA_UPLOAD_ENABLED")
	_ = os.Unsetenv("MEDIA_S3_BUCKET")
	_ = os.Unsetenv("MEDIA_S3_ACCESS_KEY")
	_ = os.Unsetenv("MEDIA_S3_SECRET_KEY")

	cfg := readMediaStorageConfig()
	assert.False(t, cfg.Enabled)
	assert.False(t, cfg.IsReady())

	resp := MediaUploadConfigResponse()
	assert.False(t, resp.Enabled)
	assert.Equal(t, defaultMediaMaxImageMB, resp.MaxImageMB)
	assert.Equal(t, defaultMediaDailyBytes, resp.DailyBytes)

	_, err := InitiateMediaUpload(t.Context(), 1, dto.MediaUploadInitiateRequest{
		Filename:    "a.png",
		ContentType: "image/png",
		SizeBytes:   100,
	})
	require.Error(t, err)
	assert.ErrorIs(t, err, ErrMediaUploadDisabled)
}

func TestMediaUploadConfigReadyWithoutStaticCredentials(t *testing.T) {
	ResetMediaStorageConfigForTest()
	t.Cleanup(func() {
		_ = os.Unsetenv("MEDIA_UPLOAD_ENABLED")
		_ = os.Unsetenv("MEDIA_S3_BUCKET")
		ResetMediaStorageConfigForTest()
	})

	t.Setenv("MEDIA_UPLOAD_ENABLED", "true")
	t.Setenv("MEDIA_S3_BUCKET", "test-bucket")
	// 无静态密钥时仍可就绪，运行时走默认凭证链（IAM 等）

	cfg := readMediaStorageConfig()
	assert.True(t, cfg.Enabled)
	assert.True(t, cfg.IsReady())
	assert.False(t, cfg.HasStaticCredentials())
	assert.True(t, MediaUploadConfigResponse().Enabled)
}

func TestMediaS3PresignerUsesPublicEndpoint(t *testing.T) {
	t.Parallel()

	client, err := newAWSMediaS3Client(MediaStorageConfig{
		Bucket:         "media-uploads",
		Endpoint:       "http://minio:9000",
		PublicEndpoint: "http://localhost:9000",
		Region:         "us-east-1",
		AccessKey:      "test-access-key",
		SecretKey:      "test-secret-key",
		ForcePathStyle: true,
	})
	require.NoError(t, err)

	signed, err := client.PresignPut(t.Context(), "media-uploads/1/a.png", "image/png", time.Minute)
	require.NoError(t, err)
	parsed, err := url.Parse(signed)
	require.NoError(t, err)
	assert.Equal(t, "localhost:9000", parsed.Host)
	assert.Contains(t, parsed.Path, "/media-uploads/media-uploads/1/a.png")
}
