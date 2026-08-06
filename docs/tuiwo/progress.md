# 推窝中转进度日志

## 2026-08-06（视频结果面板 UI）

- **前端已落地：** 视频结果面板（`VideoResultPanel`）— 同构卡片列表、左栏徽章 + 三行提示词 + 键值 +「查看详情」、底栏分页（总数 / 每页 / 页码按钮）、详情 Sheet（全参数 + 参考媒体 + 成片）；无上方独立播放器、无选中高亮。
- **后端已落地：** 任务插入时 `PromoteTaskMediaAssets` 将参考媒体从 `media-uploads/` 提升到 `media-task-assets/`，Input 持久化 `object_key`。
- **未做（按 spec §10）：**「应用参数 / 再来一次」回填左侧表单。

## 2026-08-05（视频生成记录持久化）

- **范围确认：** 分页生成记录、左参数右结果卡片、刷新恢复、成功结果异步转存 MinIO。
- **后端已落地：** `task_type` 筛选、`Properties.Input` 持久化、Ali/Wan3 action 修正、成功后异步转存 `media-results/`、列表/单任务签发预签名 GET。
- **前端已落地：** `GET /api/task/self?task_type=video` 分页卡片（6/12/24）、选中播放、刷新恢复轮询 + localStorage pending ids。
- **部署：** `media-upload-deploy.md` 补充 `media-results/` 30 天生命周期。

## 2026-08-05（多模型 Profile + 媒体上传）

- **收敛：** Ali `AliMetadata` 去掉未使用的 Wan3 字段；补充 last-frame images 回归测试
- **前端 Profile 注册表：** `video-playground/profiles/`（`registry` + `wan30`）；未知模型不回退聊天模型
- **私有 S3 兼容上传：** `GET/POST /api/user/media/*`（预签名 PUT、HEAD 完成校验、额度与审计表 `media_uploads`）
- **上传 UI：** `components/media-uploader`（XHR 直传进度、取消、失败重试、URL 回退）接入 Wan3 媒体槽位
- **部署说明：** `docs/tuiwo/media-upload-deploy.md`（中文；生命周期 7 天、CORS、默认凭证链、环境变量）
- **复查加固：** 支持 AWS 默认凭证链；`media_uploads.expires_at`；过期 pending 清理与 complete 过期拒绝；注释/文档统一中文

## 2026-08-05（续）

- **Wan3.0 后端：** `relay/channel/task/ali` 已支持 `wan3.0-video`（校验/默认参数/计费 seconds + 单测通过）
- **视频游乐场（方案 C）：**
  - 后端：`POST/GET /pg/video/generations`（UserAuth + 临时 Token，与对话游乐场同模式）
  - 前端：独立页 `/playground/video`，feature `video-playground`，侧栏 Chat 分组入口
  - distributor 路径改为匹配 `/video/generations`，覆盖 `/pg/...`
- 计费配置仍搁置；Submox / P1/P2 延后

## 2026-08-05

- **优先级调整：** 计费配置相关**搁置**；**优先接入 Wan 3.0**；Submox / P1/P2 延后
- 已更新 `task_plan.md`、设计里程碑、实施计划 Phase 标注
- 产出 Wan3.0 专用最佳设计：`docs/tuiwo/2026-08-05-wan3-design.md`（对照 PDF + 现有 ali 适配器）
- 产出前端视频入口设计：`docs/tuiwo/2026-08-05-video-ui-design.md`（推荐独立页挂 Chat 分组，不内嵌对话游乐场）

## 2026-08-04

- 提取《推窝中转需求.docx》《Wan3.0邀测模型介绍和接口说明.pdf》
- 勘察仓库：Ali 视频任务适配器已支持 wan2.x，无 wan3.0；计费/Epay/docs_link/Footer/Playground 现状已记录
- 产出 findings、设计说明、实施计划；**未改业务代码**
- 安全：需求文件含明文密钥，已在文档中警示并要求轮换
- 用户确认 P0 核心范围：**接入 Wan3.0 + 以 API Key 形式接入 Submox** 到当前中转；已写入设计「已锁定决策」
- 用户补充 Submox Seedance 2.0 协议：路径与 `task/doubao` 一致；模型 `seedance-2.0`/`seedance-2.0-fast`；设计改为复用 DoubaoVideo 渠道 + 自定义 BaseURL，并与 Seedance 计费合并
- 联调：样例 curl 可达；`seedance_channel_unavailable` 经确认是 **API Key 无积分**，协议与整体接入方案无问题；文档已更新
- 产出计费机制说明 `billing-overview.md`（分析用；现已搁置实施）
