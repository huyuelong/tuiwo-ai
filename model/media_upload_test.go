package model

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetMediaUploadByUploadIdForUserScopesByOwner(t *testing.T) {
	truncateTables(t)

	owner := &MediaUpload{
		UploadId:     "upload-owner",
		UserId:       11,
		ObjectKey:    "media-uploads/11/20260805/a.png",
		Filename:     "a.png",
		ContentType:  "image/png",
		Category:     "image",
		DeclaredSize: 100,
		Status:       MediaUploadStatusPending,
	}
	require.NoError(t, CreateMediaUpload(owner))

	found, err := GetMediaUploadByUploadIdForUser("upload-owner", 11)
	require.NoError(t, err)
	require.NotNil(t, found)
	assert.Equal(t, "upload-owner", found.UploadId)

	crossUser, err := GetMediaUploadByUploadIdForUser("upload-owner", 99)
	require.NoError(t, err)
	assert.Nil(t, crossUser)
}

func TestSumMediaUploadBytesForUserTodayUsesPendingAndCompleted(t *testing.T) {
	truncateTables(t)

	now := time.Now().Unix()
	require.NoError(t, CreateMediaUpload(&MediaUpload{
		UploadId:     "u-pending",
		UserId:       21,
		ObjectKey:    "media-uploads/21/x.png",
		Filename:     "x.png",
		ContentType:  "image/png",
		Category:     "image",
		DeclaredSize: 1000,
		Status:       MediaUploadStatusPending,
		CreatedAt:    now,
	}))
	require.NoError(t, CreateMediaUpload(&MediaUpload{
		UploadId:     "u-done",
		UserId:       21,
		ObjectKey:    "media-uploads/21/y.png",
		Filename:     "y.png",
		ContentType:  "image/png",
		Category:     "image",
		DeclaredSize: 500,
		ActualSize:   400,
		Status:       MediaUploadStatusCompleted,
		CreatedAt:    now,
	}))
	require.NoError(t, CreateMediaUpload(&MediaUpload{
		UploadId:     "u-failed",
		UserId:       21,
		ObjectKey:    "media-uploads/21/z.png",
		Filename:     "z.png",
		ContentType:  "image/png",
		Category:     "image",
		DeclaredSize: 9999,
		Status:       MediaUploadStatusFailed,
		CreatedAt:    now,
	}))
	require.NoError(t, CreateMediaUpload(&MediaUpload{
		UploadId:     "u-other",
		UserId:       22,
		ObjectKey:    "media-uploads/22/o.png",
		Filename:     "o.png",
		ContentType:  "image/png",
		Category:     "image",
		DeclaredSize: 8000,
		Status:       MediaUploadStatusCompleted,
		CreatedAt:    now,
	}))

	total, err := SumMediaUploadBytesForUserToday(21)
	require.NoError(t, err)
	assert.Equal(t, int64(1400), total) // 1000 pending declared + 400 completed actual
}

func TestCleanupExpiredPendingMediaUploadsMarksStaleRows(t *testing.T) {
	truncateTables(t)

	now := time.Now().Unix()
	require.NoError(t, CreateMediaUpload(&MediaUpload{
		UploadId:     "u-stale",
		UserId:       31,
		ObjectKey:    "media-uploads/31/old.png",
		Filename:     "old.png",
		ContentType:  "image/png",
		Category:     "image",
		DeclaredSize: 10,
		Status:       MediaUploadStatusPending,
		CreatedAt:    now - 7200,
		UpdatedAt:    now - 7200,
		ExpiresAt:    now - 60,
	}))
	require.NoError(t, CreateMediaUpload(&MediaUpload{
		UploadId:     "u-fresh",
		UserId:       31,
		ObjectKey:    "media-uploads/31/new.png",
		Filename:     "new.png",
		ContentType:  "image/png",
		Category:     "image",
		DeclaredSize: 10,
		Status:       MediaUploadStatusPending,
		ExpiresAt:    now + 600,
	}))

	affected, err := CleanupExpiredPendingMediaUploads(time.Hour)
	require.NoError(t, err)
	assert.Equal(t, int64(1), affected)

	stale, err := GetMediaUploadByUploadIdForUser("u-stale", 31)
	require.NoError(t, err)
	require.NotNil(t, stale)
	assert.Equal(t, MediaUploadStatusFailed, stale.Status)

	fresh, err := GetMediaUploadByUploadIdForUser("u-fresh", 31)
	require.NoError(t, err)
	require.NotNil(t, fresh)
	assert.Equal(t, MediaUploadStatusPending, fresh.Status)
}

func TestMediaUploadAutoMigrateCompatibleSchema(t *testing.T) {
	// 确认 GORM 标签在 SQLite 上可迁移，与三库兼容策略一致。
	require.True(t, DB.Migrator().HasTable(&MediaUpload{}))
	require.True(t, DB.Migrator().HasColumn(&MediaUpload{}, "UploadId"))
	require.True(t, DB.Migrator().HasColumn(&MediaUpload{}, "UserId"))
	require.True(t, DB.Migrator().HasColumn(&MediaUpload{}, "ObjectKey"))
	require.True(t, DB.Migrator().HasColumn(&MediaUpload{}, "DeclaredSize"))
	require.True(t, DB.Migrator().HasColumn(&MediaUpload{}, "ActualSize"))
	require.True(t, DB.Migrator().HasColumn(&MediaUpload{}, "Status"))
	require.True(t, DB.Migrator().HasColumn(&MediaUpload{}, "ExpiresAt"))
}
