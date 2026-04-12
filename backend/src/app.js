const express = require('express')
const cors = require('cors')

const { buildRealtimeRouter } = require('./routes/realtime')
const { errorHandler } = require('./middleware/errorHandler')
const { getMissingConfig, getMissingEmbedConfig } = require('./config/env')
const { GENERATED_TTS_DIR } = require('./services/googleTts')
const { startFileCleanupJob } = require('./utils/fileCleanup')

function isLoopbackOrigin(origin) {
  try {
    const { hostname } = new URL(origin)
    return hostname === 'localhost' || hostname === '127.0.0.1'
  } catch {
    return false
  }
}

function isOriginAllowed(origin, env) {
  if (!origin) {
    return true
  }

  if (env.frontendOrigins.includes('*')) {
    return true
  }

  if (env.frontendOrigins.includes(origin)) {
    return true
  }

  return env.nodeEnv !== 'production' && isLoopbackOrigin(origin)
}

function createApp(env) {
  const app = express()

  app.set('trust proxy', true)

  app.use(
    cors({
      origin(origin, callback) {
        if (isOriginAllowed(origin, env)) {
          callback(null, true)
          return
        }

        callback(new Error(`Origin ${origin} is not allowed by CORS`))
      },
      credentials: false
    })
  )
  app.use(express.json({ limit: '2mb' }))
  app.use('/audio', express.static(GENERATED_TTS_DIR))

  startFileCleanupJob({
    dirPath: GENERATED_TTS_DIR,
    maxAgeMs: env.ttsAudioTtlMs,
    intervalMs: env.ttsCleanupIntervalMs
  })

  app.get('/', (req, res) => {
    res.json({
      ok: true,
      message: 'Speech-to-speech backend is running.'
    })
  })

  app.get('/api/health', (req, res) => {
    res.json({
      ok: true,
      service: 'voice-to-voice-backend',
      missingConfig: getMissingConfig(env),
      missingEmbedConfig: getMissingEmbedConfig(env)
    })
  })

  app.get('/api/embed-config', (req, res) => {
    const missingConfig = getMissingEmbedConfig(env)

    if (missingConfig.length > 0) {
      res.status(500).json({
        ok: false,
        message: 'Missing D-ID embed configuration.',
        missingConfig
      })
      return
    }

    res.json({
      ok: true,
      config: {
        agentId: env.didAgentId,
        clientKey: env.didClientKey
      }
    })
  })

  app.use('/api/realtime', buildRealtimeRouter(env))
  app.use(errorHandler)

  return app
}

module.exports = {
  createApp
}
