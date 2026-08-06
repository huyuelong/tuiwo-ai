package model

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestTaskGetAllUserTaskFiltersByTaskType(t *testing.T) {
	truncateTables(t)

	video := &Task{
		TaskID:   "task_video_1",
		UserId:   9,
		TaskType: constant.TaskTypeVideo,
		Status:   TaskStatusSuccess,
		Action:   constant.TaskActionTextGenerate,
	}
	other := &Task{
		TaskID:   "task_other_1",
		UserId:   9,
		TaskType: "",
		Status:   TaskStatusSuccess,
		Action:   constant.SunoActionMusic,
	}
	insertTask(t, video)
	insertTask(t, other)

	items := TaskGetAllUserTask(9, 0, 20, SyncTaskQueryParams{TaskType: constant.TaskTypeVideo})
	require.Len(t, items, 1)
	assert.Equal(t, "task_video_1", items[0].TaskID)

	total := TaskCountAllUserTask(9, SyncTaskQueryParams{TaskType: constant.TaskTypeVideo})
	assert.EqualValues(t, 1, total)
}

func TestResolveTaskTypeFromAction(t *testing.T) {
	t.Parallel()

	assert.Equal(t, constant.TaskTypeVideo, ResolveTaskType(constant.TaskActionTextGenerate))
	assert.Equal(t, constant.TaskTypeVideo, ResolveTaskType(constant.TaskActionFirstTailGenerate))
	assert.Equal(t, constant.TaskTypeVideo, ResolveTaskType(constant.TaskActionReferenceGenerate))
	assert.Equal(t, constant.TaskTypeVideo, ResolveTaskType(constant.TaskActionGenerate))
	assert.Equal(t, constant.TaskTypeMusic, ResolveTaskType(constant.SunoActionMusic))
	assert.Equal(t, constant.TaskTypeMusic, ResolveTaskType(constant.SunoActionLyrics))
	assert.Equal(t, "", ResolveTaskType("unknown"))
}
