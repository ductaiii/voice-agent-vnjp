const fs = require('fs')
const path = require('path')
const speech = require('@google-cloud/speech')

function inferRecognitionConfig(audioFilePath, env, options = {}) {
  const extension = path.extname(audioFilePath).toLowerCase()
  const languageCode =
    options.languageCode || env.googleSttLanguageCode || 'vi-VN'
  const alternativeLanguageCodes = Array.isArray(
    options.alternativeLanguageCodes
  )
    ? options.alternativeLanguageCodes
    : env.googleSttAlternativeLanguageCodes

  if (extension === '.wav') {
    return {
      encoding: 'LINEAR16',
      sampleRateHertz: env.googleSttSampleRate,
      languageCode,
      alternativeLanguageCodes,
      enableAutomaticPunctuation: true,
      model: env.googleSttModel
    }
  }

  return {
    encoding: 'MP3',
    sampleRateHertz: env.googleSttSampleRate,
    languageCode,
    alternativeLanguageCodes,
    enableAutomaticPunctuation: true,
    model: env.googleSttModel
  }
}

function buildSpeechClient(env) {
  const options = {}

  if (env.googleCredentialsPath) {
    options.keyFilename = env.googleCredentialsPath
  }

  return new speech.SpeechClient(options)
}

async function transcribeAudio(audioFilePath, env, options = {}) {
  const speechClient = buildSpeechClient(env)
  const audioBytes = fs.readFileSync(audioFilePath).toString('base64')
  const config = inferRecognitionConfig(audioFilePath, env, options)

  const [response] = await speechClient.recognize({
    audio: { content: audioBytes },
    config
  })

  const transcript = (response.results || [])
    .map((result) => result.alternatives?.[0]?.transcript || '')
    .filter(Boolean)
    .join('\n')
    .trim()

  return {
    transcript,
    languageCode: config.languageCode,
    raw: response
  }
}

module.exports = {
  transcribeAudio
}
