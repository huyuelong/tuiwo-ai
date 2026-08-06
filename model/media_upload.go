package model

import (
	"errors"
	"fmt"
	"time"

	"gorm.io/gorm"
)

const (
	MediaUploadStatusPending   = "pending"
	MediaUploadStatusCompleted = "completed"
	MediaUploadStatusFailed    = "failed"
)

// MediaUpload 记录私有媒体上传，用于审计与每日额度。
//
// 清理说明：过期 pending 不会由后台自动删除对象。运维应：
// 1）定期调用 CleanupExpiredPendingMediaUploads 将过期 pending 标为 failed；
// 2）在 S3/OSS 桶上配置前缀生命周期（建议 7 天）清理孤儿对象。
type MediaUpload struct {
	Id           int    `json:"id" gorm:"primaryKey;autoIncrement"`
	UploadId     string `json:"upload_id" gorm:"type:varchar(64);uniqueIndex;not null"`
	UserId       int    `json:"user_id" gorm:"not null;index:idx_media_upload_user_created"`
	ObjectKey    string `json:"object_key" gorm:"type:varchar(512);not null"`
	Filename     string `json:"filename" gorm:"type:varchar(255);not null"`
	ContentType  string `json:"content_type" gorm:"type:varchar(128);not null"`
	Category     string `json:"category" gorm:"type:varchar(32);not null"` // image | audio | video
	DeclaredSize int64  `json:"declared_size" gorm:"not null"`
	ActualSize   int64  `json:"actual_size" gorm:"default:0"`
	Status       string `json:"status" gorm:"type:varchar(32);not null;index"`
	CreatedAt    int64  `json:"created_at" gorm:"bigint;index:idx_media_upload_user_created"`
	UpdatedAt    int64  `json:"updated_at" gorm:"bigint"`
	CompletedAt  int64  `json:"completed_at" gorm:"bigint;default:0"`
	ExpiresAt    int64  `json:"expires_at" gorm:"bigint;index;default:0"` // pending PUT 过期时间（unix）
}

func (MediaUpload) TableName() string {
	return "media_uploads"
}

func CreateMediaUpload(upload *MediaUpload) error {
	if upload == nil {
		return errors.New("media upload is nil")
	}
	now := time.Now().Unix()
	if upload.CreatedAt == 0 {
		upload.CreatedAt = now
	}
	upload.UpdatedAt = now
	if upload.Status == "" {
		upload.Status = MediaUploadStatusPending
	}
	return DB.Create(upload).Error
}

// GetMediaUploadByUploadIdForUser 按 upload_id + 用户 ID 查询，防止跨用户访问。
func GetMediaUploadByUploadIdForUser(uploadId string, userId int) (*MediaUpload, error) {
	if uploadId == "" || userId <= 0 {
		return nil, errors.New("invalid upload id or user id")
	}
	var upload MediaUpload
	err := DB.Where("upload_id = ? AND user_id = ?", uploadId, userId).First(&upload).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &upload, nil
}

func UpdateMediaUpload(upload *MediaUpload) error {
	if upload == nil || upload.Id == 0 {
		return errors.New("invalid media upload")
	}
	upload.UpdatedAt = time.Now().Unix()
	return DB.Save(upload).Error
}

// SumMediaUploadBytesForUserToday 汇总用户当日 pending/completed 占用字节
//（优先 actual_size，否则 declared_size；按本机日历日）。
func SumMediaUploadBytesForUserToday(userId int) (int64, error) {
	if userId <= 0 {
		return 0, errors.New("invalid user id")
	}
	now := time.Now()
	start := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location()).Unix()
	end := start + 24*60*60

	var total int64
	// CASE/COALESCE 在 SQLite、MySQL、PostgreSQL 上均可移植。
	err := DB.Model(&MediaUpload{}).
		Select("COALESCE(SUM(CASE WHEN actual_size > 0 THEN actual_size ELSE declared_size END), 0)").
		Where("user_id = ? AND created_at >= ? AND created_at < ? AND status IN ?",
			userId, start, end, []string{MediaUploadStatusPending, MediaUploadStatusCompleted}).
		Scan(&total).Error
	if err != nil {
		return 0, err
	}
	return total, nil
}

// CleanupExpiredPendingMediaUploads 将已过期的 pending 标为 failed，返回更新行数。
// 不删除对象存储中的文件；需配合桶生命周期或额外删除任务。
// 优先使用 expires_at；若为 0 则回退到 created_at + olderThan。
func CleanupExpiredPendingMediaUploads(olderThan time.Duration) (int64, error) {
	if olderThan <= 0 {
		return 0, fmt.Errorf("olderThan must be positive")
	}
	now := time.Now().Unix()
	cutoff := time.Now().Add(-olderThan).Unix()
	res := DB.Model(&MediaUpload{}).
		Where(
			"status = ? AND ((expires_at > 0 AND expires_at < ?) OR (expires_at = 0 AND created_at < ?))",
			MediaUploadStatusPending, now, cutoff,
		).
		Updates(map[string]any{
			"status":     MediaUploadStatusFailed,
			"updated_at": now,
		})
	return res.RowsAffected, res.Error
}
