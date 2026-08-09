package service

import (
	"context"
	"encoding/base64"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGenerateMediaResultObjectKeyUsesDateFolders(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 8, 5, 12, 0, 0, 0, time.UTC)
	key, err := GenerateMediaResultObjectKey(7, "task_abc", now, ".mp4")
	require.NoError(t, err)
	assert.True(t, strings.HasPrefix(key, "media-results/7/2026/08/05/task_abc"))
	assert.True(t, strings.HasSuffix(key, ".mp4"))

	_, err = GenerateMediaResultObjectKey(0, "task_abc", now, ".mp4")
	require.Error(t, err)
	_, err = GenerateMediaResultObjectKey(7, "", now, ".mp4")
	require.Error(t, err)
}

func TestStoreTaskResultFromURLUploadsToObjectStorage(t *testing.T) {
	ResetMediaStorageConfigForTest()
	t.Cleanup(ResetMediaStorageConfigForTest)
	InitHttpClient()

	fetchSetting := system_setting.GetFetchSetting()
	originalFetch := *fetchSetting
	t.Cleanup(func() { *fetchSetting = originalFetch })
	fetchSetting.AllowPrivateIp = true
	fetchSetting.AllowedPorts = nil

	t.Setenv("MEDIA_UPLOAD_ENABLED", "true")
	t.Setenv("MEDIA_S3_BUCKET", "bucket")
	t.Setenv("MEDIA_S3_ACCESS_KEY", "ak")
	t.Setenv("MEDIA_S3_SECRET_KEY", "sk")
	t.Setenv("MEDIA_S3_REGION", "us-east-1")

	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "video/mp4")
		_, _ = io.WriteString(w, "fake-video-bytes")
	}))
	t.Cleanup(upstream.Close)

	fake := &fakeMediaS3{getURL: "https://s3.example/signed-get"}
	SetMediaS3ClientForTest(fake, nil)

	objectKey, err := StoreTaskResultFromURL(
		context.Background(),
		11,
		"task_archive_1",
		upstream.URL+"/video.mp4",
	)
	require.NoError(t, err)
	require.Len(t, fake.putKeys, 1)
	assert.Equal(t, fake.putKeys[0], objectKey)
	assert.Equal(t, int64(len("fake-video-bytes")), fake.putSizes[0])
	assert.Contains(t, objectKey, "media-results/11/")

	task := &model.Task{
		PrivateData: model.TaskPrivateData{StoredResultKey: objectKey},
	}
	assert.Equal(t, "https://s3.example/signed-get", ResolveTaskResultURL(context.Background(), task))
}

func TestDownloadTaskResultRejectsPrivateURL(t *testing.T) {
	InitHttpClient()
	configureSSRFTestFetchSetting(t)

	_, _, err := downloadTaskResult(context.Background(), "http://127.0.0.1/secret.mp4")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "request reject")
}

func TestResolveTaskResultURLEmptyWithoutStoredKey(t *testing.T) {
	t.Parallel()
	task := &model.Task{
		PrivateData: model.TaskPrivateData{ResultURL: "https://upstream.example/a.mp4"},
	}
	assert.Equal(t, "", ResolveTaskResultURL(context.Background(), task))
}

func TestEffectiveTaskResultURLFallsBackToStoredResultURL(t *testing.T) {
	t.Parallel()
	task := &model.Task{
		PrivateData: model.TaskPrivateData{ResultURL: "https://proxy.example/v1/videos/task_x/content"},
	}
	assert.Equal(
		t,
		"https://proxy.example/v1/videos/task_x/content",
		EffectiveTaskResultURL(context.Background(), task),
	)
}

func TestStoreTaskResultFromDataURLUploadsDecodedBytes(t *testing.T) {
	ResetMediaStorageConfigForTest()
	t.Cleanup(ResetMediaStorageConfigForTest)

	t.Setenv("MEDIA_UPLOAD_ENABLED", "true")
	t.Setenv("MEDIA_S3_BUCKET", "bucket")
	t.Setenv("MEDIA_S3_ACCESS_KEY", "ak")
	t.Setenv("MEDIA_S3_SECRET_KEY", "sk")
	t.Setenv("MEDIA_S3_REGION", "us-east-1")

	fake := &fakeMediaS3{getURL: "https://s3.example/signed-get"}
	SetMediaS3ClientForTest(fake, nil)

	payload := "fake-mp4"
	dataURL := "data:video/mp4;base64," + base64.StdEncoding.EncodeToString([]byte(payload))
	objectKey, err := StoreTaskResultFromDataURL(context.Background(), 9, "task_data_1", dataURL)
	require.NoError(t, err)
	require.Len(t, fake.putKeys, 1)
	assert.Equal(t, objectKey, fake.putKeys[0])
	assert.Equal(t, int64(len(payload)), fake.putSizes[0])
	assert.Contains(t, objectKey, "media-results/9/")
}
