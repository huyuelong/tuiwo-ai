package service

import (
	"fmt"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

const mediaUploadCleanupInterval = time.Hour

// StartMediaUploadCleanup 定期将过期 pending 标为 failed，释放日额度占用。
// 仅主节点执行；对象删除依赖桶生命周期策略。
func StartMediaUploadCleanup() {
	if !common.IsMasterNode {
		return
	}
	go func() {
		cleanupExpiredPendingMediaUploads()
		ticker := time.NewTicker(mediaUploadCleanupInterval)
		defer ticker.Stop()
		for range ticker.C {
			cleanupExpiredPendingMediaUploads()
		}
	}()
}

func cleanupExpiredPendingMediaUploads() {
	// olderThan 与 PUT URL 过期对齐；expires_at>0 时优先按 expires_at
	n, err := model.CleanupExpiredPendingMediaUploads(mediaPutURLExpiry)
	if err != nil {
		common.SysError("failed to cleanup expired pending media uploads: " + err.Error())
		return
	}
	if n > 0 {
		common.SysLog(fmt.Sprintf("cleaned up %d expired pending media uploads", n))
	}
}
