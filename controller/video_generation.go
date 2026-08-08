package controller

import (
	"github.com/QuantumNous/new-api/relaykit/types"

	"github.com/gin-gonic/gin"
)

// VideoGeneration 视频生成任务提交（用户登录态，无需 API Key）。
func VideoGeneration(c *gin.Context) {
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

// VideoGenerationFetch 视频生成任务查询。
func VideoGenerationFetch(c *gin.Context) {
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
