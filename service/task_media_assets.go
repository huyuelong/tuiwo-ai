package service

import (
	"context"
	"fmt"
	"path"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
)

const defaultMediaTaskAssetKeyPrefix = "media-task-assets"

// GenerateMediaTaskAssetObjectKey 生成任务绑定参考媒体对象键。
// 格式：media-task-assets/{userId}/{taskID}/{index}{ext}
func GenerateMediaTaskAssetObjectKey(userId int, taskID string, index int, ext string) (string, error) {
	if userId <= 0 {
		return "", fmt.Errorf("%w: invalid user id", ErrMediaUploadValidation)
	}
	taskID = strings.TrimSpace(taskID)
	if taskID == "" {
		return "", fmt.Errorf("%w: empty task id", ErrMediaUploadValidation)
	}
	if strings.Contains(taskID, "/") || strings.Contains(taskID, "..") {
		return "", fmt.Errorf("%w: invalid task id", ErrMediaUploadValidation)
	}
	ext = strings.ToLower(strings.TrimSpace(ext))
	if ext == "" {
		return "", fmt.Errorf("%w: extension is required", ErrMediaUploadValidation)
	}
	if !strings.HasPrefix(ext, ".") {
		ext = "." + ext
	}
	return fmt.Sprintf("%s/%d/%s/%d%s", defaultMediaTaskAssetKeyPrefix, userId, taskID, index, ext), nil
}

func userMediaUploadKeyPrefix(userId int) string {
	cfg := LoadMediaStorageConfig()
	prefix := strings.Trim(cfg.KeyPrefix, "/")
	if prefix == "" {
		prefix = defaultMediaKeyPrefix
	}
	return fmt.Sprintf("%s/%d/", prefix, userId)
}

func shouldPromoteMediaObjectKey(objectKey, uploadPrefix, taskAssetPrefix string) bool {
	objectKey = strings.TrimSpace(objectKey)
	if objectKey == "" {
		return false
	}
	if strings.HasPrefix(objectKey, taskAssetPrefix+"/") {
		return false
	}
	return strings.HasPrefix(objectKey, uploadPrefix)
}

// PromoteTaskMediaAssets 将 media-uploads 下的参考媒体复制到 media-task-assets，
// 并重写 metadata.input.media[].object_key。
// 当前提交路径暂时跳过本函数（见 controller/relay.go）；保留供后续恢复任务绑定长期存储。
// 单条复制失败时保留该条原 object_key 并继续；S3 不可用时返回原始 input。
func PromoteTaskMediaAssets(ctx context.Context, userId int, taskID, inputJSON string) (string, error) {
	inputJSON = strings.TrimSpace(inputJSON)
	if inputJSON == "" {
		return inputJSON, nil
	}

	var root map[string]interface{}
	if err := common.Unmarshal([]byte(inputJSON), &root); err != nil {
		return inputJSON, nil
	}

	metadata, _ := root["metadata"].(map[string]interface{})
	if metadata == nil {
		return inputJSON, nil
	}
	inputSection, _ := metadata["input"].(map[string]interface{})
	if inputSection == nil {
		return inputJSON, nil
	}
	mediaRaw, _ := inputSection["media"].([]interface{})
	if len(mediaRaw) == 0 {
		return inputJSON, nil
	}

	client, err := getMediaS3Client()
	if err != nil {
		logger.LogError(ctx, fmt.Sprintf("promote task media assets skipped: %v", err))
		return inputJSON, nil
	}

	uploadPrefix := userMediaUploadKeyPrefix(userId)
	taskAssetPrefix := defaultMediaTaskAssetKeyPrefix
	changed := false

	for i, raw := range mediaRaw {
		item, ok := raw.(map[string]interface{})
		if !ok {
			continue
		}
		srcKey, _ := item["object_key"].(string)
		if !shouldPromoteMediaObjectKey(srcKey, uploadPrefix, taskAssetPrefix) {
			continue
		}

		ext := strings.ToLower(path.Ext(srcKey))
		if ext == "" {
			ext = ".bin"
		}
		dstKey, keyErr := GenerateMediaTaskAssetObjectKey(userId, taskID, i, ext)
		if keyErr != nil {
			logger.LogError(ctx, fmt.Sprintf("promote task media assets key generation failed for %q: %v", srcKey, keyErr))
			continue
		}

		if copyErr := client.Copy(ctx, srcKey, dstKey); copyErr != nil {
			logger.LogError(ctx, fmt.Sprintf("promote task media assets copy %q -> %q failed: %v", srcKey, dstKey, copyErr))
			continue
		}

		item["object_key"] = dstKey
		changed = true
	}

	if !changed {
		return inputJSON, nil
	}

	out, err := common.Marshal(root)
	if err != nil {
		logger.LogError(ctx, fmt.Sprintf("promote task media assets marshal failed: %v", err))
		return inputJSON, nil
	}
	return string(out), nil
}
