package ali

import (
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
)

const (
	wan30ModelName = "wan3.0-video"

	wan30MediaReferenceImage = "reference_image"
	wan30MediaReferenceVideo = "reference_video"
	wan30MediaReferenceAudio = "reference_audio"
	wan30MediaFirstFrame     = "first_frame"
	wan30MediaLastFrame      = "last_frame"
	wan30MediaFile           = "file"
	wan30MediaLink           = "link"

	wan30MaxReferenceImages = 10
	wan30MaxReferenceVideos = 5
	wan30MaxReferenceAudios = 5
	wan30MinDuration        = 2
	wan30MaxDuration        = 30
)

func isWan30Model(model string) bool {
	return model == wan30ModelName || strings.HasPrefix(model, wan30ModelName)
}

func isWan30ReferenceType(mediaType string) bool {
	switch mediaType {
	case wan30MediaReferenceImage, wan30MediaReferenceVideo, wan30MediaReferenceAudio,
		wan30MediaFile, wan30MediaLink:
		return true
	default:
		return false
	}
}

func isWan30FrameType(mediaType string) bool {
	return mediaType == wan30MediaFirstFrame || mediaType == wan30MediaLastFrame
}

// normalizeWan30Request 按 Wan3.0 协议规范化请求：清遗留字段、可选首尾帧捷径、互斥与限额校验。
// duration=-1 表示智能时长（预扣按 30s）；其它未设置默认 5，合法范围为 2–30。
func normalizeWan30Request(aliReq *AliVideoRequest, req relaycommon.TaskSubmitReq) error {
	if !isWan30Model(aliReq.Model) {
		return nil
	}

	// 统一走 input.media，避免混用旧字段
	aliReq.Input.ImgURL = ""
	aliReq.Input.FirstFrameURL = ""
	aliReq.Input.LastFrameURL = ""
	aliReq.Input.AudioURL = ""
	aliReq.Input.NegativePrompt = ""

	// wan3 不使用 wan2 的 prompt_extend
	aliReq.Parameters.PromptExtend = false

	if len(aliReq.Input.Media) == 0 {
		if first := firstTaskImage(req); first != "" {
			aliReq.Input.Media = append(aliReq.Input.Media, AliVideoMedia{
				Type: wan30MediaFirstFrame,
				URL:  first,
			})
		}
		if last := secondTaskImage(req); last != "" {
			aliReq.Input.Media = append(aliReq.Input.Media, AliVideoMedia{
				Type: wan30MediaLastFrame,
				URL:  last,
			})
		}
	}

	if strings.TrimSpace(aliReq.Input.Prompt) == "" {
		return fmt.Errorf("wan3.0-video requires prompt")
	}

	if err := validateWan30Media(aliReq); err != nil {
		return err
	}
	if err := applyWan30ParameterDefaults(aliReq); err != nil {
		return err
	}
	return nil
}

// resolveWan30Action 根据规范化后的 media 类型确定任务 action，供任务列表筛选与展示。
func resolveWan30Action(aliReq *AliVideoRequest) string {
	if aliReq == nil {
		return constant.TaskActionTextGenerate
	}
	hasFrame := false
	hasReference := false
	for _, item := range aliReq.Input.Media {
		mediaType := strings.TrimSpace(item.Type)
		if isWan30FrameType(mediaType) {
			hasFrame = true
		}
		if isWan30ReferenceType(mediaType) {
			hasReference = true
		}
	}
	if hasReference {
		return constant.TaskActionReferenceGenerate
	}
	if hasFrame {
		return constant.TaskActionFirstTailGenerate
	}
	return constant.TaskActionTextGenerate
}

