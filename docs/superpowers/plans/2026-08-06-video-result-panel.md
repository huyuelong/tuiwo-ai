# Video Result Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the video playground「生成结果」area into a unified isomorphic card list with table-aligned pagination, a detail Sheet, and durable task-bound reference media in MinIO.

**Architecture:** Backend promotes referenced uploads from `media-uploads/` to `media-task-assets/{userId}/{taskId}/` when a task is inserted, persists `object_key` inside `Properties.Input`, and exposes a user-scoped batch PresignGet API for the detail Sheet. Frontend removes the top focus player, renders one card stream (left summary / right result), sticky chrome + bottom pagination with page numbers, and opens a Sheet for full params + media.

**Tech Stack:** Go/Gin/GORM, AWS SDK S3 CopyObject, React 19, TanStack Query, Base UI Sheet, Tailwind, i18next, Bun, `node:test` via `bun test`

**Spec:** `docs/superpowers/specs/2026-08-06-video-result-panel-design.md`

---

## File map

| File | Responsibility |
| --- | --- |
| `service/media_storage.go` | Add `Copy` to `mediaS3API`; helpers for task-asset keys |
| `service/task_media_assets.go` | Promote media into `media-task-assets/`, enrich Input JSON |
| `service/task_media_assets_test.go` | Unit tests for promote / key rules |
| `controller/relay.go` | After building Input, promote + rewrite before `Insert` |
| `controller/media_upload.go` | Batch presign-get handler |
| `dto/media_upload.go` | Presign request/response DTOs |
| `router/api-router.go` | Route `POST /api/user/media/presign-get` |
| `web/.../types.ts` | Extend `VideoMediaItem` with optional `object_key` |
| `web/.../wan30/build-request.ts` | Send `object_key` alongside `url` |
| `web/.../lib/parse-task-input.ts` | Helpers: duration text, status label keys, media groups |
| `web/.../components/history-pagination.tsx` | Bottom bar: total + page size + page numbers |
| `web/.../components/history-card.tsx` | Badge + 3-line prompt + kv + view details + right result |
| `web/.../components/task-detail-sheet.tsx` | Sheet with full params + media |
| `web/.../components/result-panel.tsx` | Panel shell: header, list, pagination |
| `web/.../hooks/use-video-generation.ts` | Drop select/focus UI coupling; keep multi-poll |
| `web/.../hooks/use-video-history.ts` | Unchanged query; expose running count helper if needed |
| `web/.../index.tsx` | Wire `VideoResultPanel` only on the right |
| `web/src/i18n` via `add-missing-keys.mjs` | New UI strings |

**Out of scope:** Apply-parameters / remix form fill; public permanent URLs.

---

### Task 1: S3 Copy + task-asset object keys

**Files:**
- Modify: `service/media_storage.go`
- Create: `service/task_media_assets.go`
- Test: `service/task_media_assets_test.go`

- [ ] **Step 1: Write failing tests for key generation and promote rewrite**

```go
package service

import (
	"context"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGenerateMediaTaskAssetObjectKey(t *testing.T) {
	key, err := GenerateMediaTaskAssetObjectKey(7, "task_abc", 0, ".png")
	require.NoError(t, err)
	assert.Equal(t, "media-task-assets/7/task_abc/0.png", key)

	_, err = GenerateMediaTaskAssetObjectKey(0, "task_abc", 0, ".png")
	assert.Error(t, err)
}

func TestPromoteTaskMediaAssetsRewritesObjectKeys(t *testing.T) {
	fake := &fakeMediaS3{copyOK: true}
	SetMediaS3ClientForTest(fake, nil)
	t.Cleanup(func() { SetMediaS3ClientForTest(nil, nil) })

	input := `{"prompt":"x","metadata":{"input":{"media":[{"type":"first_frame","url":"https://x","object_key":"media-uploads/7/2026/08/06/a.png"}]}}}`
	out, err := PromoteTaskMediaAssets(context.Background(), 7, "task_abc", input)
	require.NoError(t, err)
	assert.Contains(t, out, "media-task-assets/7/task_abc/0.png")
	assert.Len(t, fake.copyCalls, 1)
	assert.True(t, strings.HasPrefix(fake.copyCalls[0].dst, "media-task-assets/"))
}
```

