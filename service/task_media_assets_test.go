package service

import (
	"context"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGenerateMediaTaskAssetObjectKey(t *testing.T) {
	key, err := GenerateMediaTaskAssetObjectKey(7, "task_abc", 0, ".png")
	require.NoError(t, err)
	assert.Equal(t, "media-task-assets/7/task_abc/0.png", key)

	_, err = GenerateMediaTaskAssetObjectKey(0, "task_abc", 0, ".png")
	assert.Error(t, err)
}

func TestPromoteTaskMediaAssetsRewritesObjectKeys(t *testing.T) {
	fake := &fakeMediaS3{copyOK: true}
	SetMediaS3ClientForTest(fake, nil)
	t.Cleanup(func() { SetMediaS3ClientForTest(nil, nil) })

	input := `{"prompt":"x","metadata":{"input":{"media":[{"type":"first_frame","url":"https://x","object_key":"media-uploads/7/2026/08/06/a.png"}]}}}`
	out, err := PromoteTaskMediaAssets(context.Background(), 7, "task_abc", input)
	require.NoError(t, err)
	assert.Contains(t, out, "media-task-assets/7/task_abc/0.png")
	assert.Len(t, fake.copyCalls, 1)
	assert.True(t, strings.HasPrefix(fake.copyCalls[0].dst, "media-task-assets/"))
}

func TestPromoteTaskMediaAssetsNoMediaReturnsSame(t *testing.T) {
	in := `{"prompt":"only text"}`
	out, err := PromoteTaskMediaAssets(context.Background(), 1, "task_x", in)
	require.NoError(t, err)
	assert.JSONEq(t, in, out)
}
