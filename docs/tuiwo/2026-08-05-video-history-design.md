# 视频生成记录持久化设计方案

状态：已落地（后端 + 前端）
日期：2026-08-05

## 一、目标

用户在视频游乐场刷新、切页、重进后，仍能分页查看自己的生成记录：

- 每条记录以卡片展示：**左侧生成参数，右侧生成结果**
- 支持分页，页大小可选 `6 / 12 / 24`
- 进行中的任务刷新后自动恢复轮询
- 成功视频异步转存 MinIO，历史结果长期可播放

## 二、最佳方案（已确认）

### 2.1 唯一真相源

继续使用既有 `model.Task` + `GET /api/task/self`，**不新建历史表**。

否掉 localStorage 存历史：换设备丢失、与计费状态可能不一致。localStorage 仅缓存「未完成 task_id」用于首屏乐观恢复。

### 2.2 稳定筛选：`task_type`

| 方案 | 结论 |
| --- | --- |
| 仅 `platform=17` | 脆弱；Ali 平台未来可能混入非视频任务 |
| 仅 `action` 白名单 | 当前 Ali/Wan3 经常落成 `textGenerate`，首尾帧/参考也被记成文生 |
| **新增 `task_type`** | **采用**：`video` / `image` / `music` / 空；旧行留空，前端可回退 |

落地：

1. `model.Task` 增加 `TaskType string`（`varchar(20);index`）
2. `InitTask` / 插入处写入；视频任务统一写 `video`
3. `SyncTaskQueryParams` + `GetUserTask` 支持 `task_type`
4. 同时修正 Ali action：根据 metadata media 写入 `firstTailGenerate` / `referenceGenerate`

### 2.3 参数可回放：持久化 `Properties.Input`

调研确认：`Properties.Input` 字段存在但创建任务时从未写入。

提交成功插入任务时，把请求快照（model、prompt、metadata 等）序列化写入 `Properties.Input`。历史卡片左侧从该字段解析展示；后续「再来一次」复用同一数据。

### 2.4 结果长期可用：成功后异步转存 MinIO

上游签名 URL 约 24h 过期。仅做列表不够。

流程：

1. 轮询 `SUCCESS` 且 CAS 获胜后，保留 `PrivateData.ResultURL`（上游原始 URL）
2. 异步拉取视频 → `PutObject` 到 `media-results/{userId}/{YYYY}/{MM}/{DD}/{taskId}.mp4`
3. 成功后写 `PrivateData.StoredResultKey`；失败只记日志，不改任务状态、不阻断计费
4. `TaskModel2Dto` / `GetResultURL`：若有 StoredResultKey，签发 24h GET 预签名；否则回退上游 URL
5. 生命周期独立配置（默认 30 天），与上传前缀 `media-uploads/`（7 天）分离

转存前置：扩展 `mediaS3API` 增加服务端 `Put`；下载设超时、大小上限、非 2xx 拒绝。

### 2.5 前端布局（2026-08-06 修订）

详细 UI 规格见：`docs/superpowers/specs/2026-08-06-video-result-panel-design.md`。

右侧「生成结果」为**单一同构卡片列表**（当前生成与历史在一起），支持多任务并行：

```
┌─ 生成结果 ────────────────── [任务日志] ─┐
│ 最近生成 · N 进行中                       │  ← 顶栏固定
├──────────────────────────────────────────┤
│ ┌────────────┬─────────────────────────┐ │
│ │ 左：参数    │ 右：视频 / 进度 / 失败   │ │  ← 唯一滚动区
│ └────────────┴─────────────────────────┘ │
├──────────────────────────────────────────┤
│ 共 N · 每页 [6▾] · « ‹ 1 2 3 … › »      │  ← 底栏固定（对齐表格分页习惯）
└──────────────────────────────────────────┘
```

要点：

- **无**上方独立大播放器 / Task ID 详情块；**无**卡片选中高亮
- 卡片左栏：徽章 + 三行提示词 + 键值摘要 +「查看详情」（右侧 Sheet 展全量参数与参考媒体）
- 「应用参数」**后续迭代**，本轮不做
- 参考媒体：提交后提升到 `media-task-assets/`，Input 存 object_key，详情再预签名（见 `2026-08-06-video-result-panel-design.md` §6）
- 分页：`useQuery` + `p` / `page_size`（6/12/24）；底栏含可点页码（`getPageNumbers`）
- 刷新恢复：首屏拉第一页，非终态并入轮询；localStorage 仅缓存未完成 task id
- 不直接绑 `DataTablePagination`（依赖 TanStack Table），视觉与控件组合对齐之

### 2.6 与任务日志的分工

| | 任务日志 | 游乐场记录 |
| --- | --- | --- |
| 形态 | 表格 | 参数+结果卡片 |
| 范围 | 全量任务 | `task_type=video` |
| 目的 | 对账排查 | 创作回看 |

共用 `GET /api/task/self`。

## 三、实施顺序

1. 后端：`task_type`、Input 持久化、查询参数、Ali action 修正
2. 后端：结果异步转存 + DTO 签发
3. 前端：分页卡片、刷新恢复、页大小切换
4. i18n、部署文档、回归测试

## 四、验收标准

- 刷新后仍能看到历史卡片与进行中任务
- 分页与 6/12/24 切换正确，总数来自服务端；底栏含可点页码
- 单一同构卡片列表（左参数右结果）；无上方独立播放器、无选中高亮
- 成功任务 MinIO 中出现 `media-results/...` 对象；过期上游链接后仍可用预签名播放
- 转存失败时任务仍为 SUCCESS，仍可尝试上游 URL
- 旧任务无 `task_type` / 无 StoredResultKey 时不报错

UI 细节以 `docs/superpowers/specs/2026-08-06-video-result-panel-design.md` 为准。
