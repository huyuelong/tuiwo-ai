package controller

import (
	"errors"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

// GetMediaUploadConfig 返回上传是否启用及大小限制（不含密钥）。
func GetMediaUploadConfig(c *gin.Context) {
	common.ApiSuccess(c, service.MediaUploadConfigResponse())
}

// InitiateMediaUpload 创建 pending 上传并返回短时预签名 PUT URL。
func InitiateMediaUpload(c *gin.Context) {
	var req dto.MediaUploadInitiateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorMsg(c, "invalid request parameters")
		return
	}

	userId := c.GetInt("id")
	if userId <= 0 {
		common.ApiErrorMsg(c, "unauthorized")
		return
	}

	resp, err := service.InitiateMediaUpload(c.Request.Context(), userId, req)
	if err != nil {
		writeMediaUploadError(c, err)
		return
	}
	common.ApiSuccess(c, resp)
}

// PresignMediaGet 为当前用户拥有的 object_key 批量签发预签名 GET URL。
func PresignMediaGet(c *gin.Context) {
	var req dto.MediaPresignGetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorMsg(c, "invalid request parameters")
		return
	}

	userId := c.GetInt("id")
	if userId <= 0 {
		common.ApiErrorMsg(c, "unauthorized")
		return
	}

	urls, err := service.PresignOwnedMediaKeys(c.Request.Context(), userId, req.ObjectKeys)
	if err != nil {
		writeMediaUploadError(c, err)
		return
	}
	common.ApiSuccess(c, dto.MediaPresignGetResponse{URLs: urls})
}

// CompleteMediaUpload 校验已上传对象并返回 24 小时预签名 GET URL。
func CompleteMediaUpload(c *gin.Context) {
	var req dto.MediaUploadCompleteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorMsg(c, "invalid request parameters")
		return
	}

	userId := c.GetInt("id")
	if userId <= 0 {
		common.ApiErrorMsg(c, "unauthorized")
		return
	}

	resp, err := service.CompleteMediaUpload(c.Request.Context(), userId, req.UploadId)
	if err != nil {
		writeMediaUploadError(c, err)
		return
	}
	common.ApiSuccess(c, resp)
}

func writeMediaUploadError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, service.ErrMediaUploadDisabled):
		common.ApiErrorMsg(c, "media upload is disabled")
	case errors.Is(err, service.ErrMediaUploadNotFound):
		common.ApiErrorMsg(c, "upload not found")
	case errors.Is(err, service.ErrMediaUploadBadStatus):
		common.ApiErrorMsg(c, "upload is not pending")
	case errors.Is(err, service.ErrMediaUploadQuota):
		common.ApiErrorMsg(c, "daily media upload quota exceeded")
	case errors.Is(err, service.ErrMediaUploadValidation):
		common.ApiErrorMsg(c, err.Error())
	default:
		common.ApiError(c, err)
	}
}