Extend the existing test fake in `media_storage_flow_test.go` **or** define a local `fakeMediaS3` in the new test file that implements `Copy` plus existing methods.

- [ ] **Step 2: Run test — expect fail**

Run: `go test ./service -count=1 -run "GenerateMediaTaskAssetObjectKey|PromoteTaskMediaAssets" -v`  
Expected: FAIL (undefined symbols / missing Copy)

- [ ] **Step 3: Implement Copy + promote helpers**

In `mediaS3API` add:

```go
Copy(ctx context.Context, srcKey, dstKey string) error
```

AWS impl:

```go
func (c *awsMediaS3Client) Copy(ctx context.Context, srcKey, dstKey string) error {
	_, err := c.client.CopyObject(ctx, &s3.CopyObjectInput{
		Bucket:     aws.String(c.bucket),
		CopySource: aws.String(url.PathEscape(c.bucket + "/" + srcKey)),
		Key:        aws.String(dstKey),
	})
	return err
}
```

(Use the SDK’s documented `CopySource` format for path-style / virtual-host; match existing bucket config.)

`task_media_assets.go`:

```go
const defaultMediaTaskAssetKeyPrefix = "media-task-assets"

func GenerateMediaTaskAssetObjectKey(userId int, taskID string, index int, ext string) (string, error) { /* validate; return media-task-assets/{userId}/{taskID}/{index}{ext} */ }

// PromoteTaskMediaAssets copies media-uploads keys owned by userId into media-task-assets,
// rewrites metadata.input.media[].object_key in the Input JSON, returns updated JSON string.
// On S3/disabled errors: log and return original input unchanged (do not fail task insert).
func PromoteTaskMediaAssets(ctx context.Context, userId int, taskID, inputJSON string) (string, error)
```

Rules:
- Only copy keys with prefix `media-uploads/{userId}/`
- Skip empty / foreign / already `media-task-assets/` keys
- Keep `url` and `type`; set new `object_key`
- Parse/marshal via `common.Unmarshal` / `common.Marshal`

Update all fakes implementing `mediaS3API` to add `Copy`.

- [ ] **Step 4: Run tests — expect pass**

Run: `go test ./service -count=1 -run "GenerateMediaTaskAssetObjectKey|PromoteTaskMediaAssets|MediaUpload|ArchiveTaskResult" -v`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add service/media_storage.go service/task_media_assets.go service/task_media_assets_test.go service/media_storage_flow_test.go
git commit -m "feat(media): promote task reference assets to durable prefix"
```

---

### Task 2: Wire promote into task insert

**Files:**
- Modify: `controller/relay.go` (task success insert block ~605–612)

- [ ] **Step 1: Write a focused unit test if feasible; else integration-style service test already covers promote — add a small helper test for “empty media no-op”**

```go
func TestPromoteTaskMediaAssetsNoMediaReturnsSame(t *testing.T) {
	in := `{"prompt":"only text"}`
	out, err := PromoteTaskMediaAssets(context.Background(), 1, "task_x", in)
	require.NoError(t, err)
	assert.JSONEq(t, in, out)
}
```

- [ ] **Step 2: Run — fail or pass depending on Task 1; implement if missing**

- [ ] **Step 3: Change insert path**

Replace Input assignment with:

```go
if taskReq, err := relaycommon.GetTaskRequest(c); err == nil {
	if raw, marshalErr := common.Marshal(taskReq); marshalErr == nil {
		input := string(raw)
		if promoted, promoErr := service.PromoteTaskMediaAssets(c.Request.Context(), relayInfo.UserId, task.TaskID, input); promoErr != nil {
			common.SysError("promote task media assets: " + promoErr.Error())
		} else {
			input = promoted
		}
		task.Properties.Input = input
	}
}
```

Do this **after** `task.TaskID` is assigned (`InitTask` already sets it).

- [ ] **Step 4: Build**

Run: `go build -o NUL ./controller ./service`  
Expected: success

- [ ] **Step 5: Commit**

```bash
git add controller/relay.go service/task_media_assets_test.go
git commit -m "feat(task): persist promoted media object keys in Properties.Input"
```

---

### Task 3: Batch PresignGet API for owned object keys

**Files:**
- Modify: `dto/media_upload.go`
- Modify: `service/media_storage.go` (or new `service/media_presign.go`)
- Modify: `controller/media_upload.go`
- Modify: `router/api-router.go`
- Test: `service/media_presign_test.go`

- [ ] **Step 1: Failing tests for key ownership**

```go
func TestPresignOwnedMediaKeysRejectsForeignPrefix(t *testing.T) {
	_, err := PresignOwnedMediaKeys(context.Background(), 7, []string{"media-task-assets/8/task/0.png"})
	assert.Error(t, err)
}

