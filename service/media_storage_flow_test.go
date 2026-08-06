package service

import (
	"context"
	"io"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

type mediaCopyCall struct {
	src string
	dst string
}

type fakeMediaS3 struct {
	putURL    string
	getURL    string
	meta      *mediaObjectMeta
	headErr   error
	putErr    error
	putKeys   []string
	deleted   []string
	copyOK    bool
	copyErr   error
	copyCalls []mediaCopyCall
}

func (f *fakeMediaS3) PresignPut(ctx context.Context, key, contentType string, expiry time.Duration) (string, error) {
	return f.putURL, nil
}

func (f *fakeMediaS3) PresignGet(ctx context.Context, key string, expiry time.Duration) (string, error) {
	return f.getURL, nil
}

func (f *fakeMediaS3) Head(ctx context.Context, key string) (*mediaObjectMeta, error) {
	if f.headErr != nil {
		return nil, f.headErr
	}
	return f.meta, nil
}

func (f *fakeMediaS3) Put(ctx context.Context, key, contentType string, body io.Reader, size int64) error {
	if body != nil {
		_, _ = io.Copy(io.Discard, body)
	}
	f.putKeys = append(f.putKeys, key)
	return f.putErr
}

func (f *fakeMediaS3) Delete(ctx context.Context, key string) error {
	f.deleted = append(f.deleted, key)
	return nil
}

func (f *fakeMediaS3) Copy(ctx context.Context, srcKey, dstKey string) error {
	f.copyCalls = append(f.copyCalls, mediaCopyCall{src: srcKey, dst: dstKey})
	if f.copyErr != nil {
		return f.copyErr
	}
	return nil
}

func setupMediaUploadDB(t *testing.T) {
	t.Helper()
	previous := model.DB
	db, err := gorm.Open(sqlite.Open("file:media_upload_service?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.MediaUpload{}))
	model.DB = db
	t.Cleanup(func() {
		model.DB = previous
	})
}

func TestInitiateAndCompleteMediaUploadHappyPath(t *testing.T) {
	setupMediaUploadDB(t)
	ResetMediaStorageConfigForTest()
	t.Cleanup(ResetMediaStorageConfigForTest)

	t.Setenv("MEDIA_UPLOAD_ENABLED", "true")
	t.Setenv("MEDIA_S3_BUCKET", "bucket")
	t.Setenv("MEDIA_S3_ACCESS_KEY", "ak")
	t.Setenv("MEDIA_S3_SECRET_KEY", "sk")
	t.Setenv("MEDIA_S3_REGION", "us-east-1")

	fake := &fakeMediaS3{
		putURL: "https://s3.example/put",
		getURL: "https://s3.example/get",
		meta:   &mediaObjectMeta{ContentType: "image/png", SizeBytes: 120},
	}
	SetMediaS3ClientForTest(fake, nil)

	initResp, err := InitiateMediaUpload(t.Context(), 42, dto.MediaUploadInitiateRequest{
		Filename:    "frame.png",
		ContentType: "image/png",
		SizeBytes:   120,
	})
	require.NoError(t, err)
	require.NotNil(t, initResp)
	assert.Equal(t, "https://s3.example/put", initResp.PutURL)
	assert.Equal(t, "image/png", initResp.Headers["Content-Type"])
	assert.Contains(t, initResp.ObjectKey, "media-uploads/42/")

	completeResp, err := CompleteMediaUpload(t.Context(), 42, initResp.UploadId)
	require.NoError(t, err)
	require.NotNil(t, completeResp)
	assert.Equal(t, "https://s3.example/get", completeResp.GetURL)
	assert.Equal(t, int64(120), completeResp.SizeBytes)

	// Cross-user complete must fail
	_, err = CompleteMediaUpload(t.Context(), 99, initResp.UploadId)
	require.Error(t, err)
	assert.ErrorIs(t, err, ErrMediaUploadNotFound)
}

func TestCompleteMediaUploadRejectsOversizedObjectAndDeletes(t *testing.T) {
	setupMediaUploadDB(t)
	ResetMediaStorageConfigForTest()
	t.Cleanup(ResetMediaStorageConfigForTest)

	t.Setenv("MEDIA_UPLOAD_ENABLED", "true")
	t.Setenv("MEDIA_S3_BUCKET", "bucket")
	t.Setenv("MEDIA_S3_ACCESS_KEY", "ak")
	t.Setenv("MEDIA_S3_SECRET_KEY", "sk")

	fake := &fakeMediaS3{
		putURL: "https://s3.example/put",
		getURL: "https://s3.example/get",
		meta:   &mediaObjectMeta{ContentType: "image/png", SizeBytes: 500},
	}
	SetMediaS3ClientForTest(fake, nil)

	initResp, err := InitiateMediaUpload(t.Context(), 7, dto.MediaUploadInitiateRequest{
		Filename:    "frame.png",
		ContentType: "image/png",
		SizeBytes:   120,
	})
	require.NoError(t, err)

	_, err = CompleteMediaUpload(t.Context(), 7, initResp.UploadId)
	require.Error(t, err)
	assert.ErrorIs(t, err, ErrMediaUploadValidation)
	assert.Equal(t, []string{initResp.ObjectKey}, fake.deleted)

	row, err := model.GetMediaUploadByUploadIdForUser(initResp.UploadId, 7)
	require.NoError(t, err)
	require.NotNil(t, row)
	assert.Equal(t, model.MediaUploadStatusFailed, row.Status)
}
