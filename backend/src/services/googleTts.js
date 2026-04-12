const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const textToSpeech = require('@google-cloud/text-to-speech')

const { ensureDir } = require('../utils/ensureDir')

const GENERATED_TTS_DIR = ensureDir(
  path.resolve(process.cwd(), 'uploads', 'tts')
)

function buildTextToSpeechClient(env) {
  const options = {}

  if (env.googleCredentialsPath) {
    options.keyFilename = env.googleCredentialsPath
  }

  return new textToSpeech.TextToSpeechClient(options)
}

function normalizeAudioEncoding(audioEncoding) {
  const normalized = String(audioEncoding || 'MP3')
    .trim()
    .toUpperCase()
  const { AudioEncoding } = textToSpeech.protos.google.cloud.texttospeech.v1

  if (AudioEncoding[normalized]) {
    return normalized
  }

  return 'MP3'
}

function getAudioFileExtension(audioEncoding) {
  switch (audioEncoding) {
    case 'LINEAR16':
      return 'wav'
    case 'OGG_OPUS':
      return 'ogg'
    case 'MULAW':
      return 'mulaw'
    case 'ALAW':
      return 'alaw'
    case 'MP3':
    default:
      return 'mp3'
  }
}

async function synthesizeSpeechToFile(text, env, options = {}) {
  const inputText = String(text || '').trim()

  if (!inputText) {
    throw new Error('Ban can cung cap text tieng Viet de tong hop audio.')
  }

  const client = buildTextToSpeechClient(env)
  const audioEncoding = normalizeAudioEncoding(
    options.audioEncoding || env.googleTtsAudioEncoding
  )
  const outputDir = ensureDir(options.outputDir || GENERATED_TTS_DIR)
  const extension = getAudioFileExtension(audioEncoding)
  const fileName = `${Date.now()}-${crypto.randomUUID()}.${extension}`
  const filePath = path.join(outputDir, fileName)
  const { AudioEncoding } = textToSpeech.protos.google.cloud.texttospeech.v1

  const [response] = await client.synthesizeSpeech({
    input: { text: inputText },
    voice: {
      languageCode: options.languageCode || env.googleTtsLanguageCode,
      name: options.voiceName || env.googleTtsVoiceName
    },
    audioConfig: {
      audioEncoding: AudioEncoding[audioEncoding]
    }
  })

  if (!response.audioContent) {
    throw new Error('Google TTS khong tra ve audio cho noi dung nay.')
  }

  fs.writeFileSync(filePath, Buffer.from(response.audioContent))

  return {
    fileName,
    filePath,
    audioEncoding,
    languageCode: options.languageCode || env.googleTtsLanguageCode,
    voiceName: options.voiceName || env.googleTtsVoiceName
  }
}

module.exports = {
  GENERATED_TTS_DIR,
  synthesizeSpeechToFile
}
