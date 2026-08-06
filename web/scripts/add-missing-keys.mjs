import fs from 'node:fs/promises'
import path from 'node:path'

const LOCALES_DIR = path.resolve('src/i18n/locales')

function stableStringify(obj) {
  return JSON.stringify(obj, null, 2) + '\n'
}

const newKeys = {
  en: {
    'Video Generation': 'Video Generation',
    'This model is not supported in video generation yet.':
      'This model is not supported in video generation yet.',
  },
  zh: {
    'Video Generation': '视频生成',
    'This model is not supported in video generation yet.':
      '该模型尚不支持在视频生成中配置。',
  },
  'zh-TW': {
    'Video Generation': '影片生成',
    'This model is not supported in video generation yet.':
      '此模型尚不支援在影片生成中設定。',
  },
  fr: {
    'Video Generation': 'Génération vidéo',
    'This model is not supported in video generation yet.':
      "Ce modèle n'est pas encore pris en charge pour la génération vidéo.",
  },
  ja: {
    'Video Generation': '動画生成',
    'This model is not supported in video generation yet.':
      'このモデルは動画生成ではまだ設定できません。',
  },
  ru: {
    'Video Generation': 'Генерация видео',
    'This model is not supported in video generation yet.':
      'Эта модель пока не поддерживается для генерации видео.',
  },
  vi: {
    'Video Generation': 'Tạo video',
    'This model is not supported in video generation yet.':
      'Mô hình này chưa được hỗ trợ cho tạo video.',
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

await main()
