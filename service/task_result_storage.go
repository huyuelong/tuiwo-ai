package service

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"path"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/bytedance/gopkg/util/gopool"
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

// ResolveTaskResultURL 优先返回自有对象的预签名 GET URL，失败时回退上游 ResultURL。
func ResolveTaskResultURL(ctx context.Context, task *model.Task) string {
	if task == nil {
		return ""
	}
	if ctx == nil {
		ctx = context.Background()
	}
	key := strings.TrimSpace(task.PrivateData.StoredResultKey)
	if key != "" {
		client, err := getMediaS3Client()
		if err == nil && client != nil {
			if signed, err := client.PresignGet(ctx, key, mediaGetURLExpiry); err == nil && signed != "" {
				return signed
			}
		}
	}
	return task.GetResultURL()
}

// ScheduleArchiveTaskResult 在后台异步转存，不阻塞轮询与结算。
func ScheduleArchiveTaskResult(taskID int64) {
	if taskID <= 0 {
		return
	}
	gopool.Go(func() {
		ctx, cancel := context.WithTimeout(context.Background(), archiveHTTPTimeout+30*time.Second)
		defer cancel()
		if err := ArchiveTaskResult(ctx, taskID); err != nil {
			logger.LogError(ctx, fmt.Sprintf("archive task result %d failed: %v", taskID, err))
		}
	})
}

// ArchiveTaskResult 将成功任务的上游视频转存到自有 S3。
// 失败不改变任务状态；已有 StoredResultKey 时跳过。
func ArchiveTaskResult(ctx context.Context, taskID int64) error {
	var task model.Task
	if err := model.DB.First(&task, taskID).Error; err != nil {
		return err
	}
	if task.PrivateData.StoredResultKey != "" {
		return nil
	}
	if task.Status != model.TaskStatusSuccess {
		return nil
	}

	sourceURL := strings.TrimSpace(task.GetResultURL())
	if sourceURL == "" || strings.HasPrefix(sourceURL, "data:") {
		return nil
	}
	// 本地代理路径（.../v1/videos/{id}/content）没有上游直链，跳过
	if strings.Contains(sourceURL, "/v1/videos/") && strings.HasSuffix(sourceURL, "/content") {
		return nil
	}
	parsed, err := url.Parse(sourceURL)
	if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") {
		return nil
	}

	cfg := LoadMediaStorageConfig()
	if !cfg.IsReady() {
		return ErrMediaUploadDisabled
	}
	client, err := getMediaS3Client()
	if err != nil {
		return err
	}

	ext := path.Ext(parsed.Path)
	objectKey, err := GenerateMediaResultObjectKey(task.UserId, task.TaskID, time.Now(), ext)
	if err != nil {
		return err
	}

	contentType, body, size, err := downloadTaskResult(ctx, sourceURL)
	if err != nil {
		return err
	}
	defer body.Close()

	if err := client.Put(ctx, objectKey, contentType, body, size); err != nil {
		return fmt.Errorf("put archived result: %w", err)
	}

	var fresh model.Task
	if err := model.DB.First(&fresh, task.ID).Error; err != nil {
		return err
	}
	if fresh.PrivateData.StoredResultKey != "" {
		return nil
	}
	fresh.PrivateData.StoredResultKey = objectKey
	fresh.UpdatedAt = common.GetTimestamp()
	return model.DB.Model(&fresh).Select("PrivateData", "UpdatedAt").Updates(&fresh).Error
}

func downloadTaskResult(ctx context.Context, sourceURL string) (contentType string, body io.ReadCloser, size int64, err error) {
	// 结果 URL 来自上游/任务字段，按用户可控外链做 SSRF 防护
	if err := ValidateSSRFProtectedFetchURL(sourceURL); err != nil {
		return "", nil, 0, fmt.Errorf("request reject: %v", err)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, sourceURL, nil)
	if err != nil {
		return "", nil, 0, err
	}
	base := GetSSRFProtectedHTTPClient()
	client := *base
	client.Timeout = archiveHTTPTimeout
	resp, err := client.Do(req)
	if err != nil {
		return "", nil, 0, err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		_ = resp.Body.Close()
		return "", nil, 0, fmt.Errorf("upstream result returned status %d", resp.StatusCode)
	}
	if resp.ContentLength > maxArchiveDownloadBytes {
		_ = resp.Body.Close()
		return "", nil, 0, fmt.Errorf("%w: result too large", ErrMediaUploadValidation)
	}
	limited := http.MaxBytesReader(nil, resp.Body, maxArchiveDownloadBytes)
	ct := strings.TrimSpace(resp.Header.Get("Content-Type"))
	if i := strings.IndexByte(ct, ';'); i >= 0 {
		ct = strings.TrimSpace(ct[:i])
	}
	if ct == "" {
		ct = "video/mp4"
	}
	return ct, limited, resp.ContentLength, nil
}
