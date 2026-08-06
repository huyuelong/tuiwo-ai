package controller

import (
	"github.com/QuantumNous/new-api/relaykit/types"

	"github.com/gin-gonic/gin"
)

// PlaygroundVideo 视频生成任务提交（用户登录态，无需 API Key）。
func PlaygroundVideo(c *gin.Context) {
	var newAPIError *types.NewAPIError
	defer func() {
		if newAPIError != nil {
			c.JSON(newAPIError.StatusCode, gin.H{
				"error": newAPIError.ToOpenAIError(),
			})
		}
	}()

	if newAPIError = setupPlaygroundToken(c); newAPIError != nil {
		return
	}
	RelayTask(c)
}

// PlaygroundVideoFetch 视频生成任务查询。
func PlaygroundVideoFetch(c *gin.Context) {
	var newAPIError *types.NewAPIError
	defer func() {
		if newAPIError != nil {
			c.JSON(newAPIError.StatusCode, gin.H{
				"error": newAPIError.ToOpenAIError(),
			})
		}
	}()

	if newAPIError = setupPlaygroundToken(c); newAPIError != nil {
		return
	}
	RelayTaskFetch(c)
}
