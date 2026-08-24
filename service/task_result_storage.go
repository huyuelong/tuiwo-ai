package service

import (
	"bytes"
	"context"
	"encoding/base64"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/model"
)

const (
	defaultMediaResultKeyPrefix = "media-results"
	archiveHTTPTimeout          = 2 * time.Minute
	maxArchiveDownloadBytes     = int64(500) * 1024 * 1024 // 与视频上传上限对齐
)

// GenerateMediaResultObjectKey 生成成功视频转存对象键。
// 格式：media-results/{userId}/{YYYY}/{MM}/{DD}/{taskId}{ext}
func GenerateMediaResultObjectKey(userId int, taskID string, now time.Time, ext string) (string, error) {
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
		ext = ".mp4"
	}
	if !strings.HasPrefix(ext, ".") {
		ext = "." + ext
	}
	day := now.Format("2006/01/02")
	return fmt.Sprintf("%s/%d/%s/%s%s", defaultMediaResultKeyPrefix, userId, day, taskID, ext), nil
}

// ResolveTaskResultURL 返回 MinIO/S3 中已归档结果的预签名 GET URL。
func ResolveTaskResultURL(ctx context.Context, task *model.Task) string {
	if task == nil {
		return ""
	}
	if ctx == nil {
		ctx = context.Background()
	}
	key := strings.TrimSpace(task.PrivateData.StoredResultKey)
	if key == "" {
		return ""
	}
	client, err := getMediaS3Client()
	if err != nil || client == nil {
		return ""
	}
	signed, err := client.PresignGet(ctx, key, mediaGetURLExpiry)
	if err != nil || signed == "" {
		return ""
	}
	return signed
}

// EffectiveTaskResultURL 优先返回归档结果的预签名 URL，否则回退到任务私有 ResultURL。
func EffectiveTaskResultURL(ctx context.Context, task *model.Task) string {
	if task == nil {
		return ""
	}
	if signed := ResolveTaskResultURL(ctx, task); signed != "" {
		return signed
	}
	return strings.TrimSpace(task.GetResultURL())
}

// StoreTaskResultFromURL 下载上游结果并写入自有对象存储，返回 object key。
// 当前轮询路径暂时跳过归档（见 task_polling.go）；保留供后续恢复 MinIO/S3 转存。
func StoreTaskResultFromURL(ctx context.Context, userId int, taskID, sourceURL string) (string, error) {
	sourceURL = strings.TrimSpace(sourceURL)
	if sourceURL == "" {
		return "", fmt.Errorf("%w: empty result url", ErrMediaUploadValidation)
	}
	if strings.HasPrefix(sourceURL, "data:") {
		return StoreTaskResultFromDataURL(ctx, userId, taskID, sourceURL)
	}
	if strings.Contains(sourceURL, "/v1/videos/") && strings.HasSuffix(sourceURL, "/content") {
		return "", fmt.Errorf("%w: proxy result url cannot be archived", ErrMediaUploadValidation)
	}
	parsed, err := url.Parse(sourceURL)
	if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") {
		return "", fmt.Errorf("%w: invalid result url", ErrMediaUploadValidation)
	}

	client, objectKey, err := prepareMediaResultPut(userId, taskID, path.Ext(parsed.Path))
	if err != nil {
		return "", err
	}

	contentType, body, err := downloadTaskResult(ctx, sourceURL)
	if err != nil {
		return "", err
	}
	defer body.Close()

	if err := putArchivedResult(ctx, client, objectKey, contentType, body); err != nil {
		return "", err
	}
	return objectKey, nil
}

// StoreTaskResultFromDataURL 解码 data URL 并写入自有对象存储。
func StoreTaskResultFromDataURL(ctx context.Context, userId int, taskID, dataURL string) (string, error) {
	dataURL = strings.TrimSpace(dataURL)
	contentType, payload, err := decodeTaskResultDataURL(dataURL)
	if err != nil {
		return "", err
	}
	if int64(len(payload)) > maxArchiveDownloadBytes {
		return "", fmt.Errorf("%w: result too large", ErrMediaUploadValidation)
	}
	if len(payload) == 0 {
		return "", fmt.Errorf("%w: empty result body", ErrMediaUploadValidation)
	}

	ext := ".mp4"
	switch {
	case strings.Contains(contentType, "webm"):
		ext = ".webm"
	case strings.Contains(contentType, "quicktime"):
		ext = ".mov"
	}

	client, objectKey, err := prepareMediaResultPut(userId, taskID, ext)
	if err != nil {
		return "", err
	}
	// data URL 已在内存中且可 seek，直接 Put，避免再落盘。
	if err := client.Put(ctx, objectKey, contentType, bytes.NewReader(payload), int64(len(payload))); err != nil {
		return "", fmt.Errorf("put archived result: %w", err)
	}
	return objectKey, nil
}

