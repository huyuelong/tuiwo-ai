package ali

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestResolveWan30ActionFromMedia(t *testing.T) {
	t.Parallel()

	assert.Equal(t, "textGenerate", resolveWan30Action(&AliVideoRequest{}))
	assert.Equal(t, "firstTailGenerate", resolveWan30Action(&AliVideoRequest{
		Input: AliVideoInput{Media: []AliVideoMedia{{Type: "first_frame", URL: "https://a"}}},
	}))
	assert.Equal(t, "referenceGenerate", resolveWan30Action(&AliVideoRequest{
		Input: AliVideoInput{Media: []AliVideoMedia{{Type: "reference_image", URL: "https://a"}}},
	}))
}

func TestConvertToAliRequestWan30TextToVideoDefaults(t *testing.T) {
	adaptor := &TaskAdaptor{}
	req := relaycommon.TaskSubmitReq{
		Model:  "wan3.0-video",
		Prompt: "一只猫在窗台上睡觉",
	}

	aliReq, err := adaptor.convertToAliRequest(testRelayInfo(), req)

	require.NoError(t, err)
	require.Equal(t, "wan3.0-video", aliReq.Model)
	require.Equal(t, "1080P", aliReq.Parameters.Resolution)
	require.Equal(t, "adaptive", aliReq.Parameters.Ratio)
	require.Equal(t, 5, aliReq.Parameters.Duration)
	require.False(t, aliReq.Parameters.PromptExtend)
	require.Empty(t, aliReq.Input.Media)
	require.Empty(t, aliReq.Input.ImgURL)
	require.Empty(t, aliReq.Input.NegativePrompt)

	body, err := common.Marshal(aliReq)
	require.NoError(t, err)
	require.NotContains(t, string(body), `"prompt_extend"`)
	require.Contains(t, string(body), `"ratio":"adaptive"`)
}

func TestConvertToAliRequestWan30ReferenceMode(t *testing.T) {
	adaptor := &TaskAdaptor{}
	req := relaycommon.TaskSubmitReq{
		Model:    "wan3.0-video",
		Prompt:   "视频1抱着图3弹奏",
		Duration: 10,
		Size:     "720p",
		Metadata: map[string]interface{}{
			"input": map[string]interface{}{
				"media": []interface{}{
					map[string]interface{}{
						"type": "reference_image",
						"url":  "https://example.com/a.jpg",
					},
					map[string]interface{}{
						"type": "reference_video",
						"url":  "https://example.com/b.mp4",
					},
				},
			},
			"parameters": map[string]interface{}{
				"ratio":           "adaptive",
				"enable_thinking": false,
			},
		},
	}

	aliReq, err := adaptor.convertToAliRequest(testRelayInfo(), req)

	require.NoError(t, err)
	require.Equal(t, "720P", aliReq.Parameters.Resolution)
	require.Equal(t, 10, aliReq.Parameters.Duration)
	require.Equal(t, []AliVideoMedia{
		{Type: "reference_image", URL: "https://example.com/a.jpg"},
		{Type: "reference_video", URL: "https://example.com/b.mp4"},
	}, aliReq.Input.Media)
	require.Empty(t, aliReq.Input.ImgURL)
}

func TestConvertToAliRequestWan30FirstFrameFromImage(t *testing.T) {
	adaptor := &TaskAdaptor{}
	req := relaycommon.TaskSubmitReq{
		Model:    "wan3.0-video",
		Prompt:   "涂鸦角色活过来",
		Image:    "https://example.com/first.png",
		Duration: 10,
		Size:     "720p",
	}

	aliReq, err := adaptor.convertToAliRequest(testRelayInfo(), req)

	require.NoError(t, err)
	require.Equal(t, []AliVideoMedia{
		{Type: "first_frame", URL: "https://example.com/first.png"},
	}, aliReq.Input.Media)
}

