const path = require('path')

const DEFAULT_PORT = 8081
const DEFAULT_FRONTEND_ORIGIN = '*'
const PLACEHOLDER_VALUES = new Set([
  'your-deepl-auth-key',
  'your-d-id-agent-id',
  'your-d-id-client-key'
])

function parseNumber(value, fallback) {
  if (value === undefined || value === null || value === '') {
    return fallback
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function withResolvedPath(value) {
  if (!value) {
    return value
  }

  return path.isAbsolute(value) ? value : path.resolve(process.cwd(), value)
}

function stripTrailingSlash(value) {
  return String(value || '')
    .trim()
    .replace(/\/+$/, '')
}

function parseOrigins(value, fallback = []) {
  const rawValue = value || fallback.join(',')

  return rawValue
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
}

function isPlaceholder(value) {
  if (!value) {
    return true
  }

  return PLACEHOLDER_VALUES.has(String(value).trim())
}

function loadEnv() {
  const frontendOrigins = parseOrigins(
    process.env.FRONTEND_ORIGINS || process.env.FRONTEND_ORIGIN,
    [DEFAULT_FRONTEND_ORIGIN]
  )

  return {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: parseNumber(process.env.PORT, DEFAULT_PORT),
    frontendOrigin: frontendOrigins[0],
    frontendOrigins,
    googleCredentialsPath: withResolvedPath(
      process.env.GOOGLE_APPLICATION_CREDENTIALS || ''
    ),
    googleSttLanguageCode: process.env.GOOGLE_STT_LANGUAGE_CODE || 'vi-VN',
    googleSttAlternativeLanguageCodes: (
      process.env.GOOGLE_STT_ALTERNATIVE_LANGUAGE_CODES || ''
    )
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
    googleSttSampleRate: parseNumber(process.env.GOOGLE_STT_SAMPLE_RATE, 44100),
    googleSttModel: process.env.GOOGLE_STT_MODEL || 'latest_long',
    googleTtsLanguageCode: process.env.GOOGLE_TTS_LANGUAGE_CODE || 'vi-VN',
    googleTtsVoiceName: process.env.GOOGLE_TTS_VOICE_NAME || 'vi-VN-Wavenet-A',
    googleTtsAudioEncoding: process.env.GOOGLE_TTS_AUDIO_ENCODING || 'MP3',
    publicBaseUrl: stripTrailingSlash(process.env.PUBLIC_BASE_URL || ''),
    ttsAudioTtlMs: parseNumber(process.env.TTS_AUDIO_TTL_MS, 30 * 60 * 1000),
    ttsCleanupIntervalMs: parseNumber(
      process.env.TTS_CLEANUP_INTERVAL_MS,
      10 * 60 * 1000
    ),
    deeplAuthKey: process.env.DEEPL_AUTH_KEY || '',
    deeplTargetLanguage: process.env.DEEPL_TARGET_LANGUAGE || 'JA',
    deeplSourceLanguage: process.env.DEEPL_SOURCE_LANGUAGE || 'VI',
    didAgentId: process.env.D_ID_AGENT_ID || '',
    didClientKey: process.env.D_ID_CLIENT_KEY || ''
  }
}

function getMissingConfig(config) {
  const missing = []

  if (!config.deeplAuthKey || isPlaceholder(config.deeplAuthKey)) {
    missing.push('DEEPL_AUTH_KEY')
  }

  return missing
}

function getMissingEmbedConfig(config) {
  const missing = []

  if (!config.didAgentId || isPlaceholder(config.didAgentId)) {
    missing.push('D_ID_AGENT_ID')
  }

  if (!config.didClientKey || isPlaceholder(config.didClientKey)) {
    missing.push('D_ID_CLIENT_KEY')
  }

  return missing
}

module.exports = {
  loadEnv,
  getMissingConfig,
  getMissingEmbedConfig,
  isPlaceholder
}
