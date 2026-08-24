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