func prepareMediaResultPut(userId int, taskID, ext string) (mediaS3API, string, error) {
	cfg := LoadMediaStorageConfig()
	if !cfg.IsReady() {
		return nil, "", ErrMediaUploadDisabled
	}
	client, err := getMediaS3Client()
	if err != nil {
		return nil, "", err
	}
	objectKey, err := GenerateMediaResultObjectKey(userId, taskID, time.Now(), ext)
	if err != nil {
		return nil, "", err
	}
	return client, objectKey, nil
}

func putArchivedResult(ctx context.Context, client mediaS3API, objectKey, contentType string, body io.Reader) error {
	tmp, err := os.CreateTemp("", "task-result-*")
	if err != nil {
		return fmt.Errorf("create temp archived result: %w", err)
	}
	tmpPath := tmp.Name()
	defer func() {
		_ = tmp.Close()
		_ = os.Remove(tmpPath)
	}()

	written, err := io.Copy(tmp, io.LimitReader(body, maxArchiveDownloadBytes+1))
	if err != nil {
		return fmt.Errorf("read archived result: %w", err)
	}
	if written == 0 {
		return fmt.Errorf("%w: empty result body", ErrMediaUploadValidation)
	}
	if written > maxArchiveDownloadBytes {
		return fmt.Errorf("%w: result too large", ErrMediaUploadValidation)
	}
	if _, err := tmp.Seek(0, io.SeekStart); err != nil {
		return fmt.Errorf("seek archived result: %w", err)
	}
	if err := client.Put(ctx, objectKey, contentType, tmp, written); err != nil {
		return fmt.Errorf("put archived result: %w", err)
	}
	return nil
}

func decodeTaskResultDataURL(dataURL string) (contentType string, payload []byte, err error) {
	parts := strings.SplitN(dataURL, ",", 2)
	if len(parts) != 2 {
		return "", nil, fmt.Errorf("%w: invalid data url", ErrMediaUploadValidation)
	}
	header := parts[0]
	if !strings.HasPrefix(header, "data:") || !strings.Contains(header, ";base64") {
		return "", nil, fmt.Errorf("%w: unsupported data url", ErrMediaUploadValidation)
	}
	contentType = strings.TrimPrefix(header, "data:")
	contentType = strings.TrimSuffix(contentType, ";base64")
	contentType = strings.TrimSpace(contentType)
	if contentType == "" {
		contentType = "video/mp4"
	}
	payload, err = base64.StdEncoding.DecodeString(parts[1])
	if err != nil {
		payload, err = base64.RawStdEncoding.DecodeString(parts[1])
		if err != nil {
			return "", nil, fmt.Errorf("%w: invalid data url payload", ErrMediaUploadValidation)
		}
	}
	return contentType, payload, nil
}

func downloadTaskResult(ctx context.Context, sourceURL string) (contentType string, body io.ReadCloser, err error) {
	if err := ValidateSSRFProtectedFetchURL(sourceURL); err != nil {
		return "", nil, fmt.Errorf("request reject: %v", err)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, sourceURL, nil)
	if err != nil {
		return "", nil, err
	}
	base := GetSSRFProtectedHTTPClient()
	client := *base
	client.Timeout = archiveHTTPTimeout
	resp, err := client.Do(req)
	if err != nil {
		return "", nil, err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		_ = resp.Body.Close()
		return "", nil, fmt.Errorf("upstream result returned status %d", resp.StatusCode)
	}
	if resp.ContentLength > maxArchiveDownloadBytes {
		_ = resp.Body.Close()
		return "", nil, fmt.Errorf("%w: result too large", ErrMediaUploadValidation)
	}
	limited := http.MaxBytesReader(nil, resp.Body, maxArchiveDownloadBytes+1)
	ct := strings.TrimSpace(resp.Header.Get("Content-Type"))
	if i := strings.IndexByte(ct, ';'); i >= 0 {
		ct = strings.TrimSpace(ct[:i])
	}
	if ct == "" {
		ct = "video/mp4"
	}
	return ct, limited, nil
}
