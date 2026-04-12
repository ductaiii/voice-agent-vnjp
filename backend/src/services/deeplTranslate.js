const deepl = require('deepl-node')

function createClient(env) {
  return new deepl.DeepLClient(env.deeplAuthKey, {
    appInfo: {
      appName: 'voice-to-voice-demo',
      appVersion: '0.1.0'
    }
  })
}

async function translateToJapanese(text, env, options = {}) {
  const deeplClient = createClient(env)
  const result = await deeplClient.translateText(
    text,
    options.sourceLanguage || env.deeplSourceLanguage || null,
    options.targetLanguage || env.deeplTargetLanguage,
    {
      preserveFormatting: true,
      modelType: 'prefer_quality_optimized'
    }
  )

  return {
    text: result.text,
    detectedSourceLang: result.detectedSourceLang,
    billedCharacters: result.billedCharacters
  }
}

module.exports = {
  translateToJapanese
}