func validateWan30Media(aliReq *AliVideoRequest) error {
	var (
		refCount, frameCount           int
		imageCount, videoCount, audioCount int
		fileCount, linkCount           int
		firstCount, lastCount          int
		enableThinking                 bool
	)
	if aliReq.Parameters != nil && aliReq.Parameters.EnableThinking != nil {
		enableThinking = *aliReq.Parameters.EnableThinking
	}

	for _, item := range aliReq.Input.Media {
		mediaType := strings.TrimSpace(item.Type)
		url := strings.TrimSpace(item.URL)
		if mediaType == "" || url == "" {
			return fmt.Errorf("wan3.0-video media items require type and url")
		}
		switch {
		case isWan30ReferenceType(mediaType):
			refCount++
		case isWan30FrameType(mediaType):
			frameCount++
		default:
			return fmt.Errorf("wan3.0-video unsupported media type: %s", mediaType)
		}
		switch mediaType {
		case wan30MediaReferenceImage:
			imageCount++
		case wan30MediaReferenceVideo:
			videoCount++
		case wan30MediaReferenceAudio:
			audioCount++
		case wan30MediaFirstFrame:
			firstCount++
		case wan30MediaLastFrame:
			lastCount++
		case wan30MediaFile:
			fileCount++
		case wan30MediaLink:
			linkCount++
		}
	}

	if refCount > 0 && frameCount > 0 {
		return fmt.Errorf("wan3.0-video reference media and first/last frame are mutually exclusive")
	}
	if imageCount > wan30MaxReferenceImages {
		return fmt.Errorf("wan3.0-video reference_image count exceeds %d", wan30MaxReferenceImages)
	}
	if videoCount > wan30MaxReferenceVideos {
		return fmt.Errorf("wan3.0-video reference_video count exceeds %d", wan30MaxReferenceVideos)
	}
	if audioCount > wan30MaxReferenceAudios {
		return fmt.Errorf("wan3.0-video reference_audio count exceeds %d", wan30MaxReferenceAudios)
	}
	if firstCount > 1 || lastCount > 1 {
		return fmt.Errorf("wan3.0-video allows at most one first_frame and one last_frame")
	}
	if fileCount > 1 || linkCount > 1 {
		return fmt.Errorf("wan3.0-video allows at most one file or one link")
	}
	if fileCount > 0 && linkCount > 0 {
		return fmt.Errorf("wan3.0-video file and link are mutually exclusive")
	}
	if (fileCount > 0 || linkCount > 0) && !enableThinking {
		return fmt.Errorf("wan3.0-video file/link require parameters.enable_thinking=true")
	}
	return nil
}

func applyWan30ParameterDefaults(aliReq *AliVideoRequest) error {
	if aliReq.Parameters == nil {
		aliReq.Parameters = &AliVideoParameters{}
	}
	p := aliReq.Parameters

	// 不走像素 Size 串；统一 resolution 枚举
	p.Size = ""
	if strings.TrimSpace(p.Resolution) == "" {
		p.Resolution = "1080P"
	} else {
		resolution := strings.ToUpper(strings.TrimSpace(p.Resolution))
		if !strings.HasSuffix(resolution, "P") {
			resolution += "P"
		}
		switch resolution {
		case "480P", "720P", "1080P":
			p.Resolution = resolution
		default:
			return fmt.Errorf("wan3.0-video resolution must be 480P, 720P, or 1080P")
		}
	}

	if strings.TrimSpace(p.Ratio) == "" {
		p.Ratio = "adaptive"
	} else {
		ratio := strings.TrimSpace(p.Ratio)
		switch ratio {
		case "16:9", "4:3", "1:1", "3:4", "9:16", "adaptive":
			p.Ratio = ratio
		default:
			return fmt.Errorf("wan3.0-video ratio is invalid: %s", ratio)
		}
	}

	// duration=-1：智能时长，原样上送；预扣按 wan30MaxDuration
	if p.Duration == -1 {
		// keep -1
	} else if p.Duration == 0 {
		p.Duration = 5
	} else if p.Duration < wan30MinDuration || p.Duration > wan30MaxDuration {
		return fmt.Errorf("wan3.0-video duration must be -1 or between %d and %d", wan30MinDuration, wan30MaxDuration)
	}

	if p.Seed != nil {
		if *p.Seed < 0 || *p.Seed > 2147483647 {
			return fmt.Errorf("wan3.0-video seed must be between 0 and 2147483647")
		}
	}

	return nil
}

func wan30BillingSeconds(duration int) float64 {
	if duration == -1 {
		return float64(wan30MaxDuration)
	}
	if duration < wan30MinDuration {
		return float64(wan30MinDuration)
	}
	if duration > wan30MaxDuration {
		return float64(wan30MaxDuration)
	}
	return float64(duration)
}