func TestConvertToAliRequestWan30RejectsMixedModes(t *testing.T) {
	adaptor := &TaskAdaptor{}
	req := relaycommon.TaskSubmitReq{
		Model:  "wan3.0-video",
		Prompt: "mixed",
		Metadata: map[string]interface{}{
			"input": map[string]interface{}{
				"media": []interface{}{
					map[string]interface{}{"type": "reference_image", "url": "https://example.com/a.jpg"},
					map[string]interface{}{"type": "first_frame", "url": "https://example.com/b.jpg"},
				},
			},
		},
	}

	_, err := adaptor.convertToAliRequest(testRelayInfo(), req)

	require.Error(t, err)
	assert.True(t, strings.Contains(err.Error(), "mutually exclusive"))
}

func TestConvertToAliRequestWan30FileRequiresThinking(t *testing.T) {
	adaptor := &TaskAdaptor{}
	req := relaycommon.TaskSubmitReq{
		Model:  "wan3.0-video",
		Prompt: "read the doc",
		Metadata: map[string]interface{}{
			"input": map[string]interface{}{
				"media": []interface{}{
					map[string]interface{}{"type": "file", "url": "https://example.com/a.pdf"},
				},
			},
			"parameters": map[string]interface{}{
				"enable_thinking": false,
			},
		},
	}

	_, err := adaptor.convertToAliRequest(testRelayInfo(), req)

	require.Error(t, err)
	assert.True(t, strings.Contains(err.Error(), "enable_thinking"))
}

func TestConvertToAliRequestWan30AcceptsSmartDuration(t *testing.T) {
	adaptor := &TaskAdaptor{}
	req := relaycommon.TaskSubmitReq{
		Model:  "wan3.0-video",
		Prompt: "smart duration",
		Metadata: map[string]interface{}{
			"parameters": map[string]interface{}{
				"duration": -1,
			},
		},
	}

	aliReq, err := adaptor.convertToAliRequest(testRelayInfo(), req)

	require.NoError(t, err)
	require.Equal(t, -1, aliReq.Parameters.Duration)
	assert.Equal(t, float64(30), wan30BillingSeconds(aliReq.Parameters.Duration))
}

func TestConvertToAliRequestWan30RequiresPrompt(t *testing.T) {
	adaptor := &TaskAdaptor{}
	req := relaycommon.TaskSubmitReq{
		Model: "wan3.0-video",
		Metadata: map[string]interface{}{
			"input": map[string]interface{}{
				"media": []map[string]interface{}{
					{"type": "first_frame", "url": "https://example.com/a.png"},
				},
			},
		},
	}

	_, err := adaptor.convertToAliRequest(testRelayInfo(), req)

	require.Error(t, err)
	assert.True(t, strings.Contains(err.Error(), "requires prompt"))
}

func TestConvertToAliRequestWan30SeedAndResolutionBilling(t *testing.T) {
	adaptor := &TaskAdaptor{}
	seed := 42
	req := relaycommon.TaskSubmitReq{
		Model:    "wan3.0-video",
		Prompt:   "seeded",
		Duration: 5,
		Metadata: map[string]interface{}{
			"parameters": map[string]interface{}{
				"resolution": "720P",
				"seed":       seed,
			},
		},
	}

	aliReq, err := adaptor.convertToAliRequest(testRelayInfo(), req)
	require.NoError(t, err)
	require.NotNil(t, aliReq.Parameters.Seed)
	assert.Equal(t, 42, *aliReq.Parameters.Seed)

	ratios, err := ProcessAliOtherRatios(aliReq)
	require.NoError(t, err)
	assert.Equal(t, 2.0, ratios["resolution-720P"])

	aliReq.Parameters.Resolution = "1080P"
	ratios, err = ProcessAliOtherRatios(aliReq)
	require.NoError(t, err)
	assert.Equal(t, 4.0, ratios["resolution-1080P"])

	aliReq.Parameters.Resolution = "480P"
	ratios, err = ProcessAliOtherRatios(aliReq)
	require.NoError(t, err)
	assert.Equal(t, 1.0, ratios["resolution-480P"])
}

