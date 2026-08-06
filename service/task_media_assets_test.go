package service

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupPromoteTaskMediaAssetsTest(t *testing.T) *fakeMediaS3 {
	t.Helper()
	ResetMediaStorageConfigForTest()
	t.Cleanup(ResetMediaStorageConfigForTest)

	fake := &fakeMediaS3{}
	SetMediaS3ClientForTest(fake, nil)
	t.Cleanup(func() { SetMediaS3ClientForTest(nil, nil) })
	return fake
}

func TestGenerateMediaTaskAssetObjectKey(t *testing.T) {
	key, err := GenerateMediaTaskAssetObjectKey(7, "task_abc", 0, ".png")
	require.NoError(t, err)
	assert.Equal(t, "media-task-assets/7/task_abc/0.png", key)

	_, err = GenerateMediaTaskAssetObjectKey(0, "task_abc", 0, ".png")
	assert.Error(t, err)
}

func TestPromoteTaskMediaAssetsRewritesObjectKeys(t *testing.T) {
	fake := setupPromoteTaskMediaAssetsTest(t)

	input := `{"prompt":"x","metadata":{"input":{"media":[{"type":"first_frame","url":"https://x","object_key":"media-uploads/7/2026/08/06/a.png"}]}}}`
	out, err := PromoteTaskMediaAssets(context.Background(), 7, "task_abc", input)
	require.NoError(t, err)
	assert.Contains(t, out, "media-task-assets/7/task_abc/0.png")
	assert.Len(t, fake.copyCalls, 1)
	assert.True(t, strings.HasPrefix(fake.copyCalls[0].dst, "media-task-assets/"))
}

func TestPromoteTaskMediaAssetsNoMediaReturnsSame(t *testing.T) {
	setupPromoteTaskMediaAssetsTest(t)

	in := `{"prompt":"only text"}`
	out, err := PromoteTaskMediaAssets(context.Background(), 1, "task_x", in)
	require.NoError(t, err)
	assert.JSONEq(t, in, out)
}

func TestPromoteTaskMediaAssetsSkipsForeignUserKey(t *testing.T) {
	fake := setupPromoteTaskMediaAssetsTest(t)

	input := `{"prompt":"x","metadata":{"input":{"media":[{"type":"first_frame","url":"https://x","object_key":"media-uploads/99/2026/08/06/a.png"}]}}}`
	out, err := PromoteTaskMediaAssets(context.Background(), 7, "task_abc", input)
	require.NoError(t, err)
	assert.Equal(t, input, out)
	assert.Empty(t, fake.copyCalls)
	assert.NotContains(t, out, "media-task-assets/")
}

func TestPromoteTaskMediaAssetsSkipsAlreadyPromotedKey(t *testing.T) {
	fake := setupPromoteTaskMediaAssetsTest(t)

	input := `{"metadata":{"input":{"media":[{"type":"first_frame","url":"https://x","object_key":"media-task-assets/7/task_old/0.png"}]}}}`
	out, err := PromoteTaskMediaAssets(context.Background(), 7, "task_abc", input)
	require.NoError(t, err)
	assert.Equal(t, input, out)
	assert.Empty(t, fake.copyCalls)
}

func TestPromoteTaskMediaAssetsCopyFailureKeepsOriginalKey(t *testing.T) {
	ResetMediaStorageConfigForTest()
	t.Cleanup(ResetMediaStorageConfigForTest)

	fake := &fakeMediaS3{copyErr: errors.New("copy failed")}
	SetMediaS3ClientForTest(fake, nil)
	t.Cleanup(func() { SetMediaS3ClientForTest(nil, nil) })

	input := `{"prompt":"x","metadata":{"input":{"media":[{"type":"first_frame","url":"https://x","object_key":"media-uploads/7/2026/08/06/a.png"}]}}}`
	out, err := PromoteTaskMediaAssets(context.Background(), 7, "task_abc", input)
	require.NoError(t, err)
	assert.Equal(t, input, out)
	assert.Len(t, fake.copyCalls, 1)
}

func TestPromoteTaskMediaAssetsPartialCopyKeepsSuccessfulRewrites(t *testing.T) {
	ResetMediaStorageConfigForTest()
	t.Cleanup(ResetMediaStorageConfigForTest)

	failSrc := "media-uploads/7/2026/08/06/b.png"
	fake := &fakeMediaS3{
		copyErrBySrc: map[string]error{
			failSrc: errors.New("copy failed"),
		},
	}
	SetMediaS3ClientForTest(fake, nil)
	t.Cleanup(func() { SetMediaS3ClientForTest(nil, nil) })

	input := `{"prompt":"x","metadata":{"input":{"media":[{"type":"first_frame","url":"https://x","object_key":"media-uploads/7/2026/08/06/a.png"},{"type":"last_frame","url":"https://y","object_key":"media-uploads/7/2026/08/06/b.png"}]}}}`
	out, err := PromoteTaskMediaAssets(context.Background(), 7, "task_abc", input)
	require.NoError(t, err)
	assert.Contains(t, out, "media-task-assets/7/task_abc/0.png")
	assert.Contains(t, out, failSrc)
	assert.NotContains(t, out, "media-task-assets/7/task_abc/1.png")
	assert.Len(t, fake.copyCalls, 2)
}

func TestPromoteTaskMediaAssetsS3DisabledReturnsOriginal(t *testing.T) {
	ResetMediaStorageConfigForTest()
	t.Cleanup(ResetMediaStorageConfigForTest)

	input := `{"prompt":"x","metadata":{"input":{"media":[{"type":"first_frame","url":"https://x","object_key":"media-uploads/7/2026/08/06/a.png"}]}}}`
	out, err := PromoteTaskMediaAssets(context.Background(), 7, "task_abc", input)
	require.NoError(t, err)
	assert.Equal(t, input, out)
}
