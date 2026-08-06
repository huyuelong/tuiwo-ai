# 媒体上传部署说明（S3 兼容）

视频工作台的私有媒体上传流程：浏览器申请**预签名 PUT** → 直传至 S3 兼容桶 → 服务端 **HEAD** 校验 → 签发 **24 小时预签名 GET** URL。上游视频厂商最终只收到该 HTTPS URL（或用户自行填写的 URL）。

## 环境变量

| 变量 | 是否必填 | 默认值 | 说明 |
|------|----------|--------|------|
| `MEDIA_UPLOAD_ENABLED` | 启用时需为 true | `false` | 总开关 |
| `MEDIA_S3_BUCKET` | 启用时必填 | — | 桶名 |
| `MEDIA_S3_ENDPOINT` | OSS/MinIO/R2 等 | — | 自定义 Endpoint |
| `MEDIA_S3_PUBLIC_ENDPOINT` | 容器部署建议填写 | — | 浏览器直传使用的公开 Endpoint |
| `MEDIA_S3_REGION` | 建议填写 | `us-east-1` | Region |
| `MEDIA_S3_ACCESS_KEY` | 建议显式配置* | — | Access Key（仅环境变量） |
| `MEDIA_S3_SECRET_KEY` | 建议显式配置* | — | Secret Key（仅环境变量） |
| `MEDIA_S3_FORCE_PATH_STYLE` | MinIO 常需 | `false` | 强制 path-style |
| `MEDIA_S3_KEY_PREFIX` | 否 | `media-uploads` | 对象键前缀 |
| `MEDIA_UPLOAD_MAX_IMAGE_MB` | 否 | `20` | 单图上限 |
| `MEDIA_UPLOAD_MAX_AUDIO_MB` | 否 | `100` | 单音频上限 |
| `MEDIA_UPLOAD_MAX_VIDEO_MB` | 否 | `500` | 单视频上限 |
| `MEDIA_UPLOAD_DAILY_BYTES` | 否 | `2147483648`（2 GiB） | 每用户每日额度 |

\* AccessKey/SecretKey 留空时走 **AWS 默认凭证链**（如 EC2/EKS IAM Role）。阿里云 OSS、MinIO、Cloudflare R2 建议始终配置显式密钥。

**禁止**将密钥写入数据库或通过 API 返回前端。

## API（需 UserAuth）

- `GET /api/user/media/upload-config`：是否启用 + 限制（无密钥）
- `POST /api/user/media/uploads/initiate`：返回 10 分钟 PUT URL 与 `upload_id`
- `POST /api/user/media/uploads/complete`：HEAD 校验后返回 24 小时 GET URL

对象键仅由服务端生成：`{prefix}/{userId}/{YYYY}/{MM}/{DD}/{uuid}.{ext}`，例如 `media-uploads/7/2026/08/05/<uuid>.png`。客户端不可指定路径。

Docker 场景通常需要同时配置：

- `MEDIA_S3_ENDPOINT=http://minio:9000`：后端容器访问 MinIO；
- `MEDIA_S3_PUBLIC_ENDPOINT=https://media.example.com`：浏览器访问并参与预签名。本仓库本地 Compose 默认映射为 `http://localhost:9100`，MinIO 控制台为 `http://localhost:9101`。

两者指向同一 MinIO 实例。生产环境的公开 Endpoint 应使用 HTTPS；仅本地开发可使用 HTTP。

## 桶生命周期（生产必配）

上传草稿、任务参考媒体、成功成片使用**不同前缀、不同保留期**：

| 前缀 | 用途 | 建议保留 |
|------|------|----------|
| `media-uploads/` | 未绑定任务的上传草稿 | **7 天** |
| `media-task-assets/` | 已提交任务引用的参考图/音/视频 | **长期**（不配过期，或 ≥ 业务要求的 180/365 天） |
| `media-results/` | 任务成功后异步转存的成片 | **30 天** |

应用对读访问仍签发约 24 小时预签名 GET；「长期可打开」依赖 **object_key 持久化 + 再次签发**，以及 `media-task-assets/` / `media-results/` 对象不被过早删除。

AWS 概念示例：

```json
{
  "Rules": [
    {
      "ID": "media-uploads-7d",
      "Filter": { "Prefix": "media-uploads/" },
      "Status": "Enabled",
      "Expiration": { "Days": 7 }
    },
    {
      "ID": "media-results-30d",
      "Filter": { "Prefix": "media-results/" },
      "Status": "Enabled",
      "Expiration": { "Days": 30 }
    }
  ]
}
```

`media-task-assets/` 若要求真正长期保留，则**不要**为该前缀配置 Expiration（或单独配置更长天数）。阿里云 OSS / MinIO / Cloudflare R2 请配置等价规则。

成功成片对象键：`media-results/{userId}/{YYYY}/{MM}/{DD}/{taskId}.mp4`。  
任务参考媒体对象键：`media-task-assets/{userId}/{taskId}/{index}.{ext}`。  
任务 `PrivateData.StoredResultKey` 有值时，成片优先签发该对象的预签名 GET；参考媒体以 Input 中的 `object_key` 再签发。

## 数据库

`media_uploads` 由 AutoMigrate 维护（SQLite / MySQL / PostgreSQL），记录 pending/completed/failed，用于额度与审计；含 `expires_at`（pending PUT 过期时间）。

可选运维：定期调用 `model.CleanupExpiredPendingMediaUploads(olderThan)`，将过期 pending 标为 failed。对象清理仍依赖桶生命周期。

## CORS

浏览器直传桶，需允许：

- Methods：`PUT`、`HEAD`、`GET`（按需）
- Origins：控制台域名
- Headers：`Content-Type`（及签名要求的其它头）

## 各厂商注意点

| 厂商 | 说明 |
|------|------|
| 阿里云 OSS | 开启 S3 兼容；设置 `MEDIA_S3_ENDPOINT`；一般不必 path-style |
| MinIO | 设置 Endpoint + `MEDIA_S3_FORCE_PATH_STYLE=true` |
| Cloudflare R2 | 账户 Endpoint + Access Key；Region 常用 `auto` |
| AWS S3 | Endpoint 可空；可用 IAM 或静态密钥 |

## 前端行为

视频工作台 Profile 媒体槽位通过 **XHR** 向预签名 URL 直传（不带站点 Cookie）。表单保存 `{uploadId, key, url, name, mime, size}`，提交 `/pg/video/generations` 时**只发送 `url`**。上传关闭时仍可用折叠的「从 URL 添加」入口。
