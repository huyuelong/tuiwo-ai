import fs from 'node:fs/promises'
import path from 'node:path'

const LOCALES_DIR = path.resolve('src/i18n/locales')

function stableStringify(obj) {
  return JSON.stringify(obj, null, 2) + '\n'
}

const newKeys = {
  en: {
    'Document / Web': 'Document / Web',
    'Source type': 'Source type',
    'Document file': 'Document file',
    'Web page': 'Web page',
    'Document file and web page are mutually exclusive. Thinking mode is required.':
      'Document file and web page are mutually exclusive. Thinking mode is required.',
    'Reference document': 'Reference document',
    'Web page URL': 'Web page URL',
    'Public HTTP(S) URL of the page to reference':
      'Public HTTP(S) URL of the page to reference',
    'Required for document or web page sources':
      'Required for document or web page sources',
    'Download video': 'Download video',
    'Downloading…': 'Downloading…',
    'Download failed': 'Download failed',
    'URL must point to a supported document file':
      'URL must point to a supported document file',
    'Provide a document file or URL': 'Provide a document file or URL',
    'Provide a web page URL': 'Provide a web page URL',
    '480P / sec': '480P / sec',
    '5s · 1080P': '5s · 1080P',
    '10s · 720P': '10s · 720P',
    'Base unit price (480P per second)': 'Base unit price (480P per second)',
    'Base unit price is not configured for this model.':
      'Base unit price is not configured for this model.',
    'Default {{seconds}}s · 1080P from {{price}}':
      'Default {{seconds}}s · 1080P from {{price}}',
    'Defaults to {{seconds}} seconds when duration is omitted':
      'Defaults to {{seconds}} seconds when duration is omitted',
    'Duration rules': 'Duration rules',
    'Example prices': 'Example prices',
    'Final charge may differ when smart duration is used or when the upstream returns a different duration.':
      'Final charge may differ when smart duration is used or when the upstream returns a different duration.',
    'Per second': 'Per second',
    'Price = base unit × duration (seconds) × resolution multiplier × group ratio':
      'Price = base unit × duration (seconds) × resolution multiplier × group ratio',
    'Resolution multiplier': 'Resolution multiplier',
    'Smart duration (-1) pre-charges {{seconds}} seconds, then settles to actual duration':
      'Smart duration (-1) pre-charges {{seconds}} seconds, then settles to actual duration',
    'Video duration billing': 'Video duration billing',
    'Video duration range {{min}}–{{max}} seconds':
      'Video duration range {{min}}–{{max}} seconds',
    'Video example prices use duration × resolution multipliers':
      'Video example prices use duration × resolution multipliers',
    sec: 'sec',
  },
  zh: {
    'Document / Web': '文档 / 网页',
    'Source type': '来源类型',
    'Document file': '文档文件',
    'Web page': '网页',
    'Document file and web page are mutually exclusive. Thinking mode is required.':
      '文档文件与网页互斥，且必须开启思考模式。',
    'Reference document': '参考文档',
    'Web page URL': '网页 URL',
    'Public HTTP(S) URL of the page to reference':
      '可公开访问的网页 HTTP(S) 地址',
    'Required for document or web page sources':
      '文档或网页来源必须开启',
    'Download video': '下载视频',
    'Downloading…': '下载中…',
    'Download failed': '下载失败',
    'URL must point to a supported document file':
      'URL 必须指向支持的文档文件',
    'Provide a document file or URL': '请提供文档文件或 URL',
    'Provide a web page URL': '请提供网页 URL',
    '480P / sec': '480P / 秒',
    '5s · 1080P': '5 秒 · 1080P',
    '10s · 720P': '10 秒 · 720P',
    'Base unit price (480P per second)': '基础单价（480P / 秒）',
    'Base unit price is not configured for this model.':
      '该模型尚未配置基础单价。',
    'Default {{seconds}}s · 1080P from {{price}}':
      '默认 {{seconds}} 秒 · 1080P 约 {{price}}',
    'Defaults to {{seconds}} seconds when duration is omitted':
      '未指定时长时默认 {{seconds}} 秒',
    'Duration rules': '时长规则',
    'Example prices': '价格示例',
    'Final charge may differ when smart duration is used or when the upstream returns a different duration.':
      '使用智能时长（-1）或上游返回的实际时长与预扣不一致时，最终扣费可能不同。',
    'Per second': '按秒计费',
    'Price = base unit × duration (seconds) × resolution multiplier × group ratio':
      '费用 = 基础单价 × 时长（秒）× 分辨率倍率 × 分组倍率',
    'Resolution multiplier': '分辨率倍率',
    'Smart duration (-1) pre-charges {{seconds}} seconds, then settles to actual duration':
      '智能时长（-1）预扣 {{seconds}} 秒，完成后按实际上传时长多退少补',
    'Video duration billing': '视频按时长计费',
    'Video duration range {{min}}–{{max}} seconds':
      '可选时长 {{min}}–{{max}} 秒',
    'Video example prices use duration × resolution multipliers':
      '示例价格 = 时长 × 分辨率倍率',
    sec: '秒',
  },
  'zh-TW': {
    'Document / Web': '文件 / 網頁',
    'Source type': '來源類型',
    'Document file': '文件',
    'Web page': '網頁',
    'Document file and web page are mutually exclusive. Thinking mode is required.':
      '文件與網頁互斥，且必須開啟思考模式。',
    'Reference document': '參考文件',
    'Web page URL': '網頁 URL',
    'Public HTTP(S) URL of the page to reference':
      '可公開存取的網頁 HTTP(S) 位址',
    'Required for document or web page sources':
      '文件或網頁來源必須開啟',
    'Download video': '下載影片',
    'Downloading…': '下載中…',
    'Download failed': '下載失敗',
    'URL must point to a supported document file':
      'URL 必須指向支援的文件',
    'Provide a document file or URL': '請提供文件或 URL',
    'Provide a web page URL': '請提供網頁 URL',
    '480P / sec': '480P / 秒',
    '5s · 1080P': '5 秒 · 1080P',
    '10s · 720P': '10 秒 · 720P',
    'Base unit price (480P per second)': '基礎單價（480P / 秒）',
    'Base unit price is not configured for this model.':
      '此模型尚未設定基礎單價。',
    'Default {{seconds}}s · 1080P from {{price}}':
      '預設 {{seconds}} 秒 · 1080P 約 {{price}}',
    'Defaults to {{seconds}} seconds when duration is omitted':
      '未指定時長時預設 {{seconds}} 秒',
    'Duration rules': '時長規則',
    'Example prices': '價格示例',
    'Final charge may differ when smart duration is used or when the upstream returns a different duration.':
      '使用智慧時長（-1）或上游回傳時長與預扣不一致時，最終扣費可能不同。',
    'Per second': '按秒計費',
    'Price = base unit × duration (seconds) × resolution multiplier × group ratio':
      '費用 = 基礎單價 × 時長（秒）× 解析度倍率 × 分組倍率',
    'Resolution multiplier': '解析度倍率',
    'Smart duration (-1) pre-charges {{seconds}} seconds, then settles to actual duration':
      '智慧時長（-1）預扣 {{seconds}} 秒，完成後依實際時長多退少補',
    'Video duration billing': '影片依時長計費',
    'Video duration range {{min}}–{{max}} seconds':
      '可選時長 {{min}}–{{max}} 秒',
    'Video example prices use duration × resolution multipliers':
      '示例價格 = 時長 × 解析度倍率',
    sec: '秒',
  },
  fr: {
    'Document / Web': 'Document / Web',
    'Source type': 'Type de source',
    'Document file': 'Fichier document',
    'Web page': 'Page web',
    'Document file and web page are mutually exclusive. Thinking mode is required.':
      'Le fichier document et la page web sont mutuellement exclusifs. Le mode réflexion est requis.',
    'Reference document': 'Document de référence',
    'Web page URL': 'URL de la page web',
    'Public HTTP(S) URL of the page to reference':
      'URL HTTP(S) publique de la page à référencer',
    'Required for document or web page sources':
      'Requis pour les sources document ou page web',
    'Download video': 'Télécharger la vidéo',
    'Downloading…': 'Téléchargement…',
    'Download failed': 'Échec du téléchargement',
    'URL must point to a supported document file':
      "L'URL doit pointer vers un fichier document pris en charge",
    'Provide a document file or URL': 'Fournissez un fichier document ou une URL',
    'Provide a web page URL': 'Fournissez une URL de page web',
    '480P / sec': '480P / s',
    '5s · 1080P': '5 s · 1080P',
    '10s · 720P': '10 s · 720P',
    'Base unit price (480P per second)': 'Prix unitaire de base (480P / s)',
    'Base unit price is not configured for this model.':
      'Le prix unitaire de base n’est pas configuré pour ce modèle.',
    'Default {{seconds}}s · 1080P from {{price}}':
      'Par défaut {{seconds}} s · 1080P dès {{price}}',
    'Defaults to {{seconds}} seconds when duration is omitted':
      'Par défaut {{seconds}} secondes si la durée est omise',
    'Duration rules': 'Règles de durée',
    'Example prices': 'Exemples de prix',
    'Final charge may differ when smart duration is used or when the upstream returns a different duration.':
      'Le montant final peut varier avec la durée intelligente (-1) ou une durée réelle différente.',
    'Per second': 'Par seconde',
    'Price = base unit × duration (seconds) × resolution multiplier × group ratio':
      'Prix = unité de base × durée (s) × multiplicateur de résolution × ratio de groupe',
    'Resolution multiplier': 'Multiplicateur de résolution',
    'Smart duration (-1) pre-charges {{seconds}} seconds, then settles to actual duration':
      'Durée intelligente (-1) : pré-débit de {{seconds}} s, puis ajustement à la durée réelle',
    'Video duration billing': 'Facturation vidéo à la durée',
    'Video duration range {{min}}–{{max}} seconds':
      'Durée disponible {{min}}–{{max}} secondes',
    'Video example prices use duration × resolution multipliers':
      'Exemples = durée × multiplicateurs de résolution',
    sec: 's',
  },
  ja: {
    'Document / Web': 'ドキュメント / Web',
    'Source type': 'ソース種別',
    'Document file': 'ドキュメントファイル',
    'Web page': 'Web ページ',
    'Document file and web page are mutually exclusive. Thinking mode is required.':
      'ドキュメントファイルと Web ページは同時に指定できず、思考モードが必須です。',
    'Reference document': '参照ドキュメント',
    'Web page URL': 'Web ページ URL',
    'Public HTTP(S) URL of the page to reference':
      '参照するページの公開 HTTP(S) URL',
    'Required for document or web page sources':
      'ドキュメントまたは Web ページソースでは必須',
    'Download video': '動画をダウンロード',
    'Downloading…': 'ダウンロード中…',
    'Download failed': 'ダウンロードに失敗しました',
    'URL must point to a supported document file':
      'URL はサポート対象のドキュメントファイルを指す必要があります',
    'Provide a document file or URL': 'ドキュメントファイルまたは URL を入力してください',
    'Provide a web page URL': 'Web ページ URL を入力してください',
    '480P / sec': '480P / 秒',
    '5s · 1080P': '5 秒 · 1080P',
    '10s · 720P': '10 秒 · 720P',
    'Base unit price (480P per second)': '基本単価（480P / 秒）',
    'Base unit price is not configured for this model.':
      'このモデルには基本単価が設定されていません。',
    'Default {{seconds}}s · 1080P from {{price}}':
      '既定 {{seconds}} 秒 · 1080P は {{price}} から',
    'Defaults to {{seconds}} seconds when duration is omitted':
      'duration 未指定時は既定 {{seconds}} 秒',
    'Duration rules': '時間ルール',
    'Example prices': '料金例',
    'Final charge may differ when smart duration is used or when the upstream returns a different duration.':
      'スマート duration（-1）や実際の秒数により最終料金は変動します。',
    'Per second': '秒課金',
    'Price = base unit × duration (seconds) × resolution multiplier × group ratio':
      '料金 = 基本単価 × 秒数 × 解像度倍率 × グループ倍率',
    'Resolution multiplier': '解像度倍率',
    'Smart duration (-1) pre-charges {{seconds}} seconds, then settles to actual duration':
      'スマート duration（-1）は {{seconds}} 秒を先に引き、完了後に実秒数で精算',
    'Video duration billing': '動画の秒数課金',
    'Video duration range {{min}}–{{max}} seconds':
      '選択可能な秒数 {{min}}–{{max}} 秒',
    'Video example prices use duration × resolution multipliers':
      '例は 秒数 × 解像度倍率',
    sec: '秒',
  },
  ru: {
    'Document / Web': 'Документ / Веб',
    'Source type': 'Тип источника',
    'Document file': 'Файл документа',
    'Web page': 'Веб-страница',
    'Document file and web page are mutually exclusive. Thinking mode is required.':
      'Файл документа и веб-страница взаимоисключающие. Требуется режим размышления.',
    'Reference document': 'Справочный документ',
    'Web page URL': 'URL веб-страницы',
    'Public HTTP(S) URL of the page to reference':
      'Публичный HTTP(S) URL страницы для ссылки',
    'Required for document or web page sources':
      'Обязательно для источников документ или веб-страница',
    'Download video': 'Скачать видео',
    'Downloading…': 'Загрузка…',
    'Download failed': 'Не удалось скачать',
    'URL must point to a supported document file':
      'URL должен указывать на поддерживаемый файл документа',
    'Provide a document file or URL': 'Укажите файл документа или URL',
    'Provide a web page URL': 'Укажите URL веб-страницы',
    '480P / sec': '480P / с',
    '5s · 1080P': '5 с · 1080P',
    '10s · 720P': '10 с · 720P',
    'Base unit price (480P per second)': 'Базовая цена (480P / с)',
    'Base unit price is not configured for this model.':
      'Для этой модели не настроена базовая цена.',
    'Default {{seconds}}s · 1080P from {{price}}':
      'По умолчанию {{seconds}} с · 1080P от {{price}}',
    'Defaults to {{seconds}} seconds when duration is omitted':
      'Если duration не указан, по умолчанию {{seconds}} с',
    'Duration rules': 'Правила длительности',
    'Example prices': 'Примеры цен',
    'Final charge may differ when smart duration is used or when the upstream returns a different duration.':
      'Итоговая сумма может отличаться при smart duration (-1) или другой фактической длительности.',
    'Per second': 'За секунду',
    'Price = base unit × duration (seconds) × resolution multiplier × group ratio':
      'Цена = база × секунды × множитель разрешения × коэффициент группы',
    'Resolution multiplier': 'Множитель разрешения',
    'Smart duration (-1) pre-charges {{seconds}} seconds, then settles to actual duration':
      'Smart duration (-1): предоплата {{seconds}} с, затем расчёт по факту',
    'Video duration billing': 'Поминутная/посекундная оплата видео',
    'Video duration range {{min}}–{{max}} seconds':
      'Доступная длительность {{min}}–{{max}} с',
    'Video example prices use duration × resolution multipliers':
      'Примеры = длительность × множители разрешения',
    sec: 'с',
  },
  vi: {
    'Document / Web': 'Tài liệu / Trang web',
    'Source type': 'Loại nguồn',
    'Document file': 'Tệp tài liệu',
    'Web page': 'Trang web',
    'Document file and web page are mutually exclusive. Thinking mode is required.':
      'Tệp tài liệu và trang web loại trừ lẫn nhau. Bắt buộc bật chế độ suy nghĩ.',
    'Reference document': 'Tài liệu tham chiếu',
    'Web page URL': 'URL trang web',
    'Public HTTP(S) URL of the page to reference':
      'URL HTTP(S) công khai của trang cần tham chiếu',
    'Required for document or web page sources':
      'Bắt buộc cho nguồn tài liệu hoặc trang web',
    'Download video': 'Tải video',
    'Downloading…': 'Đang tải…',
    'Download failed': 'Tải xuống thất bại',
    'URL must point to a supported document file':
      'URL phải trỏ tới tệp tài liệu được hỗ trợ',
    'Provide a document file or URL': 'Hãy cung cấp tệp tài liệu hoặc URL',
    'Provide a web page URL': 'Hãy cung cấp URL trang web',
    '480P / sec': '480P / giây',
    '5s · 1080P': '5 giây · 1080P',
    '10s · 720P': '10 giây · 720P',
    'Base unit price (480P per second)': 'Đơn giá cơ bản (480P / giây)',
    'Base unit price is not configured for this model.':
      'Mô hình này chưa cấu hình đơn giá cơ bản.',
    'Default {{seconds}}s · 1080P from {{price}}':
      'Mặc định {{seconds}} giây · 1080P từ {{price}}',
    'Defaults to {{seconds}} seconds when duration is omitted':
      'Mặc định {{seconds}} giây khi không chỉ định duration',
    'Duration rules': 'Quy tắc thời lượng',
    'Example prices': 'Ví dụ giá',
    'Final charge may differ when smart duration is used or when the upstream returns a different duration.':
      'Phí cuối có thể khác khi dùng smart duration (-1) hoặc thời lượng thực tế khác.',
    'Per second': 'Theo giây',
    'Price = base unit × duration (seconds) × resolution multiplier × group ratio':
      'Giá = đơn giá cơ bản × giây × hệ số độ phân giải × hệ số nhóm',
    'Resolution multiplier': 'Hệ số độ phân giải',
    'Smart duration (-1) pre-charges {{seconds}} seconds, then settles to actual duration':
      'Smart duration (-1) trừ trước {{seconds}} giây, sau đó quyết toán theo thực tế',
    'Video duration billing': 'Tính phí video theo giây',
    'Video duration range {{min}}–{{max}} seconds':
      'Thời lượng {{min}}–{{max}} giây',
    'Video example prices use duration × resolution multipliers':
      'Ví dụ = thời lượng × hệ số độ phân giải',
    sec: 'giây',
  },
}

async function main() {
  let totalAdded = 0

  for (const [locale, trans] of Object.entries(newKeys)) {
    const filePath = path.join(LOCALES_DIR, `${locale}.json`)
    const json = JSON.parse(await fs.readFile(filePath, 'utf8'))

    let count = 0
    for (const [key, value] of Object.entries(trans)) {
      if (!Object.prototype.hasOwnProperty.call(json.translation, key)) {
        json.translation[key] = value
        count++
      } else if (json.translation[key] !== value) {
        json.translation[key] = value
        count++
      }
    }

    const sorted = Object.keys(json.translation)
      .sort((a, b) => a.localeCompare(b))
      .reduce((acc, key) => {
        acc[key] = json.translation[key]
        return acc
      }, {})

    json.translation = sorted
    await fs.writeFile(filePath, stableStringify(json), 'utf8')
    console.log(`${locale}: ${count} keys added/updated`)
    totalAdded += count
  }

  console.log(`Done. Total keys touched: ${totalAdded}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
