package service

import (
	"context"
	"fmt"
	"strings"
)

const maxMediaPresignGetKeys = 40

func userMediaTaskAssetKeyPrefix(userId int) string {
	return fmt.Sprintf("%s/%d/", defaultMediaTaskAssetKeyPrefix, userId)
}

func validateOwnedMediaObjectKey(objectKey string, userId int) error {
	objectKey = strings.TrimSpace(objectKey)
	if objectKey == "" {
		return fmt.Errorf("%w: object_key is required", ErrMediaUploadValidation)
	}
	if strings.Contains(objectKey, "..") {
		return fmt.Errorf("%w: invalid object_key", ErrMediaUploadValidation)
	}
	uploadPrefix := userMediaUploadKeyPrefix(userId)
	taskPrefix := userMediaTaskAssetKeyPrefix(userId)
	if strings.HasPrefix(objectKey, uploadPrefix) || strings.HasPrefix(objectKey, taskPrefix) {
		return nil
	}
	return fmt.Errorf("%w: object_key access denied", ErrMediaUploadValidation)
}

// PresignOwnedMediaKeys 为当前用户拥有的 object_key 批量签发预签名 GET URL。
func PresignOwnedMediaKeys(ctx context.Context, userId int, objectKeys []string) (map[string]string, error) {
	cfg := LoadMediaStorageConfig()
	if !cfg.IsReady() {
		return nil, ErrMediaUploadDisabled
	}
	if userId <= 0 {
		return nil, fmt.Errorf("%w: invalid user id", ErrMediaUploadValidation)
	}
	if len(objectKeys) == 0 {
		return nil, fmt.Errorf("%w: object_keys must not be empty", ErrMediaUploadValidation)
	}
	if len(objectKeys) > maxMediaPresignGetKeys {
		return nil, fmt.Errorf("%w: too many object_keys (max %d)", ErrMediaUploadValidation, maxMediaPresignGetKeys)
	}

	client, err := getMediaS3Client()
	if err != nil {
		return nil, err
	}

	urls := make(map[string]string, len(objectKeys))
	for _, key := range objectKeys {
		if err := validateOwnedMediaObjectKey(key, userId); err != nil {
			return nil, err
		}
	}
	for _, key := range objectKeys {
		key = strings.TrimSpace(key)
		signed, err := client.PresignGet(ctx, key, mediaGetURLExpiry)
		if err != nil {
			return nil, fmt.Errorf("failed to presign get url for %q: %w", key, err)
		}
		urls[key] = signed
	}
	return urls, nil
}
