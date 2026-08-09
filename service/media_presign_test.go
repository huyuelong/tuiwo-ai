package service

import (
	"context"
	"testing"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupPresignMediaTest(t *testing.T) {
	t.Helper()
	ResetMediaStorageConfigForTest()
	t.Cleanup(ResetMediaStorageConfigForTest)

	t.Setenv("MEDIA_UPLOAD_ENABLED", "true")
	t.Setenv("MEDIA_S3_BUCKET", "bucket")
	t.Setenv("MEDIA_S3_ACCESS_KEY", "ak")
	t.Setenv("MEDIA_S3_SECRET_KEY", "sk")
	t.Setenv("MEDIA_S3_REGION", "us-east-1")
}

func TestPresignOwnedMediaKeysRejectsForeignPrefix(t *testing.T) {
	setupPresignMediaTest(t)
	SetMediaS3ClientForTest(&fakeMediaS3{getURL: "https://s3.example/get"}, nil)

	_, err := PresignOwnedMediaKeys(context.Background(), 7, []string{"media-task-assets/8/task/0.png"})
	require.Error(t, err)
	assert.ErrorIs(t, err, ErrMediaUploadValidation)
}

func TestPresignOwnedMediaKeysAllowsTaskAssets(t *testing.T) {
	setupPresignMediaTest(t)
	expectedURL := "https://s3.example/get-task-asset"
	fake := &fakeMediaS3{getURL: expectedURL}
	SetMediaS3ClientForTest(fake, nil)

	key := "media-task-assets/7/task/0.png"
	out, err := PresignOwnedMediaKeys(context.Background(), 7, []string{key})
	require.NoError(t, err)
	assert.Equal(t, expectedURL, out[key])
}

func TestPresignOwnedMediaKeysAllowsUploadPrefix(t *testing.T) {
	setupPresignMediaTest(t)
	expectedURL := "https://s3.example/get-upload"
	SetMediaS3ClientForTest(&fakeMediaS3{getURL: expectedURL}, nil)

	key := "media-uploads/7/2026/08/06/uuid.png"
	out, err := PresignOwnedMediaKeys(context.Background(), 7, []string{key})
	require.NoError(t, err)
	assert.Equal(t, expectedURL, out[key])
}

func TestPresignOwnedMediaKeysAllowsResultPrefix(t *testing.T) {
	setupPresignMediaTest(t)
	expectedURL := "https://s3.example/get-result"
	SetMediaS3ClientForTest(&fakeMediaS3{getURL: expectedURL}, nil)

	key := "media-results/7/2026/08/09/task_abc.mp4"
	out, err := PresignOwnedMediaKeys(context.Background(), 7, []string{key})
	require.NoError(t, err)
	assert.Equal(t, expectedURL, out[key])
}

func TestPresignOwnedMediaKeysRejectsForeignResultPrefix(t *testing.T) {
	setupPresignMediaTest(t)
	SetMediaS3ClientForTest(&fakeMediaS3{getURL: "https://s3.example/get"}, nil)

	_, err := PresignOwnedMediaKeys(context.Background(), 7, []string{"media-results/8/2026/08/09/task_abc.mp4"})
	require.Error(t, err)
	assert.ErrorIs(t, err, ErrMediaUploadValidation)
}

func TestPresignOwnedMediaKeysRejectsEmptyList(t *testing.T) {
	setupPresignMediaTest(t)
	SetMediaS3ClientForTest(&fakeMediaS3{getURL: "https://s3.example/get"}, nil)

	_, err := PresignOwnedMediaKeys(context.Background(), 7, nil)
	require.Error(t, err)
	assert.ErrorIs(t, err, ErrMediaUploadValidation)
}

func TestPresignOwnedMediaKeysRejectsPathTraversal(t *testing.T) {
	setupPresignMediaTest(t)
	SetMediaS3ClientForTest(&fakeMediaS3{getURL: "https://s3.example/get"}, nil)

	_, err := PresignOwnedMediaKeys(context.Background(), 7, []string{"media-task-assets/7/../8/task/0.png"})
	require.Error(t, err)
	assert.ErrorIs(t, err, ErrMediaUploadValidation)
}

func TestResolveTaskSubmitMediaURLsRewritesMediaURL(t *testing.T) {
	setupPresignMediaTest(t)
	expectedURL := "https://s3.example/fresh-get"
	SetMediaS3ClientForTest(&fakeMediaS3{getURL: expectedURL}, nil)

	objectKey := "media-uploads/7/2026/08/06/uuid.png"
	req := &relaycommon.TaskSubmitReq{
		Metadata: map[string]interface{}{
			"input": map[string]interface{}{
				"media": []interface{}{
					map[string]interface{}{
						"type":       "first_frame",
						"url":        "https://expired.example/old",
						"object_key": objectKey,
					},
				},
			},
		},
	}

	err := ResolveTaskSubmitMediaURLs(context.Background(), 7, req)
	require.NoError(t, err)

	media := req.Metadata["input"].(map[string]interface{})["media"].([]interface{})
	item := media[0].(map[string]interface{})
	assert.Equal(t, expectedURL, item["url"])
}
