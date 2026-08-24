# Wan 3.0 视频生成 API

模型名：`wan3.0-video`。底层对接阿里云 DashScope 通义万相 Wan 3.0 异步视频合成，请求语义与[官方文档](https://help.aliyun.com/zh/model-studio/developer-reference/video-generation-api)对齐。

**Base URL**：`https://ai.tuiwo.vip`

下文路径均相对于该域名，例如创建任务完整地址为 `https://ai.tuiwo.vip/v1/video/generations`。

## 鉴权

所有接口使用 API Key：

```http
Authorization: Bearer sk-xxx
```

可选请求体字段 `group` 指定计费分组；未传时使用 API Key 绑定的默认分组。

## 接口一览

| 方法 | 地址 | 说明 |
| --- | --- | --- |
| `POST` | `https://ai.tuiwo.vip/v1/video/generations` | 创建任务 |
| `GET` | `https://ai.tuiwo.vip/v1/video/generations/:task_id` | 查询任务 |
| `GET` | `https://ai.tuiwo.vip/v1/videos/:task_id` | 查询任务（OpenAI Video 格式） |
| `GET` | `https://ai.tuiwo.vip/v1/videos/:task_id/content` | 下载成品视频 |

## 快速测试

**准备**：在控制台创建 API Key，将下方 `sk-xxx` 替换为你的密钥。

### 1. 创建任务

```bash
curl -sS -X POST "https://ai.tuiwo.vip/v1/video/generations" \
  -H "Authorization: Bearer sk-xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "wan3.0-video",
    "prompt": "一只橘猫在窗台上打盹",
    "duration": 5,
    "metadata": {
      "parameters": {
        "resolution": "720P",
        "ratio": "16:9",
        "audio": true
      }
    }
  }'
```

成功时返回 JSON，记下 `task_id`（与 `id` 相同）。

### 2. 查询任务

将 `{task_id}` 替换为上一步返回值，每隔 10–30 秒请求一次，直到 `data.status` 为 `SUCCESS` 或 `FAILURE`：

```bash
curl -sS "https://ai.tuiwo.vip/v1/video/generations/{task_id}" \
  -H "Authorization: Bearer sk-xxx"
```

| `data.status` | 下一步 |
| --- | --- |
| `QUEUED` / `SUBMITTED` / `IN_PROGRESS` | 继续轮询 |
| `SUCCESS` | 进入步骤 3 下载 |
| `FAILURE` | 查看 `data.fail_reason` |

### 3. 下载视频

```bash
curl -L -o video.mp4 \
  "https://ai.tuiwo.vip/v1/videos/{task_id}/content" \
  -H "Authorization: Bearer sk-xxx"
```

下载完成后用播放器打开 `video.mp4` 验证。若文件很小且无法播放，检查是否误下载了 JSON 错误（常见原因：未带 `Authorization` 或任务尚未 `SUCCESS`）。

**通过标准**：创建 → 轮询至 `SUCCESS` → 下载得到可播放 MP4，即接口联调成功。

## 创建任务

```http
POST https://ai.tuiwo.vip/v1/video/generations
Authorization: Bearer sk-xxx
Content-Type: application/json
```

### 请求体

```json
{
  "model": "wan3.0-video",
  "group": "default",
  "prompt": "一只橘猫在窗台上打盹，阳光洒在毛发上",
  "duration": 5,
  "metadata": {
    "parameters": {
      "resolution": "1080P",
      "ratio": "adaptive",
      "audio": true,
      "enable_thinking": false,
      "seed": 42
    },
    "input": {
      "media": [
        { "type": "first_frame", "url": "https://example.com/first.jpg" }
      ]
    }
  }
}
```

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `model` | string | 是 | 固定 `wan3.0-video` |
| `group` | string | 否 | 计费分组 |
| `prompt` | string | 是 | 文本提示词 |
| `duration` | int | 否 | 见「时长」 |
| `metadata.parameters` | object | 否 | 生成参数 |
| `metadata.input.media` | array | 否 | 媒体输入，见「媒体类型」 |

**兼容写法**：顶层 `image` / `images[0]` 可代替 `first_frame`；`images[1]` 可代替 `last_frame`。顶层 `size: "720P"` 可代替 `metadata.parameters.resolution`。

### 生成参数 `metadata.parameters`

| 字段 | 类型 | 默认 | 可选值 |
| --- | --- | --- | --- |
| `resolution` | string | `1080P` | `480P` / `720P` / `1080P` |
| `ratio` | string | `adaptive` | `16:9` / `9:16` / `1:1` / `4:3` / `3:4` / `adaptive` |
| `audio` | bool | — | 是否生成音频 |
| `enable_thinking` | bool | — | 深度思考；使用 `file` / `link` 媒体时须为 `true` |
| `seed` | int | 不传 | `0`–`2147483647`，不传则随机 |

### 时长 `duration`

| 值 | 含义 |
| --- | --- |
| 省略 / `0` | 默认 5 秒 |
| `2`–`30` | 固定时长（秒） |
| `-1` | 智能时长（上游自动决定；预扣按 30 秒计，完成后按实际上游时长结算） |

### 媒体类型 `metadata.input.media[]`

每项须包含 `type` 与 `url`（公网可访问的 HTTP(S) 地址）。

| `type` | 用途 | 数量上限 |
| --- | --- | --- |
| `first_frame` | 首帧图 | 1 |
| `last_frame` | 尾帧图 | 1 |
| `reference_image` | 参考图 | 10 |
| `reference_video` | 参考视频 | 5 |
| `reference_audio` | 参考音频 | 5 |
| `file` | 参考文档（须 `enable_thinking=true`） | 1 |
| `link` | 参考网页（须 `enable_thinking=true`） | 1 |

`file` 与 `link` **互斥**，且不能与首尾帧或其它参考媒体混用。

**模式规则**（由媒体自动判定，无需传 `mode`）：

- 无媒体 → **文生视频**
- 仅 `first_frame` / `last_frame` → **首尾帧生视频**（至少一张）
- 仅参考类媒体（含 `reference_*`） → **参考生视频**（至少一项）
- 仅 `file` 或仅 `link` → **文档/网页生视频**（须 `enable_thinking=true`）
- 首尾帧与参考媒体 **不可混用**

`file` 的 `url` 须指向可公开访问的文档文件（如 PDF、Word、TXT、Markdown、HTML 等）；`link` 的 `url` 须为可公开访问的网页地址。

### 提交响应

```json
{
  "id": "task_abc123",
  "task_id": "task_abc123",
  "object": "video",
  "model": "wan3.0-video",
  "status": "queued",
  "progress": 0,
  "created_at": 1730000000
}
```

`id` / `task_id` 为平台任务 ID，后续查询与下载均使用此 ID。

## 查询任务

```http
GET https://ai.tuiwo.vip/v1/video/generations/task_abc123
Authorization: Bearer sk-xxx
```

响应：

```json
{
  "code": "success",
  "data": {
    "task_id": "task_abc123",
    "status": "SUCCESS",
    "progress": "100%",
    "result_url": "https://...",
    "action": "textGenerate",
    "fail_reason": "",
    "submit_time": 1730000000,
    "finish_time": 1730000060,
    "properties": {
      "origin_model_name": "wan3.0-video"
    }
  }
}
```

| `status` | 含义 |
| --- | --- |
| `QUEUED` / `SUBMITTED` | 排队中 |
| `IN_PROGRESS` | 生成中 |
| `SUCCESS` | 完成，`result_url` 为视频地址 |
| `FAILURE` | 失败，见 `fail_reason` |

**OpenAI 格式**：`GET https://ai.tuiwo.vip/v1/videos/:task_id` 返回 `status` 为 `queued` / `in_progress` / `completed` / `failed`；完成时视频 URL 在 `metadata.url`。

## 下载视频

任务 `status` 为 `SUCCESS` 后，通过代理接口下载成品视频：

```http
GET https://ai.tuiwo.vip/v1/videos/task_abc123/content
Authorization: Bearer sk-xxx
```

**请求要求**

- 必须携带与创建/查询任务相同的 `Authorization: Bearer sk-xxx` 头；缺少或无效时返回 JSON 错误（HTTP `401`），不会返回视频流。
- 仅当任务存在、归属当前 API Key 对应用户且状态为 `SUCCESS` 时可下载。

**成功响应**

- HTTP `200`
- `Content-Type: video/mp4`（或上游实际视频类型）
- `Content-Disposition: attachment; filename="task_abc123.mp4"`
- Body 为视频二进制流

**常见错误**

| HTTP | 说明 |
| --- | --- |
| `400` | 任务尚未完成 |
| `401` | 未鉴权或 API Key 无效 |
| `404` | 任务不存在或不属于当前用户 |
| `502` | 上游视频拉取失败 |

错误响应为 JSON，例如：

```json
{
  "error": {
    "message": "Task is not completed yet, current status: IN_PROGRESS",
    "type": "invalid_request_error"
  }
}
```

客户端应检查 `Content-Type` 是否为 `video/*`，避免将 JSON 错误体误保存为视频文件。

## 示例

### 文生视频

```json
{
  "model": "wan3.0-video",
  "prompt": "赛博朋克风格的城市夜景，霓虹灯倒映在雨后路面",
  "duration": 8,
  "metadata": {
    "parameters": {
      "resolution": "720P",
      "ratio": "16:9",
      "audio": true
    }
  }
}
```

### 首尾帧生视频

```json
{
  "model": "wan3.0-video",
  "prompt": "从首帧平滑过渡到尾帧",
  "duration": 5,
  "metadata": {
    "input": {
      "media": [
        { "type": "first_frame", "url": "https://example.com/start.jpg" },
        { "type": "last_frame", "url": "https://example.com/end.jpg" }
      ]
    }
  }
}
```

### 参考生视频

```json
{
  "model": "wan3.0-video",
  "prompt": "参考视频1的动作，结合参考图3的风格",
  "duration": 10,
  "metadata": {
    "parameters": { "ratio": "adaptive", "audio": false },
    "input": {
      "media": [
        { "type": "reference_video", "url": "https://example.com/ref.mp4" },
        { "type": "reference_image", "url": "https://example.com/style.jpg" }
      ]
    }
  }
}
```

### 文档生视频（`file`）

```json
{
  "model": "wan3.0-video",
  "prompt": "根据文档内容生成一段讲解视频",
  "duration": 10,
  "metadata": {
    "parameters": {
      "enable_thinking": true,
      "resolution": "720P",
      "ratio": "16:9",
      "audio": true
    },
    "input": {
      "media": [
        { "type": "file", "url": "https://example.com/brief.pdf" }
      ]
    }
  }
}
```

### 网页生视频（`link`）

```json
{
  "model": "wan3.0-video",
  "prompt": "根据网页信息生成产品宣传短片",
  "duration": 8,
  "metadata": {
    "parameters": {
      "enable_thinking": true,
      "resolution": "1080P",
      "ratio": "adaptive"
    },
    "input": {
      "media": [
        { "type": "link", "url": "https://example.com/product-page" }
      ]
    }
  }
}
```

## 错误

参数校验失败返回 HTTP `400`，body 含 `code` 与 `message`，例如：

- `wan3.0-video requires prompt`
- `wan3.0-video reference media and first/last frame are mutually exclusive`
- `wan3.0-video duration must be -1 or between 2 and 30`
- `wan3.0-video file/link require parameters.enable_thinking=true`
- `wan3.0-video file and link are mutually exclusive`
- `wan3.0-video allows at most one file or one link`

上游或渠道错误以任务 `FAILURE` 或 HTTP 错误响应返回，具体文案见 `fail_reason` / `error.message`。

## 计费

- 按视频秒数 × 分辨率倍率计费：`480P`=1×、`720P`=2×、`1080P`=4×。
- `duration=-1` 预扣 30 秒，完成后按上游实际时长多退少补。
- 单价以控制台模型定价为准。