func TestPresignOwnedMediaKeysAllowsTaskAssets(t *testing.T) {
	fake := &fakeMediaS3{getURL: "https://signed.example/x"}
	SetMediaS3ClientForTest(fake, nil)
	t.Cleanup(func() { SetMediaS3ClientForTest(nil, nil) })
	out, err := PresignOwnedMediaKeys(context.Background(), 7, []string{"media-task-assets/7/task/0.png"})
	require.NoError(t, err)
	assert.Equal(t, "https://signed.example/x", out["media-task-assets/7/task/0.png"])
}
```

Allowed prefixes for user `U`: `media-task-assets/{U}/`, optionally `media-uploads/{U}/` (read own drafts). Cap list length (e.g. 40).

- [ ] **Step 2: Run — expect fail**

- [ ] **Step 3: Implement**

DTO:

```go
type MediaPresignGetRequest struct {
	ObjectKeys []string `json:"object_keys"`
}
type MediaPresignGetResponse struct {
	URLs map[string]string `json:"urls"` // key -> get_url
}
```

Controller + route under UserAuth self group:

`POST /api/user/media/presign-get`

- [ ] **Step 4: Tests pass + build**

Run: `go test ./service -count=1 -run PresignOwnedMediaKeys -v`

- [ ] **Step 5: Commit**

```bash
git add dto/media_upload.go service/media_presign.go service/media_presign_test.go controller/media_upload.go router/api-router.go
git commit -m "feat(media): add user-scoped batch presign-get for task assets"
```

---

### Task 4: Frontend submit includes `object_key`

**Files:**
- Modify: `web/src/features/video-playground/types.ts`
- Modify: `web/src/features/video-playground/profiles/wan30/build-request.ts`
- Modify: `web/src/features/video-playground/lib/__tests__/build-request.test.ts`

- [ ] **Step 1: Extend type + failing test**

```ts
export type VideoMediaItem = {
  type: string
  url: string
  object_key?: string
}
```

In `build-request.test.ts` assert frames mode includes `object_key` when asset has `key`.

- [ ] **Step 2: Run**

```bash
cd web && bun test src/features/video-playground/lib/__tests__/build-request.test.ts
```

Expected: FAIL on missing `object_key`

- [ ] **Step 3: Implement**

```ts
return assets.slice(0, limit).map((asset) => ({
  type,
  url: asset.url,
  ...(asset.key ? { object_key: asset.key } : {}),
}))
```

Upstream Ali still only needs `url`; extra field is ignored by adaptor / survives in stored Input after promote.

- [ ] **Step 4: Tests pass**

- [ ] **Step 5: Commit**

```bash
git add web/src/features/video-playground/types.ts web/src/features/video-playground/profiles/wan30/build-request.ts web/src/features/video-playground/lib/__tests__/build-request.test.ts
git commit -m "feat(video-playground): include object_key in submit media items"
```

---

### Task 5: Parse helpers for card / detail

**Files:**
- Modify: `web/src/features/video-playground/lib/parse-task-input.ts`
- Modify: `web/src/features/video-playground/lib/__tests__/parse-task-input.test.ts`

- [ ] **Step 1: Tests for status label, elapsed, media grouping, size line**

```ts
test('formatTaskElapsed returns dash when unfinished', () => {
  assert.equal(formatTaskElapsed({ task_id: 't', status: 'IN_PROGRESS', submit_time: 100 }), '-')
})

