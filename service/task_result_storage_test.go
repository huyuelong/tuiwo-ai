package service

import (
	"context"
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

func TestArchiveTaskResultUploadsAndStoresKey(t *testing.T) {
	setupMediaUploadDB(t)
	require.NoError(t, model.DB.AutoMigrate(&model.Task{}))
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

	task := &model.Task{
		TaskID: "task_archive_1",
		UserId: 11,
		Status: model.TaskStatusSuccess,
		PrivateData: model.TaskPrivateData{
			ResultURL: upstream.URL + "/video.mp4",
		},
	}
	require.NoError(t, model.DB.Create(task).Error)

	require.NoError(t, ArchiveTaskResult(context.Background(), task.ID))
	require.Len(t, fake.putKeys, 1)
	assert.Contains(t, fake.putKeys[0], "media-results/11/")

	var reloaded model.Task
	require.NoError(t, model.DB.First(&reloaded, task.ID).Error)
	assert.Equal(t, fake.putKeys[0], reloaded.PrivateData.StoredResultKey)

	resolved := ResolveTaskResultURL(context.Background(), &reloaded)
	assert.Equal(t, "https://s3.example/signed-get", resolved)
}

func TestDownloadTaskResultRejectsPrivateURL(t *testing.T) {
	InitHttpClient()
	configureSSRFTestFetchSetting(t)

	_, _, _, err := downloadTaskResult(context.Background(), "http://127.0.0.1/secret.mp4")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "request reject")
}

func TestArchiveTaskResultSkipsWhenAlreadyStored(t *testing.T) {
	setupMediaUploadDB(t)
	require.NoError(t, model.DB.AutoMigrate(&model.Task{}))
	ResetMediaStorageConfigForTest()
	t.Cleanup(ResetMediaStorageConfigForTest)

	t.Setenv("MEDIA_UPLOAD_ENABLED", "true")
	t.Setenv("MEDIA_S3_BUCKET", "bucket")
	t.Setenv("MEDIA_S3_ACCESS_KEY", "ak")
	t.Setenv("MEDIA_S3_SECRET_KEY", "sk")

	fake := &fakeMediaS3{}
	SetMediaS3ClientForTest(fake, nil)

	task := &model.Task{
		TaskID: "task_archive_skip",
		UserId: 11,
		Status: model.TaskStatusSuccess,
		PrivateData: model.TaskPrivateData{
			ResultURL:       "https://upstream.example/a.mp4",
			StoredResultKey: "media-results/11/2026/08/05/task_archive_skip.mp4",
		},
	}
	require.NoError(t, model.DB.Create(task).Error)
	require.NoError(t, ArchiveTaskResult(context.Background(), task.ID))
	assert.Empty(t, fake.putKeys)
}

func TestResolveTaskResultURLFallsBackToUpstream(t *testing.T) {
	t.Parallel()
	task := &model.Task{
		PrivateData: model.TaskPrivateData{ResultURL: "https://upstream.example/a.mp4"},
	}
	assert.Equal(t, "https://upstream.example/a.mp4", ResolveTaskResultURL(context.Background(), task))
}
