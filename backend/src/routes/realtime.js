const fs = require('fs')
const path = require('path')
const multer = require('multer')
const express = require('express')

const { translateToJapanese } = require('../services/deeplTranslate')
const { transcribeAudio } = require('../services/googleStt')
const { synthesizeSpeechToFile } = require('../services/googleTts')
const { ensureDir } = require('../utils/ensureDir')

function buildUploadMiddleware() {
  const uploadDir = ensureDir(
    path.resolve(process.cwd(), 'uploads', 'realtime')
  )

  const storage = multer.diskStorage({
    destination(req, file, callback) {
      callback(null, uploadDir)
    },
    filename(req, file, callback) {
      const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '-')
      callback(null, `${Date.now()}-${safeName}`)
    }
  })

  return multer({
    storage,
    limits: { fileSize: 20 * 1024 * 1024 },
    fileFilter(req, file, callback) {
      const allowedMimeTypes = [
        'audio/mpeg',
        'audio/mp3',
        'audio/wav',
        'audio/x-wav',
        'audio/wave'
      ]
      const allowedExtensions = ['.mp3', '.wav']
      const ext = path.extname(file.originalname).toLowerCase()

      if (
        allowedMimeTypes.includes(file.mimetype) ||
        allowedExtensions.includes(ext)
      ) {
        callback(null, true)
        return
      }

      callback(new Error('Chi ho tro file MP3 hoac WAV cho realtime mode.'))
    }
  })
}

function createHttpError(message, statusCode) {
  const error = new Error(message)
  error.statusCode = statusCode
  return error
}

function parseAlternativeLanguageCodes(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean)
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  }

  return []
}

function resolvePublicBaseUrl(req, env) {
  if (env.publicBaseUrl) {
    return env.publicBaseUrl
  }

  const forwardedHost = String(req.get('x-forwarded-host') || '').split(',')[0]
  const host = forwardedHost.trim() || String(req.get('host') || '').trim()

  if (!host || /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(host)) {
    return ''
  }

  const forwardedProto = String(req.get('x-forwarded-proto') || '')
    .split(',')[0]
    .trim()
  const protocol = forwardedProto || req.protocol || 'http'

  return `${protocol}://${host}`
}

function buildRealtimeRouter(env) {
  const router = express.Router()
  const upload = buildUploadMiddleware()

  router.post('/translate', async (req, res, next) => {
    try {
      const sourceText = String(req.body.message || '').trim()

      if (!env.deeplAuthKey) {
        throw createHttpError('Thieu cau hinh DeepL de dich realtime.', 500)
      }

      if (!sourceText) {
        throw createHttpError('Ban can nhap noi dung truoc khi gui.', 400)
      }

      const translationResult = await translateToJapanese(sourceText, env, {
        sourceLanguage: req.body.sourceLanguage || env.deeplSourceLanguage,
        targetLanguage: req.body.targetLanguage || env.deeplTargetLanguage
      })

      res.json({
        ok: true,
        mode: 'translate',
        sourceText,
        translatedText: translationResult.text,
        detectedSourceLang: translationResult.detectedSourceLang || null
      })
    } catch (error) {
      next(error)
    }
  })

  router.post('/transcribe', upload.single('audio'), async (req, res, next) => {
    const uploadedPath = req.file?.path

    try {
      if (!req.file) {
        throw createHttpError('Ban can upload file audio o field `audio`.', 400)
      }

      const transcriptResult = await transcribeAudio(req.file.path, env, {
        languageCode: String(req.body.languageCode || '').trim() || undefined,
        alternativeLanguageCodes: parseAlternativeLanguageCodes(
          req.body.alternativeLanguageCodes
        )
      })

      if (!transcriptResult.transcript) {
        throw createHttpError(
          'Google STT khong tra ve transcript tu file audio nay.',
          422
        )
      }

      res.json({
        ok: true,
        mode: 'transcribe',
        transcript: transcriptResult.transcript,
        languageCode: transcriptResult.languageCode,
        sourceAudio: {
          originalName: req.file.originalname,
          size: req.file.size,
          mimetype: req.file.mimetype
        }
      })
    } catch (error) {
      next(error)
    } finally {
      if (uploadedPath && fs.existsSync(uploadedPath)) {
        fs.unlinkSync(uploadedPath)
      }
    }
  })

  router.post('/synthesize', async (req, res, next) => {
    try {
      const sourceText = String(req.body.text || req.body.message || '').trim()

      if (!sourceText) {
        throw createHttpError(
          'Ban can nhap text tieng Viet de tong hop audio.',
          400
        )
      }

      const publicBaseUrl = resolvePublicBaseUrl(req, env)

      if (!publicBaseUrl) {
        throw createHttpError(
          'Chua co PUBLIC_BASE_URL hop le de D-ID tai file audio.',
          500
        )
      }

      const synthesisResult = await synthesizeSpeechToFile(sourceText, env, {
        languageCode:
          String(req.body.languageCode || '').trim() ||
          env.googleTtsLanguageCode,
        voiceName:
          String(req.body.voiceName || '').trim() || env.googleTtsVoiceName,
        audioEncoding:
          String(req.body.audioEncoding || '').trim() ||
          env.googleTtsAudioEncoding
      })

      res.json({
        ok: true,
        mode: 'synthesize',
        sourceText,
        audioUrl: `${publicBaseUrl}/audio/${encodeURIComponent(synthesisResult.fileName)}`,
        voiceName: synthesisResult.voiceName,
        languageCode: synthesisResult.languageCode,
        audioEncoding: synthesisResult.audioEncoding
      })
    } catch (error) {
      next(error)
    }
  })

  return router
}

module.exports = {
  buildRealtimeRouter
}
