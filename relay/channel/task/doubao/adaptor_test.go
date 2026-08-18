package doubao

import (
	"testing"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestConvertToRequestPayloadMapsPlaygroundParameters(t *testing.T) {
	t.Parallel()

	a := &TaskAdaptor{}
	req := &relaycommon.TaskSubmitReq{
		Model:    "seedance-2.0-fast",
		Prompt:   "一位演员在咖啡馆自然地看向镜头",
		Duration: 5,
		Metadata: map[string]interface{}{
			"parameters": map[string]interface{}{
				"ratio":         "16:9",
				"resolution":    "1080p",
				"audio":         true,
				"human_review":  true,
				"seed":          float64(42),
			},
		},
	}

	payload, err := a.convertToRequestPayload(req)
	require.NoError(t, err)
	assert.Equal(t, "seedance-2.0-fast", payload.Model)
	require.NotNil(t, payload.Duration)
	assert.Equal(t, dto.IntValue(5), *payload.Duration)
	assert.Equal(t, "16:9", payload.Ratio)
	assert.Equal(t, "1080p", payload.Resolution)
	require.NotNil(t, payload.GenerateAudio)
	assert.Equal(t, dto.BoolValue(true), *payload.GenerateAudio)
	require.NotNil(t, payload.HumanReview)
	assert.Equal(t, dto.BoolValue(true), *payload.HumanReview)
	require.NotNil(t, payload.Seed)
	assert.Equal(t, dto.IntValue(42), *payload.Seed)
	require.Len(t, payload.Content, 1)
	assert.Equal(t, "text", payload.Content[0].Type)
	assert.Equal(t, req.Prompt, payload.Content[0].Text)
}

func TestParseTaskResultFallsBackToTopLevelVideoURL(t *testing.T) {
	t.Parallel()

	a := &TaskAdaptor{}
	body := []byte(`{
		"id":"job-api-001",
		"model":"seedance-2.0-fast",
		"status":"succeeded",
		"video_url":"https://cdn.example.com/final.mp4",
		"content":{}
	}`)

	info, err := a.ParseTaskResult(body)
	require.NoError(t, err)
	assert.Equal(t, "SUCCESS", string(info.Status))
	assert.Equal(t, "https://cdn.example.com/final.mp4", info.Url)
}

func TestModelListIncludesSeedanceAliases(t *testing.T) {
	t.Parallel()
	a := &TaskAdaptor{}
	models := a.GetModelList()
	assert.Contains(t, models, "seedance-2.0")
	assert.Contains(t, models, "seedance-2.0-fast")
}