test('groupTaskMedia buckets by type', () => {
  const groups = groupTaskMedia({
    task_id: 't',
    status: 'SUCCESS',
    properties: {
      input: JSON.stringify({
        metadata: {
          input: {
            media: [
              { type: 'first_frame', url: 'https://a', object_key: 'media-task-assets/1/t/0.png' },
              { type: 'reference_audio', url: 'https://b', object_key: 'media-task-assets/1/t/1.mp3' },
            ],
          },
        },
      }),
    },
  })
  assert.equal(groups.firstFrame.length, 1)
  assert.equal(groups.referenceAudios.length, 1)
})
```

- [ ] **Step 2: Run — fail**

- [ ] **Step 3: Implement helpers** (`resolveStatusLabelKey`, `formatTaskElapsed`, `formatSizeLine`, `groupTaskMedia`, `truncateTaskId`)

- [ ] **Step 4: Pass**

- [ ] **Step 5: Commit**

```bash
git add web/src/features/video-playground/lib/parse-task-input.ts web/src/features/video-playground/lib/__tests__/parse-task-input.test.ts
git commit -m "feat(video-playground): add task card and detail parse helpers"
```

---

### Task 6: History pagination component

**Files:**
- Create: `web/src/features/video-playground/components/history-pagination.tsx`
- Modify: `web/src/features/video-playground/components/history-list.tsx` (or replace usage)

- [ ] **Step 1: Implement `VideoHistoryPagination`**

Props: `page`, `pageSize`, `total`, `totalPages`, `onPageChange`, `onPageSizeChange`

Layout (right-aligned, mirror `DataTablePagination`):
- `Total:` + number
- `Rows per page` / `Per page` + Select `6|12|24`
- First / Prev / `getPageNumbers` buttons / Next / Last using `Button` `variant="outline"` `size` icon

Use `getPageNumbers` from `@/lib/utils`.

- [ ] **Step 2: typecheck**

```bash
cd web && bun run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add web/src/features/video-playground/components/history-pagination.tsx
git commit -m "feat(video-playground): add table-aligned history pagination bar"
```

---

### Task 7: Redesign history card (no selection)

**Files:**
- Modify: `web/src/features/video-playground/components/history-card.tsx`

- [ ] **Step 1: Rewrite card UI per spec §4**

- Left: badges (ID truncate+copy, status, mode) → prompt `line-clamp-3` + copy → kv rows → `View details` button only  
- Right: video / progress / failure  
- Remove `selected` prop, role=button select, and selection styles  
- `onViewDetails: (task) => void`

- [ ] **Step 2: typecheck**

- [ ] **Step 3: Commit**

```bash
git add web/src/features/video-playground/components/history-card.tsx
git commit -m "feat(video-playground): restructure history card summary layout"
```

---

### Task 8: Task detail Sheet + media presign

**Files:**
- Create: `web/src/features/video-playground/components/task-detail-sheet.tsx`
- Modify: `web/src/features/video-playground/api.ts` / `media-api.ts`
- Create: `web/src/features/video-playground/lib/__tests__/` optional for URL map merge

- [ ] **Step 1: API helper**

```ts
export async function presignMediaObjectKeys(objectKeys: string[]): Promise<Record<string, string>> {
  const res = await api.post('/api/user/media/presign-get', { object_keys: objectKeys }, { skipErrorHandler: true } as object)
  if (!res.data?.success) throw new Error(res.data?.message || 'presign failed')
  return (res.data.data?.urls || {}) as Record<string, string>
}
```

- [ ] **Step 2: `VideoTaskDetailSheet`**

Props: `task: VideoTaskDto | null`, `open`, `onOpenChange`

On open: collect object_keys from `groupTaskMedia`; call presign; render sections per spec §5. Missing key →「媒体已失效」.

Use `Sheet`, `SheetContent` side right from `@/components/ui/sheet`.

- [ ] **Step 3: typecheck**

- [ ] **Step 4: Commit**

```bash
git add web/src/features/video-playground/components/task-detail-sheet.tsx web/src/features/video-playground/media-api.ts
git commit -m "feat(video-playground): add task detail sheet with media presign"
```

---

### Task 9: Result panel shell + wire playground

**Files:**
- Create: `web/src/features/video-playground/components/result-panel.tsx`
- Modify: `web/src/features/video-playground/components/history-list.tsx`
- Modify: `web/src/features/video-playground/index.tsx`
- Modify: `web/src/features/video-playground/hooks/use-video-generation.ts` (remove selectTask-driven UI if unused)

- [ ] **Step 1: `VideoResultPanel`**

Structure:
```
Card
  header: Generation result | Task Logs
  sticky subheader: Recent generations · N running
  scroll: map items → VideoHistoryCard
  footer: VideoHistoryPagination