func TestConvertToAliRequestWan30StripsNegativePrompt(t *testing.T) {
	adaptor := &TaskAdaptor{}
	req := relaycommon.TaskSubmitReq{
		Model:  "wan3.0-video",
		Prompt: "clean scene",
		Metadata: map[string]interface{}{
			"input": map[string]interface{}{
				"negative_prompt": "blurry",
			},
		},
	}

	aliReq, err := adaptor.convertToAliRequest(testRelayInfo(), req)

	require.NoError(t, err)
	require.Empty(t, aliReq.Input.NegativePrompt)
	body, err := common.Marshal(aliReq)
	require.NoError(t, err)
	require.NotContains(t, string(body), "negative_prompt")
}

func TestConvertToAliRequestWan30LastFrameFromImages(t *testing.T) {
	adaptor := &TaskAdaptor{}
	req := relaycommon.TaskSubmitReq{
		Model:  "wan3.0-video",
		Prompt: "from last frame only via images[1]",
		Images: []string{
			"https://example.com/first.png",
			"https://example.com/last.png",
		},
	}

	aliReq, err := adaptor.convertToAliRequest(testRelayInfo(), req)

	require.NoError(t, err)
	require.Equal(t, []AliVideoMedia{
		{Type: "first_frame", URL: "https://example.com/first.png"},
		{Type: "last_frame", URL: "https://example.com/last.png"},
	}, aliReq.Input.Media)
}

func TestValidateRequestAndSetActionRejectsInvalidWan30BeforeBilling(t *testing.T) {
	gin.SetMode(gin.TestMode)
	request := httptest.NewRequest(
		http.MethodPost,
		"/v1/video/generations",
		strings.NewReader(`{
			"model":"wan3.0-video",
			"prompt":"test",
			"metadata":{"parameters":{"ratio":"21:9"}}
		}`),
	)
	request.Header.Set("Content-Type", "application/json")
	context, _ := gin.CreateTestContext(httptest.NewRecorder())
	context.Request = request
	info := &relaycommon.RelayInfo{
		TaskRelayInfo: &relaycommon.TaskRelayInfo{},
		ChannelMeta:   &relaycommon.ChannelMeta{},
	}

	taskErr := (&TaskAdaptor{}).ValidateRequestAndSetAction(context, info)

	require.NotNil(t, taskErr)
	assert.Equal(t, http.StatusBadRequest, taskErr.StatusCode)
	assert.Equal(t, "invalid_request", taskErr.Code)
}

func TestEstimateBillingFailsClosedOnConvertError(t *testing.T) {
	gin.SetMode(gin.TestMode)
	request := httptest.NewRequest(http.MethodPost, "/v1/video/generations", nil)
	context, _ := gin.CreateTestContext(httptest.NewRecorder())
	context.Request = request
	info := &relaycommon.RelayInfo{
		TaskRelayInfo: &relaycommon.TaskRelayInfo{},
		ChannelMeta:   &relaycommon.ChannelMeta{},
	}

	ratios := (&TaskAdaptor{}).EstimateBilling(context, info)
	require.NotNil(t, ratios)
	assert.Equal(t, float64(relaycommon.MaxTaskDurationSeconds), ratios["seconds"])
}

func TestAdjustBillingOnCompleteUsesAliUsageDuration(t *testing.T) {
	adaptor := &TaskAdaptor{}
	task := &model.Task{
		Quota: 3000,
		Data:  []byte(`{"output":{"task_status":"SUCCEEDED"},"usage":{"duration":8}}`),
	}
	task.PrivateData.BillingContext = &model.TaskBillingContext{
		OtherRatios: map[string]float64{
			"seconds": float64(30),
		},
	}

	actual := adaptor.AdjustBillingOnComplete(task, &relaycommon.TaskInfo{})
	require.Equal(t, 800, actual)
}

func TestAdjustBillingOnCompleteSkipsWhenDurationMatchesPrecharge(t *testing.T) {
	adaptor := &TaskAdaptor{}
	task := &model.Task{
		Quota: 1000,
		Data:  []byte(`{"output":{"task_status":"SUCCEEDED"},"usage":{"duration":10}}`),
	}
	task.PrivateData.BillingContext = &model.TaskBillingContext{
		OtherRatios: map[string]float64{
			"seconds": 10,
		},
	}

	actual := adaptor.AdjustBillingOnComplete(task, &relaycommon.TaskInfo{})
	assert.Equal(t, 0, actual)
}