+ VideoTaskDetailSheet
```

Empty: single「No generation history yet.」  
Running count: count non-terminal on current page ∪ pending ids.

- [ ] **Step 2: Simplify `index.tsx` right column to `<VideoResultPanel ... />`**

Remove top Task ID / Status / Progress / standalone player block.  
Keep left params column.  
On submit success: `history.invalidate()`; resume polling unchanged.

- [ ] **Step 3: Drop unused `selectTask` from page resume logic** — still resume polling for pending ids; do not set a “focused” card.

- [ ] **Step 4: typecheck + tests**

```bash
cd web && bun run typecheck && bun test src/features/video-playground
```

Expected: all pass

- [ ] **Step 5: Commit**

```bash
git add web/src/features/video-playground/
git commit -m "feat(video-playground): unify generation result panel list and chrome"
```

---

### Task 10: i18n keys

**Files:**
- Create temporary `web/scripts/add-missing-keys.mjs` (or reuse pattern), run sync, delete script

New keys (English source), at minimum:
- `View details`
- `Copy prompt`
- `Copy task ID`
- `Completed` / keep existing status words if present
- `Generation time`
- `Duration / size`
- `Media unavailable`
- `Reference media`
- `First frame` / `Last frame` (if missing)
- `Running: {{count}}` or `{{count}} running`

- [ ] **Step 1: Add keys via script for en/zh/zh-TW/fr/ja/ru/vi**

- [ ] **Step 2: `cd web && bun run i18n:sync`**

- [ ] **Step 3: Commit**

```bash
git add web/src/i18n/locales/*.json
git commit -m "i18n: add video result panel and detail sheet strings"
```

---

### Task 11: Docs + verification

**Files:**
- `docs/tuiwo/progress.md` (short note)
- Confirm `docs/tuiwo/media-upload-deploy.md` already lists `media-task-assets/`

- [ ] **Step 1: Manual checklist against spec §11**

- [ ] **Step 2: Full verify**

```bash
go test ./service ./model ./relay/channel/task/ali -count=1
cd web && bun run typecheck && bun test src/features/video-playground
```

- [ ] **Step 3: Commit progress note if changed**

```bash
git add docs/tuiwo/progress.md
git commit -m "docs: note video result panel implementation progress"
```

---

## Spec coverage self-check

| Spec item | Task |
| --- | --- |
| Unified list, no top player, no selection | 7, 9 |
| Sticky header + bottom pagination + page numbers | 6, 9 |
| Card left layout (badges, 3-line prompt, kv, view details) | 7 |
| Detail Sheet + full params + media groups | 8 |
| Task-bound `media-task-assets/` + object_key in Input | 1, 2, 4 |
| Re-presign on detail | 3, 8 |
| Apply params deferred | — (explicit non-goal) |
| Multi-poll + refresh restore | 9 (keep existing hooks) |
| i18n | 10 |
| Old tasks degrade | 8 |

## Placeholder scan

No TBD steps; commands and file paths are concrete.

---

## Execution

Plan saved to `docs/superpowers/plans/2026-08-06-video-result-panel.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks  
2. **Inline Execution** — implement in this session with executing-plans checkpoints  

Which approach?
