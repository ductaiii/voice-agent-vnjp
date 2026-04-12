import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as sdk from '@d-id/client-sdk'
import './Ver2Page.css'

const isLoopbackHost = ['localhost', '127.0.0.1', '::1'].includes(
  window.location.hostname
)

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (isLoopbackHost ? 'http://127.0.0.1:8081' : '')

const DEFAULT_LANGUAGE_DIRECTION = 'vi-ja'

const LANGUAGE_DIRECTIONS = {
  'vi-ja': {
    id: 'vi-ja',
    label: 'VI -> JA',
    ariaLabel: 'Tiếng Việt sang tiếng Nhật',
    sourceFlag: 'vn',
    targetFlag: 'jp',
    sourceLanguageLabel: 'tiếng Việt',
    targetLanguageLabel: 'tiếng Nhật',
    recognitionLocale: 'vi-VN',
    sttLanguageCode: 'vi-VN',
    sttAlternativeLanguageCodes: [],
    sourceLanguage: 'VI',
    targetLanguage: 'JA',
    speakMode: 'text',
    inputPlaceholder: 'Gõ tiếng Việt hoặc tải audio tiếng Việt lên.',
    micReadyMessage: 'Mic tiếng Việt sẵn sàng.',
    micListeningMessage: 'Mic đang nghe tiếng Việt...',
    autoSendMessage:
      'Mic đã dừng, app đang tự dịch sang tiếng Nhật và cho avatar nói...',
    sendMessage: 'Đang dịch sang tiếng Nhật và cho Agent nói...',
    readyMessage:
      'Đã gửi lệnh nói tiếng Nhật cho Agent. Đang chờ stream bắt đầu...',
    translateErrorMessage: 'Backend không trả về bản dịch tiếng Nhật.',
    resultLabel: 'Bản dịch JP',
    agentSpeakLabel: 'Agent sẽ nói tiếng Nhật',
    speakDebugScopeMessage: 'Translate and speak VI->JA requested.',
    autoSpeakDebugScopeMessage:
      'Auto translate and speak VI->JA requested after mic stop.',
    synthesizePendingMessage: ''
  },
  'ja-vi': {
    id: 'ja-vi',
    label: 'JA -> VI',
    ariaLabel: 'Tiếng Nhật sang tiếng Việt',
    sourceFlag: 'jp',
    targetFlag: 'vn',
    sourceLanguageLabel: 'tiếng Nhật',
    targetLanguageLabel: 'tiếng Việt',
    recognitionLocale: 'ja-JP',
    sttLanguageCode: 'ja-JP',
    sttAlternativeLanguageCodes: [],
    sourceLanguage: 'JA',
    targetLanguage: 'VI',
    speakMode: 'audio',
    inputPlaceholder: 'Gõ tiếng Nhật hoặc tải audio tiếng Nhật lên.',
    micReadyMessage: 'Mic tiếng Nhật sẵn sàng.',
    micListeningMessage: 'Mic đang nghe tiếng Nhật...',
    autoSendMessage:
      'Mic đã dừng, app đang tự dịch sang tiếng Việt, tạo audio và cho avatar nói...',
    sendMessage:
      'Đang dịch sang tiếng Việt, tạo audio bằng Google TTS và cho Agent nói...',
    readyMessage:
      'Đã gửi audio tiếng Việt cho Agent. Đang chờ stream bắt đầu...',
    translateErrorMessage: 'Backend không trả về bản dịch tiếng Việt.',
    resultLabel: 'Bản dịch VI',
    agentSpeakLabel: 'Agent sẽ nói tiếng Việt',
    speakDebugScopeMessage: 'Translate and speak JA->VI requested.',
    autoSpeakDebugScopeMessage:
      'Auto translate and speak JA->VI requested after mic stop.',
    synthesizePendingMessage: 'Đang tạo audio tiếng Việt bằng Google TTS...'
  }
}

const LANGUAGE_DIRECTION_OPTIONS = Object.values(LANGUAGE_DIRECTIONS)

function getLanguageDirectionConfig(directionKey) {
  return (
    LANGUAGE_DIRECTIONS[directionKey] ||
    LANGUAGE_DIRECTIONS[DEFAULT_LANGUAGE_DIRECTION]
  )
}

function formatConnectionLabel(state) {
  switch (state) {
    case 'connected':
      return 'Connected'
    case 'connecting':
      return 'Connecting'
    case 'disconnected':
      return 'Standby'
    case 'disconnecting':
      return 'Disconnecting'
    case 'loading':
      return 'Loading'
    case 'ready':
      return 'Ready'
    case 'fail':
      return 'Failed'
    default:
      return state || 'Unknown'
  }
}

function createDebugEvent(scope, message, level = 'info') {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    scope,
    message,
    level,
    timestamp: new Date().toLocaleTimeString('vi-VN', {
      hour12: false
    })
  }
}

function getLatestSpeechSegment(text) {
  const normalized = String(text || '')
    .replace(/\s+/g, ' ')
    .trim()

  if (!normalized) {
    return ''
  }

  const sentenceSegments = normalized
    .split(/[\n。！？.!?]+/)
    .map((segment) => segment.trim())
    .filter(Boolean)

  const latestSentence = sentenceSegments.at(-1) || normalized
  const clauseSegments = latestSentence
    .split(/[,:;，、]/)
    .map((segment) => segment.trim())
    .filter(Boolean)

  return clauseSegments.at(-1) || latestSentence
}

function splitSubtitleLines(text, maxCharsPerLine = 22, maxLines = 2) {
  const value = String(text || '').trim()

  if (!value) {
    return []
  }

  const hasWhitespace = /\s/.test(value)

  if (!hasWhitespace) {
    const tail = value.slice(-maxCharsPerLine * maxLines)
    const lines = []

    for (let index = 0; index < tail.length; index += maxCharsPerLine) {
      lines.push(tail.slice(index, index + maxCharsPerLine))
    }

    if (tail.length < value.length && lines.length > 0) {
      lines[0] = `…${lines[0].slice(1)}`
    }

    return lines
  }

  const words = value.split(' ')

  // Try a balanced split for the common 2-line subtitle case.
  // Prefer splits that keep both lines within maxCharsPerLine and minimize
  // the character-length difference between the two lines.
  if (maxLines === 2 && words.length > 1) {
    let bestSplit = null

    for (let s = 1; s < words.length; s += 1) {
      const lineA = words.slice(0, s).join(' ')
      const lineB = words.slice(s).join(' ')
      const lenA = lineA.length
      const lenB = lineB.length
      const maxLen = Math.max(lenA, lenB)
      const diff = Math.abs(lenA - lenB)

      if (!bestSplit) {
        bestSplit = { s, lenA, lenB, maxLen, diff }
        continue
      }

      const bestFits =
        bestSplit.lenA <= maxCharsPerLine && bestSplit.lenB <= maxCharsPerLine
      const currFits = lenA <= maxCharsPerLine && lenB <= maxCharsPerLine

      if (currFits && !bestFits) {
        bestSplit = { s, lenA, lenB, maxLen, diff }
      } else if (currFits && bestFits) {
        if (
          diff < bestSplit.diff ||
          (diff === bestSplit.diff && maxLen < bestSplit.maxLen)
        ) {
          bestSplit = { s, lenA, lenB, maxLen, diff }
        }
      } else if (!currFits && !bestFits) {
        if (
          maxLen < bestSplit.maxLen ||
          (maxLen === bestSplit.maxLen && diff < bestSplit.diff)
        ) {
          bestSplit = { s, lenA, lenB, maxLen, diff }
        }
      }
    }

    if (bestSplit) {
      const line1 = words.slice(0, bestSplit.s).join(' ')
      const line2 = words.slice(bestSplit.s).join(' ')

      if (line1.length <= maxCharsPerLine && line2.length <= maxCharsPerLine) {
        return [line1, line2]
      }
    }
  }

  // Fallback: original behavior which builds lines from the end (keeps trailing words)
  const lines = []
  let currentLine = ''

  for (let index = words.length - 1; index >= 0; index -= 1) {
    const word = words[index]
    const nextLine = currentLine ? `${word} ${currentLine}` : word

    if (nextLine.length <= maxCharsPerLine) {
      currentLine = nextLine
      continue
    }

    if (currentLine) {
      lines.unshift(currentLine)
    } else {
      lines.unshift(word.slice(-maxCharsPerLine))
    }

    currentLine = word

    if (lines.length === maxLines - 1) {
      break
    }
  }

  if (currentLine) {
    lines.unshift(currentLine)
  }

  const slicedLines = lines.slice(-maxLines)

  if (slicedLines.join(' ').length < value.length && slicedLines.length > 0) {
    slicedLines[0] = `…${slicedLines[0].replace(/^…*/, '').trimStart()}`
  }

  return slicedLines
}

function createStageSubtitle(text, label, tone) {
  const latestSegment = getLatestSpeechSegment(text)

  if (!latestSegment) {
    return null
  }

  return {
    label,
    tone,
    lines: splitSubtitleLines(latestSegment)
  }
}

function createSubtitleRevealFrames(text) {
  const value = String(text || '').trim()

  if (!value) {
    return []
  }

  const hasWhitespace = /\s/.test(value)

  if (!hasWhitespace) {
    const frames = []
    const chunkSize = value.length > 30 ? 4 : 2

    for (let index = chunkSize; index < value.length; index += chunkSize) {
      frames.push(value.slice(0, index))
    }

    frames.push(value)
    return frames
  }

  const words = value.split(' ')
  const frames = []
  const chunkSize = words.length > 12 ? 3 : 2

  for (let index = chunkSize; index < words.length; index += chunkSize) {
    frames.push(words.slice(0, index).join(' '))
  }

  frames.push(value)
  return frames
}

function formatVoiceUiLabel(state) {
  switch (state) {
    case 'listening':
      return 'Listening'
    case 'sending':
      return 'Translating'
    case 'connected':
      return 'Ready to talk'
    case 'connecting':
      return 'Connecting'
    case 'ready':
      return 'Tap to speak'
    case 'error':
      return 'Need attention'
    default:
      return formatConnectionLabel(state)
  }
}

function FlagIcon({ country, className = '' }) {
  if (country === 'vn') {
    return (
      <svg
        viewBox="0 0 28 20"
        className={`flag-icon ${className}`.trim()}
        aria-hidden="true"
      >
        <rect width="28" height="20" rx="5" fill="#da251d" />
        <path
          d="M14 3.85 16.22 9h5.57l-4.49 3.25 1.72 5.2L14 14.2l-5.02 3.25 1.72-5.2L6.21 9h5.57L14 3.85Z"
          fill="#ffde00"
        />
      </svg>
    )
  }

  return (
    <svg
      viewBox="0 0 28 20"
      className={`flag-icon ${className}`.trim()}
      aria-hidden="true"
    >
      <rect width="28" height="20" rx="5" fill="#f7f4ef" />
      <circle cx="14" cy="10" r="5.2" fill="#bc002d" />
    </svg>
  )
}

function DirectionLabel({ direction, className = '' }) {
  return (
    <span className={`direction-label ${className}`.trim()} aria-hidden="true">
      <FlagIcon country={direction.sourceFlag} />
      <span className="direction-label-arrow">→</span>
      <FlagIcon country={direction.targetFlag} />
    </span>
  )
}

function DirectionSwitch({ value, onChange, className = '' }) {
  return (
    <div
      className={`direction-switch ${className}`.trim()}
      role="group"
      aria-label="Đổi chiều ngôn ngữ"
    >
      {LANGUAGE_DIRECTION_OPTIONS.map((direction) => (
        <button
          key={direction.id}
          type="button"
          className={`direction-switch-button ${value === direction.id ? 'is-active' : ''}`}
          onClick={() => onChange(direction.id)}
          aria-label={direction.ariaLabel}
          aria-pressed={value === direction.id}
        >
          <DirectionLabel direction={direction} />
        </button>
      ))}
    </div>
  )
}

function Ver2Page() {
  const idleVideoRef = useRef(null)
  const videoRef = useRef(null)
  const agentManagerRef = useRef(null)
  const streamRef = useRef(null)
  const connectPromiseRef = useRef(null)
  const reconnectPromiseRef = useRef(null)
  const handleSendRef = useRef(null)
  const dispatchSpeakCommandRef = useRef(null)
  const recoverLegacySessionRef = useRef(null)
  const pendingSpeechRef = useRef(null)
  const audioOutputStateRef = useRef('locked')
  const agentFramesRef = useRef(null)
  const agentFramesTimerRef = useRef(null)
  const sendStateRef = useRef({
    status: 'idle',
    message: ''
  })
  const recognitionRef = useRef(null)
  const silenceTimerRef = useRef(null)
  const SILENCE_TIMEOUT_MS = 5000
  const micWantedRef = useRef(false)
  const micStopReasonRef = useRef('idle')
  const micTranscriptBaseRef = useRef('')
  const micFinalTranscriptRef = useRef('')
  const draftTranscriptRef = useRef('')
  const [agentStatus, setAgentStatus] = useState('loading')
  const [agentError, setAgentError] = useState('')
  const [audioOutputState, setAudioOutputState] = useState('locked')
  const [audioOutputMessage, setAudioOutputMessage] = useState(
    'Trình duyệt đang khóa audio cho tới khi bạn bấm một nút trên trang.'
  )
  const [selectedAudio, setSelectedAudio] = useState(null)
  const [audioPreviewUrl, setAudioPreviewUrl] = useState('')
  const [draftTranscript, setDraftTranscript] = useState('')
  const [languageDirection, setLanguageDirection] = useState(
    DEFAULT_LANGUAGE_DIRECTION
  )
  const [transcribeState, setTranscribeState] = useState({
    status: 'idle',
    message: ''
  })
  const [sendState, setSendState] = useState({
    status: 'idle',
    message: ''
  })
  const [micState, setMicState] = useState({
    status: 'idle',
    message: getLanguageDirectionConfig(DEFAULT_LANGUAGE_DIRECTION)
      .micReadyMessage,
    supported: false
  })
  const [result, setResult] = useState(null)
  const [connectionStatus, setConnectionStatus] = useState('loading')
  const [activityState, setActivityState] = useState('IDLE')
  const [isComposerOpen, setIsComposerOpen] = useState(() => {
    if (typeof window === 'undefined') {
      return true
    }

    return window.innerWidth > 960
  })
  const [debugEvents, setDebugEvents] = useState([])
  const [idleMediaUrl, setIdleMediaUrl] = useState('')
  const [showLiveStream, setShowLiveStream] = useState(false)
  const [stageFreezeFrame, setStageFreezeFrame] = useState('')
  const [agentStageText, setAgentStageText] = useState('')
  const [isInterrupting, setIsInterrupting] = useState(false)
  const [autoStoppedIndicator, setAutoStoppedIndicator] = useState(false)
  const activeDirection = getLanguageDirectionConfig(languageDirection)

  function clearSilenceTimer() {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current)
      silenceTimerRef.current = null
    }
  }

  function startSilenceTimer() {
    clearSilenceTimer()
    silenceTimerRef.current = window.setTimeout(() => {
      if (recognitionRef.current) {
        try {
          if (typeof recognitionRef.current.stop === 'function') {
            micStopReasonRef.current = 'auto-stop'
            micWantedRef.current = false
            pushDebugEvent(
              'mic',
              `Auto silence detected (${SILENCE_TIMEOUT_MS}ms). Stopping mic.`,
              'info'
            )
            // show UI indicator briefly
            try {
              setAutoStoppedIndicator(true)
              window.setTimeout(() => setAutoStoppedIndicator(false), 2200)
            } catch (e) {
              // ignore if setState not available
            }

            recognitionRef.current.stop()
          }
        } catch (e) {
          // ignore errors from stop()
        }
      }
    }, SILENCE_TIMEOUT_MS)
  }

  const pushDebugEvent = useCallback((scope, message, level = 'info') => {
    const normalizedMessage = String(message || '')

    if (
      (scope === 'stream' &&
        normalizedMessage === 'Remote media stream attached.') ||
      (scope === 'audio' &&
        (normalizedMessage ===
          'Muted autoplay was blocked while attaching remote stream.' ||
          normalizedMessage ===
            'Audio unlock is still pending after timeout; continuing without blocking.')) ||
      (scope === 'connect' &&
        /Connection state changed: connecting/i.test(normalizedMessage)) ||
      (scope === 'mic' &&
        (normalizedMessage === 'Web Speech API initialized.' ||
          normalizedMessage === 'Microphone listening started.'))
    ) {
      return
    }

    setDebugEvents((currentEvents) => {
      if (
        currentEvents[0]?.scope === scope &&
        currentEvents[0]?.message === normalizedMessage &&
        currentEvents[0]?.level === level
      ) {
        return currentEvents
      }

      const nextEvents = [
        createDebugEvent(scope, normalizedMessage, level),
        ...currentEvents
      ]

      return nextEvents.slice(0, 18)
    })
  }, [])

  useEffect(() => {
    audioOutputStateRef.current = audioOutputState
  }, [audioOutputState])

  useEffect(() => {
    draftTranscriptRef.current = draftTranscript
  }, [draftTranscript])

  useEffect(() => {
    sendStateRef.current = sendState
  }, [sendState])

  const resetDraftForNextTurn = useCallback(
    (opts = {}) => {
      const { keepDraft = false } = opts

      if (audioPreviewUrl) {
        URL.revokeObjectURL(audioPreviewUrl)
      }

      pendingSpeechRef.current = null
      micTranscriptBaseRef.current = ''
      micFinalTranscriptRef.current = ''
      if (!keepDraft) {
        draftTranscriptRef.current = ''
        setDraftTranscript('')
      }
      setSelectedAudio(null)
      setAudioPreviewUrl('')
      setTranscribeState({ status: 'idle', message: '' })
      setSendState({ status: 'idle', message: '' })
      setResult(null)
      setAgentStageText('')
    },
    [audioPreviewUrl]
  )

  useEffect(() => {
    const translatedText = result?.translatedText || ''

    // clear any previous frames/timers
    if (agentFramesTimerRef.current) {
      window.clearInterval(agentFramesTimerRef.current)
      agentFramesTimerRef.current = null
    }

    if (!translatedText) {
      agentFramesRef.current = null
      setAgentStageText('')
      return undefined
    }

    const frames = createSubtitleRevealFrames(translatedText)
    agentFramesRef.current = frames

    // If there's nothing to reveal, show immediately only if agent is speaking / stream visible.
    const shouldShowNow =
      /talk/i.test(String(activityState || '')) || showLiveStream

    if (frames.length <= 1) {
      if (shouldShowNow) {
        setAgentStageText(translatedText)
        agentFramesRef.current = null
      } else {
        setAgentStageText('')
      }

      return undefined
    }

    if (shouldShowNow) {
      // Start reveal immediately
      let frameIndex = 0
      setAgentStageText(frames[frameIndex])

      const timerId = window.setInterval(() => {
        frameIndex += 1
        if (frameIndex >= frames.length) {
          window.clearInterval(timerId)
          agentFramesRef.current = null
          agentFramesTimerRef.current = null
          setAgentStageText(translatedText)
          return
        }

        setAgentStageText(frames[frameIndex])
      }, 220)

      agentFramesTimerRef.current = timerId
    } else {
      // Wait for stream/activity to start; do not set agentStageText yet
      setAgentStageText('')
    }

    return () => {
      if (agentFramesTimerRef.current) {
        window.clearInterval(agentFramesTimerRef.current)
        agentFramesTimerRef.current = null
      }
    }
  }, [result?.translatedText, activityState, showLiveStream])

  // Start reveal when the stream becomes visible or agent activity indicates speaking.
  useEffect(() => {
    const shouldShowNow =
      /talk/i.test(String(activityState || '')) || showLiveStream

    if (!shouldShowNow) {
      return undefined
    }

    const frames = agentFramesRef.current
    if (!frames) {
      return undefined
    }

    const translatedText = result?.translatedText || ''

    if (frames.length <= 1) {
      setAgentStageText(translatedText)
      agentFramesRef.current = null
      return undefined
    }

    // start reveal from stored frames
    let frameIndex = 0
    setAgentStageText(frames[frameIndex])

    if (agentFramesTimerRef.current) {
      window.clearInterval(agentFramesTimerRef.current)
      agentFramesTimerRef.current = null
    }

    const timerId = window.setInterval(() => {
      frameIndex += 1

      if (frameIndex >= frames.length) {
        window.clearInterval(timerId)
        agentFramesRef.current = null
        agentFramesTimerRef.current = null
        setAgentStageText(translatedText)
        return
      }

      setAgentStageText(frames[frameIndex])
    }, 220)

    agentFramesTimerRef.current = timerId

    return () => {
      if (agentFramesTimerRef.current) {
        window.clearInterval(agentFramesTimerRef.current)
        agentFramesTimerRef.current = null
      }
    }
  }, [activityState, showLiveStream, result?.translatedText])

  const getCurrentStreamType = useCallback(() => {
    return agentManagerRef.current?.getStreamType?.() || 'unknown'
  }, [])

  const clearStageFreezeFrame = useCallback(() => {
    setStageFreezeFrame('')
  }, [])

  const isLegacySessionInvalidMessage = useCallback(
    (message) => {
      return (
        getCurrentStreamType() === 'legacy' &&
        /missing or invalid session_id/i.test(String(message || ''))
      )
    },
    [getCurrentStreamType]
  )

  const resetStageToIdle = useCallback(() => {
    setShowLiveStream(false)
    setAgentStageText('')
    clearStageFreezeFrame()
    streamRef.current = null

    if (videoRef.current) {
      videoRef.current.pause?.()
      videoRef.current.srcObject = null
      videoRef.current.removeAttribute('src')
      videoRef.current.load?.()
    }

    if (idleVideoRef.current && idleMediaUrl) {
      idleVideoRef.current.src = idleMediaUrl
      idleVideoRef.current.play().catch(() => {})
    }
  }, [clearStageFreezeFrame, idleMediaUrl])

  const captureStageFreezeFrame = useCallback(() => {
    if (typeof document === 'undefined') {
      return false
    }

    const preferredSource =
      showLiveStream && videoRef.current?.readyState >= 2
        ? videoRef.current
        : idleVideoRef.current?.readyState >= 2
          ? idleVideoRef.current
          : videoRef.current?.readyState >= 2
            ? videoRef.current
            : null

    if (!preferredSource) {
      return false
    }

    const frameWidth = preferredSource.videoWidth || preferredSource.clientWidth
    const frameHeight =
      preferredSource.videoHeight || preferredSource.clientHeight

    if (!frameWidth || !frameHeight) {
      return false
    }

    const canvas = document.createElement('canvas')
    canvas.width = frameWidth
    canvas.height = frameHeight

    const context = canvas.getContext('2d')
    if (!context) {
      return false
    }

    context.drawImage(preferredSource, 0, 0, frameWidth, frameHeight)

    try {
      setStageFreezeFrame(canvas.toDataURL('image/jpeg', 0.92))
      return true
    } catch {
      return false
    }
  }, [showLiveStream])

  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition

    if (!SpeechRecognition) {
      setMicState({
        status: 'unsupported',
        message: 'Trình duyệt này không hỗ trợ Web Speech API.',
        supported: false
      })
      pushDebugEvent('mic', 'Web Speech API is not supported.', 'warn')
      return undefined
    }

    const recognition = new SpeechRecognition()
    recognition.lang = activeDirection.recognitionLocale
    recognition.continuous = true
    recognition.interimResults = true
    recognition.maxAlternatives = 1

    recognition.onstart = () => {
      setMicState({
        status: 'listening',
        message:
          getLanguageDirectionConfig(languageDirection).micListeningMessage,
        supported: true
      })
      pushDebugEvent('mic', 'Microphone listening started.')
      startSilenceTimer()
    }

    recognition.onresult = (event) => {
      let interimTranscript = ''

      for (
        let index = event.resultIndex;
        index < event.results.length;
        index += 1
      ) {
        const result = event.results[index]
        const transcript = result[0]?.transcript || ''

        if (result.isFinal) {
          micFinalTranscriptRef.current += `${transcript.trim()} `
          pushDebugEvent('mic', `Final transcript: ${transcript.trim()}`)
        } else {
          interimTranscript += transcript
        }
      }

      const combinedTranscript = [
        micTranscriptBaseRef.current,
        micFinalTranscriptRef.current.trim(),
        interimTranscript.trim()
      ]
        .filter(Boolean)
        .join('\n')

      draftTranscriptRef.current = combinedTranscript
      setDraftTranscript(combinedTranscript)
      startSilenceTimer()
    }

    recognition.onerror = (event) => {
      const message = event.error
        ? `Mic error: ${event.error}`
        : 'Mic gặp lỗi không xác định.'

      setMicState({
        status: 'error',
        message,
        supported: true
      })
      pushDebugEvent('mic', message, 'error')
    }

    recognition.onend = () => {
      clearSilenceTimer()
      const endedUnexpectedly = micWantedRef.current
      const stoppedManually = micStopReasonRef.current === 'manual-stop'
      const stoppedAuto = micStopReasonRef.current === 'auto-stop'
      const stoppedForDirectionChange =
        micStopReasonRef.current === 'direction-change'

      const message = endedUnexpectedly
        ? 'Mic đã dừng ngoài ý muốn.'
        : stoppedForDirectionChange
          ? 'Đã đổi chiều dịch. Mic đã dừng để áp dụng ngôn ngữ mới.'
          : stoppedManually || stoppedAuto
            ? 'Mic đã dừng. App sẽ tự dịch và cho avatar nói.'
            : 'Mic đã dừng. Transcript đã được giữ lại trong ô nhập.'

      micWantedRef.current = false
      micStopReasonRef.current = 'idle'
      setMicState({
        status: 'idle',
        message,
        supported: true
      })
      pushDebugEvent('mic', message, 'warn')

      if (
        (stoppedManually || stoppedAuto) &&
        draftTranscriptRef.current.trim()
      ) {
        window.setTimeout(() => {
          handleSendRef.current?.(true)
        }, 120)
      }
    }

    recognitionRef.current = recognition
    setMicState({
      status: 'idle',
      message: activeDirection.micReadyMessage,
      supported: true
    })
    pushDebugEvent('mic', 'Web Speech API initialized.')

    return () => {
      micWantedRef.current = false
      clearSilenceTimer()
      try {
        recognition.stop()
      } catch (e) {
        // ignore
      }
      recognitionRef.current = null
    }
  }, [
    activeDirection.micReadyMessage,
    activeDirection.recognitionLocale,
    languageDirection,
    pushDebugEvent
  ])

  useEffect(() => {
    if (recognitionRef.current) {
      recognitionRef.current.lang = activeDirection.recognitionLocale
    }

    setMicState((currentState) => {
      if (!currentState.supported || currentState.status === 'listening') {
        return currentState
      }

      return {
        ...currentState,
        message: activeDirection.micReadyMessage
      }
    })
  }, [activeDirection.micReadyMessage, activeDirection.recognitionLocale])

  useEffect(() => {
    return () => {
      if (audioPreviewUrl) {
        URL.revokeObjectURL(audioPreviewUrl)
      }
    }
  }, [audioPreviewUrl])

  const callbacks = useMemo(
    () => ({
      onSrcObjectReady(value) {
        if (!value) {
          pushDebugEvent(
            'stream',
            `Remote media stream was cleared (${getCurrentStreamType()}).`,
            'warn'
          )
          return value
        }

        streamRef.current = value
        pushDebugEvent('stream', 'Remote media stream attached.')
        if (videoRef.current) {
          videoRef.current.src = ''
          videoRef.current.muted = true
          videoRef.current.defaultMuted = true
          videoRef.current.volume = 1
          videoRef.current.srcObject = value
          videoRef.current.play().catch(() => {
            pushDebugEvent(
              'audio',
              'Muted autoplay was blocked while attaching remote stream.',
              'warn'
            )
          })
        }

        return value
      },
      onVideoStateChange(state) {
        pushDebugEvent(
          'video',
          `Video state changed: ${state} (${getCurrentStreamType()}).`
        )
        if (state === 'START') {
          pendingSpeechRef.current = null
          setShowLiveStream(true)
          if (videoRef.current && streamRef.current) {
            videoRef.current.src = ''
            videoRef.current.srcObject = streamRef.current
          }
          clearStageFreezeFrame()
          return
        }

        if (state === 'STOP' && videoRef.current && agentManagerRef.current) {
          setShowLiveStream(false)
          videoRef.current.srcObject = undefined
          const agent = agentManagerRef.current.agent
          if (
            agent &&
            agent.presenter &&
            agent.presenter.idle_video &&
            idleVideoRef.current
          ) {
            idleVideoRef.current.src = agent.presenter.idle_video
            idleVideoRef.current.play().catch(() => {})
          }
          pushDebugEvent(
            'video',
            'Agent playback stopped, returning to idle video.',
            'warn'
          )
          return
        }

        if (videoRef.current && streamRef.current) {
          videoRef.current.src = ''
          videoRef.current.srcObject = streamRef.current
        }
      },
      onConnectionStateChange(state) {
        setConnectionStatus(state)
        if (
          state === 'disconnected' ||
          state === 'fail' ||
          state === 'closed'
        ) {
          setShowLiveStream(false)
          setAgentStageText('')
          clearStageFreezeFrame()
        }
        pushDebugEvent(
          'connect',
          `Connection state changed: ${state} (${getCurrentStreamType()}).`
        )
        if (state === 'connected') {
          setAgentError('')
          setAudioOutputMessage((message) =>
            audioOutputStateRef.current === 'enabled'
              ? message
              : 'Đã kết nối. Nếu chưa nghe tiếng, bấm Bật tiếng một lần.'
          )
        }
      },
      onAgentActivityStateChange(state) {
        setActivityState(state)
        pushDebugEvent('agent', `Activity changed: ${state}.`)
      },
      onInterruptDetected(event) {
        pendingSpeechRef.current = null
        setActivityState('IDLE')
        setSendState({ status: 'idle', message: '' })
        setAgentStageText('')
        pushDebugEvent(
          'speak',
          `Agent playback interrupted (${event?.type || 'unknown'}).`,
          'warn'
        )
      },
      onError(error) {
        const message = error.message || String(error)
        const pendingSpeak = pendingSpeechRef.current

        if (
          isLegacySessionInvalidMessage(message) &&
          (!pendingSpeak || pendingSpeak.attempt < 1)
        ) {
          setAgentError('')
          setSendState({
            status: 'sending',
            message: pendingSpeak?.speakPayload?.input
              ? 'Session legacy đã hết hạn. App đang tự kết nối lại và gửi lại câu nói...'
              : 'Session legacy đã hết hạn. App đang tự kết nối lại...'
          })
          pushDebugEvent(
            'connect',
            'Legacy session became invalid. Starting automatic reconnect.',
            'warn'
          )
          void recoverLegacySessionRef.current?.({
            reason: message,
            retryPayload: pendingSpeak?.speakPayload || null,
            retryAttempt: pendingSpeak ? pendingSpeak.attempt + 1 : 0
          })
          return
        }

        setAgentError(message)
        pendingSpeechRef.current = null
        if (sendStateRef.current.status === 'sending') {
          setSendState({
            status: 'error',
            message
          })
        }
        clearStageFreezeFrame()
        pushDebugEvent('agent', message, 'error')
      }
    }),
    [
      clearStageFreezeFrame,
      getCurrentStreamType,
      isLegacySessionInvalidMessage,
      pushDebugEvent
    ]
  )

  const unlockRemoteAudio = useCallback(async () => {
    if (!videoRef.current) {
      return
    }

    try {
      videoRef.current.muted = false
      videoRef.current.defaultMuted = false
      videoRef.current.volume = 1
      const playbackResult = await Promise.race([
        Promise.resolve(videoRef.current.play()).then(() => 'started'),
        new Promise((resolve) => {
          window.setTimeout(() => resolve('pending'), 900)
        })
      ])

      if (playbackResult !== 'started') {
        setAudioOutputState('blocked')
        setAudioOutputMessage(
          'Audio output vẫn đang chờ stream sẵn sàng. App sẽ tiếp tục gửi lệnh nói thay vì đứng chờ.'
        )
        pushDebugEvent(
          'audio',
          'Audio unlock is still pending after timeout; continuing without blocking.',
          'warn'
        )
        return
      }

      setAudioOutputState('enabled')
      setAudioOutputMessage(
        'Audio output đã mở. Avatar sẽ phát tiếng khi speak().'
      )
      pushDebugEvent('audio', 'Audio output unlocked.')
    } catch (error) {
      setAudioOutputState('blocked')
      setAudioOutputMessage(
        error instanceof Error
          ? `Browser vẫn đang chặn audio: ${error.message}`
          : 'Browser vẫn đang chặn audio output.'
      )
      pushDebugEvent(
        'audio',
        error instanceof Error
          ? `Unlock audio failed: ${error.message}`
          : 'Unlock audio failed.',
        'warn'
      )
    }
  }, [pushDebugEvent])

  const interruptAgentPlayback = useCallback(
    async (reason = 'click') => {
      const manager = agentManagerRef.current

      if (!manager?.interrupt) {
        throw new Error('Agent hiện không hỗ trợ dừng speak giữa chừng.')
      }

      if (!manager.getIsInterruptAvailable?.()) {
        throw new Error('Session hiện tại không hỗ trợ interrupt.')
      }

      setIsInterrupting(true)

      try {
        await manager.interrupt({ type: reason })
        setActivityState('IDLE')
        setSendState({ status: 'idle', message: '' })
        setAgentStageText('')
        pushDebugEvent('speak', 'Manual stop agent requested.', 'warn')
      } finally {
        setIsInterrupting(false)
      }
    },
    [pushDebugEvent]
  )

  const startMicListening = async () => {
    if (!recognitionRef.current) {
      setMicState((currentState) => ({
        ...currentState,
        status: currentState.supported ? 'error' : 'unsupported',
        message: currentState.supported
          ? 'Mic chưa được khởi tạo.'
          : 'Trình duyệt không hỗ trợ Web Speech API.'
      }))
      return
    }

    if (micState.status === 'listening') {
      return
    }

    resetDraftForNextTurn({
      keepDraft: Boolean(
        draftTranscriptRef.current && draftTranscriptRef.current.trim()
      )
    })
    micTranscriptBaseRef.current = ''
    micFinalTranscriptRef.current = ''
    micWantedRef.current = true
    micStopReasonRef.current = 'active'
    pushDebugEvent('mic', 'Manual microphone start requested.')

    try {
      recognitionRef.current.lang = activeDirection.recognitionLocale
      recognitionRef.current.start()
      startSilenceTimer()
    } catch (error) {
      micWantedRef.current = false
      setMicState({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Không thể bật microphone.',
        supported: true
      })
      pushDebugEvent(
        'mic',
        error instanceof Error ? error.message : 'Không thể bật microphone.',
        'error'
      )
    }
  }

  const stopMicListening = () => {
    if (!recognitionRef.current) {
      return
    }

    captureStageFreezeFrame()
    micWantedRef.current = false
    micStopReasonRef.current = 'manual-stop'
    pushDebugEvent('mic', 'Manual microphone stop requested.')
    clearSilenceTimer()
    recognitionRef.current.stop()
  }

  const handleDirectionChange = useCallback(
    (nextDirection) => {
      if (nextDirection === languageDirection) {
        return
      }

      if (micState.status === 'listening' && recognitionRef.current) {
        micWantedRef.current = false
        micStopReasonRef.current = 'direction-change'
        recognitionRef.current.stop()
      }

      setLanguageDirection(nextDirection)
      setSendState({ status: 'idle', message: '' })
      setResult(null)
      pushDebugEvent(
        'mode',
        `Language direction changed to ${getLanguageDirectionConfig(nextDirection).label}.`
      )
    },
    [languageDirection, micState.status, pushDebugEvent]
  )

  const connectAgent = useCallback(
    async ({ forceReconnect = false } = {}) => {
      if (!agentManagerRef.current) {
        throw new Error('Agent chưa sẵn sàng.')
      }

      if (!forceReconnect && connectionStatus === 'connected') {
        return
      }

      if (connectPromiseRef.current) {
        if (!forceReconnect) {
          pushDebugEvent('connect', 'Reusing pending connect request.')
        }
        await connectPromiseRef.current
        return
      }

      pushDebugEvent('connect', 'Opening realtime session...')
      const pendingConnect = agentManagerRef.current.connect().finally(() => {
        connectPromiseRef.current = null
      })

      connectPromiseRef.current = pendingConnect
      await pendingConnect
      pushDebugEvent(
        'connect',
        `Realtime session connected with stream type: ${getCurrentStreamType()}.`
      )
    },
    [connectionStatus, getCurrentStreamType, pushDebugEvent]
  )

  const dispatchSpeakCommand = useCallback(
    (speakPayload, { attempt = 0 } = {}) => {
      const manager = agentManagerRef.current

      if (!manager?.speak) {
        throw new Error('Agent chưa sẵn sàng để nói.')
      }

      pendingSpeechRef.current = {
        speakPayload,
        attempt
      }

      pushDebugEvent(
        'speak',
        attempt > 0
          ? 'Retrying agentManager.speak() after reconnect.'
          : 'Dispatching agentManager.speak().',
        attempt > 0 ? 'warn' : 'info'
      )

      Promise.resolve(manager.speak(speakPayload))
        .then(() => {
          pushDebugEvent(
            'speak',
            attempt > 0
              ? 'agentManager.speak() resolved after reconnect.'
              : 'agentManager.speak() resolved.'
          )
        })
        .catch((error) => {
          const message =
            error instanceof Error
              ? error.message
              : 'Không gửi được lệnh nói tới agent.'

          if (isLegacySessionInvalidMessage(message) && attempt < 1) {
            void recoverLegacySessionRef.current?.({
              reason: message,
              retryPayload: speakPayload,
              retryAttempt: attempt + 1
            })
            return
          }

          pendingSpeechRef.current = null
          setSendState({
            status: 'error',
            message
          })
          pushDebugEvent('speak', message, 'error')
        })
    },
    [isLegacySessionInvalidMessage, pushDebugEvent]
  )

  dispatchSpeakCommandRef.current = dispatchSpeakCommand

  const recoverLegacySession = useCallback(
    async ({ reason, retryPayload = null, retryAttempt = 0 } = {}) => {
      if (reconnectPromiseRef.current) {
        return reconnectPromiseRef.current
      }

      const manager = agentManagerRef.current
      if (!manager) {
        throw new Error('Agent chưa sẵn sàng để tự kết nối lại.')
      }

      const recoveryPromise = (async () => {
        captureStageFreezeFrame()
        resetStageToIdle()
        setAgentError('')
        setConnectionStatus('disconnected')
        pushDebugEvent(
          'connect',
          retryPayload
            ? 'Reconnecting legacy session automatically before retrying speak.'
            : 'Reconnecting legacy session automatically.',
          'warn'
        )

        try {
          await manager.disconnect().catch(() => {})
          await new Promise((resolve) => {
            window.setTimeout(resolve, 1200)
          })

          try {
            await connectAgent({ forceReconnect: true })
          } catch (error) {
            const connectMessage =
              error instanceof Error ? error.message : String(error)

            if (!/Max user sessions reached/i.test(connectMessage)) {
              throw error
            }

            pushDebugEvent(
              'connect',
              'Reconnect hit session cap. Waiting briefly before retrying.',
              'warn'
            )

            await new Promise((resolve) => {
              window.setTimeout(resolve, 1800)
            })

            await connectAgent({ forceReconnect: true })
          }

          await unlockRemoteAudio()

          if (retryPayload) {
            dispatchSpeakCommandRef.current?.(retryPayload, {
              attempt: retryAttempt
            })
            setSendState({
              status: 'ready',
              message: 'Đã tự kết nối lại session legacy và gửi lại lệnh nói.'
            })
          } else {
            setSendState({
              status: 'idle',
              message: ''
            })
          }
        } catch (error) {
          pendingSpeechRef.current = null
          throw error
        }
      })()
        .catch((error) => {
          const message =
            error instanceof Error
              ? error.message
              : reason || 'Không thể tự kết nối lại session legacy.'

          setAgentError(message)
          setSendState({
            status: 'error',
            message
          })
          pushDebugEvent('connect', message, 'error')
        })
        .finally(() => {
          reconnectPromiseRef.current = null
        })

      reconnectPromiseRef.current = recoveryPromise
      return recoveryPromise
    },
    [
      captureStageFreezeFrame,
      connectAgent,
      pushDebugEvent,
      resetStageToIdle,
      unlockRemoteAudio
    ]
  )

  recoverLegacySessionRef.current = recoverLegacySession

  useEffect(() => {
    let cancelled = false

    const loadAgent = async () => {
      try {
        setAgentStatus('loading')
        setConnectionStatus('loading')
        setAgentError('')
        pushDebugEvent('init', 'Loading embed config...')

        const configResponse = await fetch(`${API_BASE_URL}/api/embed-config`)

        const payload = await configResponse.json()

        if (!configResponse.ok || !payload.ok) {
          throw new Error(payload.message || 'Không lấy được config Agent.')
        }

        const config = payload.config || {}

        if (cancelled) {
          return
        }

        const manager = await sdk.createAgentManager(config.agentId, {
          auth: {
            type: 'key',
            clientKey: config.clientKey
          },
          callbacks,
          streamOptions: {
            compatibilityMode: 'auto',
            streamWarmup: false,
            fluent: true
          }
        })

        if (cancelled) {
          await manager.disconnect().catch(() => {})
          return
        }

        agentManagerRef.current = manager
        pushDebugEvent(
          'init',
          'Agent manager created successfully. Requested fluent stream with warmup disabled.'
        )

        if (manager.agent?.presenter?.idle_video) {
          setIdleMediaUrl(manager.agent.presenter.idle_video)
        }

        if (idleVideoRef.current && manager.agent?.presenter?.idle_video) {
          idleVideoRef.current.src = manager.agent.presenter.idle_video
          idleVideoRef.current.play().catch(() => {})
        }

        setAgentStatus('ready')
        setConnectionStatus('disconnected')
        pushDebugEvent(
          'init',
          'Agent is ready. Waiting for manual connect to avoid extra sessions.'
        )
      } catch (error) {
        if (!cancelled) {
          setAgentStatus('error')
          setConnectionStatus('fail')
          setAgentError(error.message || 'Load Agent thất bại.')
          pushDebugEvent(
            'init',
            error.message || 'Load Agent thất bại.',
            'error'
          )
        }
      }
    }

    loadAgent()

    return () => {
      cancelled = true
      if (agentManagerRef.current) {
        agentManagerRef.current.disconnect().catch(console.error)
      }
    }
  }, [callbacks, pushDebugEvent])

  useEffect(() => {
    if (!import.meta.env.DEV || typeof window === 'undefined') {
      return undefined
    }

    window.__ver2Debug = {
      simulateLegacySessionInvalid() {
        const pendingSpeak = pendingSpeechRef.current

        return recoverLegacySessionRef.current?.({
          reason: 'SessionError: missing or invalid session_id',
          retryPayload: pendingSpeak?.speakPayload || null,
          retryAttempt: pendingSpeak ? pendingSpeak.attempt + 1 : 0
        })
      }
    }

    return () => {
      delete window.__ver2Debug
    }
  }, [])

  useEffect(() => {
    const disconnectAgent = () => {
      if (agentManagerRef.current) {
        pushDebugEvent('connect', 'Disconnecting agent on page exit.')
        agentManagerRef.current.disconnect().catch(() => {})
      }
    }

    window.addEventListener('pagehide', disconnectAgent)
    window.addEventListener('beforeunload', disconnectAgent)

    return () => {
      window.removeEventListener('pagehide', disconnectAgent)
      window.removeEventListener('beforeunload', disconnectAgent)
    }
  }, [pushDebugEvent])

  const handleDisconnect = async () => {
    try {
      if (agentManagerRef.current) {
        pendingSpeechRef.current = null
        clearStageFreezeFrame()
        pushDebugEvent('connect', 'Manual disconnect requested.')
        await agentManagerRef.current.disconnect()
      }
    } catch (error) {
      setAgentError(error.message || 'Không thể ngắt kết nối agent.')
      pushDebugEvent(
        'connect',
        error.message || 'Không thể ngắt kết nối agent.',
        'error'
      )
    }
  }

  const handleAudioChange = async (event) => {
    const file = event.target.files?.[0] || null

    setResult(null)
    setSendState({ status: 'idle', message: '' })

    if (audioPreviewUrl) {
      URL.revokeObjectURL(audioPreviewUrl)
    }

    if (!file) {
      setSelectedAudio(null)
      setAudioPreviewUrl('')
      setDraftTranscript('')
      setTranscribeState({ status: 'idle', message: '' })
      return
    }

    setSelectedAudio(file)
    const previewUrl = URL.createObjectURL(file)
    setAudioPreviewUrl(previewUrl)
    pushDebugEvent('stt', `Uploading audio file: ${file.name}.`)
    setTranscribeState({
      status: 'uploading',
      message: 'Đang tải audio và chuyển sang bảng transcript...'
    })

    const formData = new FormData()
    formData.append('audio', file)
    formData.append('languageCode', activeDirection.sttLanguageCode)

    for (const languageCode of activeDirection.sttAlternativeLanguageCodes) {
      formData.append('alternativeLanguageCodes', languageCode)
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/realtime/transcribe`, {
        method: 'POST',
        body: formData
      })
      const payload = await response.json()

      if (!response.ok || !payload.ok) {
        throw new Error(
          payload.message || 'Không chuyển được audio thành bảng transcript.'
        )
      }

      setDraftTranscript(payload.transcript || '')
      pushDebugEvent('stt', 'Transcript received from backend.')
      setTranscribeState({
        status: 'ready',
        message: `Đã lấy bảng transcript từ audio (${payload.languageCode || activeDirection.sttLanguageCode}).`
      })
    } catch (error) {
      setDraftTranscript('')
      setTranscribeState({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Không xử lý được file audio.'
      })
      pushDebugEvent(
        'stt',
        error instanceof Error ? error.message : 'Không xử lý được file audio.',
        'error'
      )
    }
  }

  const hasTranscript = draftTranscript.trim().length > 0
  const isConnected = connectionStatus === 'connected'
  const isConnecting = connectionStatus === 'connecting'
  const isMicListening = micState.status === 'listening'
  const isAgentTalking = /talk/i.test(String(activityState || ''))
  const canInterruptAgent =
    isConnected && Boolean(agentManagerRef.current?.getIsInterruptAvailable?.())
  const showInterruptControl =
    canInterruptAgent && (isAgentTalking || isInterrupting)
  const voiceUiState = agentError
    ? 'error'
    : isConnecting
      ? 'connecting'
      : sendState.status === 'sending'
        ? 'sending'
        : isMicListening
          ? 'listening'
          : isConnected
            ? 'connected'
            : agentStatus === 'ready'
              ? 'ready'
              : agentStatus
  const voiceUiLabel = formatVoiceUiLabel(voiceUiState)
  const voiceHintMessage = !isConnected
    ? 'Tap Start conversation. App sẽ tự kết nối và bật mic để bạn nói ngay.'
    : isMicListening
      ? `Đang nghe ${activeDirection.sourceLanguageLabel}. Khi bạn dừng nói, agent sẽ dịch và trả lời tự động.`
      : `Bấm mic để nói tiếp bằng ${activeDirection.sourceLanguageLabel} hoặc mở Voice tools nếu muốn nhập tay / tải audio.`
  const composerMicLabel = isMicListening
    ? 'Dừng mic'
    : isConnected
      ? 'Bật mic'
      : isConnecting
        ? 'Đang kết nối...'
        : 'Nói bằng mic'
  const shouldShowAudioCard =
    audioOutputState === 'blocked' ||
    (isConnected && audioOutputState !== 'enabled')
  const shouldShowTranscribeCard =
    transcribeState.status !== 'idle' || Boolean(selectedAudio)
  const shouldShowSendCard = sendState.status !== 'idle'
  const shouldShowTechnicalPanel = import.meta.env.DEV
  const showStageLoading =
    voiceUiState === 'connecting' ||
    (voiceUiState === 'loading' && agentStatus !== 'ready')
  const shouldRenderStageFallback =
    !idleMediaUrl && !showLiveStream && agentStatus === 'loading'
  const stageLoadingLabel = isConnecting
    ? 'Đang kết nối voice session...'
    : 'Đang chuẩn bị agent...'
  const shouldShowStageConversation =
    isConnected ||
    isMicListening ||
    sendState.status === 'sending' ||
    /speak|talk|stream/i.test(String(activityState || ''))
  const stageUserSubtitle = createStageSubtitle(
    draftTranscript,
    'Bạn vừa nói',
    'user'
  )
  const stageAgentSubtitle = createStageSubtitle(
    agentStageText || result?.translatedText,
    activeDirection.agentSpeakLabel,
    'agent'
  )
  const shouldShowAgentSubtitle = isAgentTalking || showLiveStream

  const activeStageSubtitle = isMicListening
    ? stageUserSubtitle
    : sendState.status === 'sending'
      ? shouldShowAgentSubtitle
        ? stageAgentSubtitle || stageUserSubtitle
        : stageUserSubtitle
      : shouldShowAgentSubtitle
        ? stageAgentSubtitle
        : stageUserSubtitle

  const ensureConnected = async () => {
    if (!agentManagerRef.current) {
      throw new Error('Agent chưa sẵn sàng.')
    }

    if (connectionStatus !== 'connected') {
      await connectAgent()
    }
  }

  const handleStartConversation = async () => {
    setIsComposerOpen(false)

    try {
      if (!isConnected) {
        captureStageFreezeFrame()
        setAgentError('')
        pushDebugEvent('connect', 'Primary voice action requested.')
        await connectAgent()
        await unlockRemoteAudio()
      }

      if (canInterruptAgent && isAgentTalking) {
        await interruptAgentPlayback('start-new-turn')
      }

      if (recognitionRef.current) {
        await startMicListening()
      }
    } catch (error) {
      setAgentError(error.message || 'Không thể bắt đầu hội thoại giọng nói.')
      pushDebugEvent(
        'connect',
        error.message || 'Không thể bắt đầu hội thoại giọng nói.',
        'error'
      )
      setIsComposerOpen(true)
    }
  }

  const handleSend = async (fromMicAutoStop = false) => {
    const isAutoTriggeredFromMic = fromMicAutoStop === true
    const message = draftTranscriptRef.current.trim()

    if (!message) {
      setSendState({
        status: 'error',
        message: 'Bạn cần có nội dung bảng transcript trước khi gửi.'
      })
      return
    }

    setSendState({
      status: 'sending',
      message: isAutoTriggeredFromMic
        ? activeDirection.autoSendMessage
        : activeDirection.sendMessage
    })
    pushDebugEvent(
      'speak',
      isAutoTriggeredFromMic
        ? activeDirection.autoSpeakDebugScopeMessage
        : activeDirection.speakDebugScopeMessage
    )
    captureStageFreezeFrame()
    setResult(null)

    try {
      await ensureConnected()
      await unlockRemoteAudio()

      const response = await fetch(`${API_BASE_URL}/api/realtime/translate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message,
          sourceLanguage: activeDirection.sourceLanguage,
          targetLanguage: activeDirection.targetLanguage
        })
      })

      const payload = await response.json()

      if (!response.ok || !payload.ok) {
        throw new Error(payload.message || 'Không gửi được message.')
      }

      const translatedText = payload.translatedText || ''

      if (!translatedText) {
        throw new Error(activeDirection.translateErrorMessage)
      }

      pushDebugEvent('translate', `Translated text: ${translatedText}`)

      let speakPayload = {
        type: 'text',
        input: translatedText
      }

      let audioUrl = null

      if (activeDirection.speakMode === 'audio') {
        setSendState({
          status: 'sending',
          message: activeDirection.synthesizePendingMessage
        })

        const synthesizeResponse = await fetch(
          `${API_BASE_URL}/api/realtime/synthesize`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              text: translatedText,
              languageCode:
                activeDirection.targetLanguage === 'VI' ? 'vi-VN' : undefined
            })
          }
        )

        const synthesizePayload = await synthesizeResponse.json()

        if (!synthesizeResponse.ok || !synthesizePayload.ok) {
          throw new Error(
            synthesizePayload.message || 'Khong tao duoc audio TTS cho Agent.'
          )
        }

        audioUrl = synthesizePayload.audioUrl || ''

        if (!audioUrl) {
          throw new Error('Backend khong tra ve audioUrl cong khai cho D-ID.')
        }

        pushDebugEvent('tts', `Vietnamese TTS audio ready: ${audioUrl}`)

        speakPayload = {
          type: 'audio',
          audio_url: audioUrl
        }
      }

      if (agentManagerRef.current) {
        if (streamRef.current && videoRef.current) {
          videoRef.current.src = ''
          videoRef.current.srcObject = streamRef.current
        }
        dispatchSpeakCommand(speakPayload)
      }

      setResult({
        sourceText: message,
        translatedText,
        resultLabel: activeDirection.resultLabel,
        audioUrl
      })

      setSendState({
        status: 'ready',
        message: activeDirection.readyMessage
      })
    } catch (error) {
      setSendState({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Không gửi được message.'
      })
      pushDebugEvent(
        'speak',
        error instanceof Error ? error.message : 'Không gửi được message.',
        'error'
      )
    }
  }

  handleSendRef.current = handleSend

  return (
    <main className={`ver2-shell ${isComposerOpen ? 'composer-open' : ''}`}>
      <section className="ver2-stage">
        <div className="ver2-stage-poster" aria-hidden="true" />
        <video
          ref={idleVideoRef}
          className={`ver2-idle-video ${showLiveStream ? 'is-hidden' : ''}`}
          autoPlay
          muted
          loop
          playsInline
        />
        {shouldRenderStageFallback ? (
          <div className="ver2-idle-fallback" />
        ) : null}
        <video
          ref={videoRef}
          className={`ver2-video ${showLiveStream ? 'is-visible' : ''}`}
          autoPlay
          playsInline
        />
        {stageFreezeFrame ? (
          <div className="stage-freeze-frame" aria-hidden="true">
            <img src={stageFreezeFrame} alt="" />
          </div>
        ) : null}

        <div className="stage-mask" />
        {isComposerOpen ? (
          <button
            type="button"
            className="composer-backdrop"
            onClick={() => setIsComposerOpen(false)}
            aria-label="Đóng bảng điều khiển"
          />
        ) : null}

        <header className="floating-header">
          <div className="floating-statuses">
            <span className={`floating-pill status-${agentStatus}`}>
              <span className="status-dot" />
              Agent {formatConnectionLabel(agentStatus)}
            </span>
            <span className={`floating-pill status-${voiceUiState}`}>
              <span className="status-dot" />
              {voiceUiLabel}
            </span>
          </div>
        </header>

        <div
          className={`stage-loading-overlay ${showStageLoading ? 'is-visible' : ''}`}
        >
          <div className="stage-loading-card" role="status" aria-live="polite">
            <span className="stage-loading-spinner" aria-hidden="true" />
            <strong>{voiceUiLabel}</strong>
            <p>{stageLoadingLabel}</p>
          </div>
        </div>

        <div
          className={`voice-stage-overlay ${showStageLoading ? 'is-hidden' : ''}`}
        >
          <div className={`voice-stage-status status-${voiceUiState}`}>
            <span className="status-dot" />
            {voiceUiLabel}
          </div>

          <div className="voice-stage-copy">
            {shouldShowStageConversation && activeStageSubtitle ? (
              <article
                className={`voice-caption-card ${activeStageSubtitle.tone}`}
              >
                <span>{activeStageSubtitle.label}</span>
                <p>
                  <span className="voice-caption-line">
                    {(activeStageSubtitle.lines || []).join(' ')}
                  </span>
                </p>
              </article>
            ) : null}

            {!shouldShowStageConversation || !activeStageSubtitle ? (
              <p className="voice-stage-hint">{voiceHintMessage}</p>
            ) : null}
          </div>
        </div>

        <button
          type="button"
          className={`composer-toggle ${isComposerOpen ? 'is-open' : ''}`}
          onClick={() => setIsComposerOpen((value) => !value)}
          aria-expanded={isComposerOpen}
          aria-controls="voice-composer"
          aria-label={isComposerOpen ? 'Đóng hộp chat' : 'Mở hộp chat'}
          title={isComposerOpen ? 'Đóng hộp chat' : 'Mở hộp chat'}
        >
          {/* Chat bubble SVG icon */}
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {!showStageLoading && isConnected ? (
          <div className="conversation-dock">
            <button
              type="button"
              className="dock-icon-button"
              onClick={() => setIsComposerOpen((value) => !value)}
              aria-expanded={isComposerOpen}
              aria-controls="voice-composer"
            >
              {isComposerOpen ? '⌄' : '⌃'}
            </button>
            <button
              type="button"
              className={`dock-icon-button dock-mic-button ${isMicListening ? 'is-live' : ''}`}
              onClick={
                isMicListening ? stopMicListening : handleStartConversation
              }
            >
              {isMicListening ? '■' : '🎤'}
            </button>
            {autoStoppedIndicator ? (
              <span className="auto-stop-pill" aria-live="polite">
                Auto-stopped
              </span>
            ) : null}
            {showInterruptControl ? (
              <button
                type="button"
                className="dock-icon-button dock-stop-button"
                onClick={() => interruptAgentPlayback('force-stop')}
                disabled={isInterrupting}
                title="Dừng agent ngay"
                aria-label="Dừng agent ngay"
              >
                {isInterrupting ? '…' : '✕'}
              </button>
            ) : null}
            <div className="dock-waveform">
              <span className="dock-waveform-pill" />
              <span className="dock-waveform-pill tall" />
              <span className="dock-waveform-pill short" />
              <span className="dock-waveform-pill tall" />
              <span className="dock-waveform-pill" />
            </div>
            <DirectionSwitch
              className="dock-language-switch"
              value={languageDirection}
              onChange={handleDirectionChange}
            />
          </div>
        ) : !showStageLoading ? (
          <button
            type="button"
            className="start-conversation-button"
            onClick={handleStartConversation}
            disabled={agentStatus !== 'ready' || isConnecting}
          >
            {isConnecting ? 'Connecting...' : '🎙 Tap to speak'}
          </button>
        ) : null}
      </section>

      <aside
        id="voice-composer"
        className={`composer-drawer ${isComposerOpen ? 'is-open' : ''}`}
      >
        <div className="composer-header">
          <div>
            <p className="composer-kicker">Voice Tools</p>
            <h2>Fallback chat & audio</h2>
          </div>
          <button
            type="button"
            className="drawer-close"
            onClick={() => setIsComposerOpen(false)}
            aria-label="Đóng bảng điều khiển"
          >
            ×
          </button>
        </div>

        <div className="composer-body">
          <DirectionSwitch
            className="drawer-language-switch"
            value={languageDirection}
            onChange={handleDirectionChange}
          />

          <label className="editor-box">
            <span className="editor-title direction-title">
              <span>Nhập văn bản</span>
              <DirectionLabel
                direction={activeDirection}
                className="direction-label-inline"
              />
            </span>
            <textarea
              className="transcript-editor"
              value={draftTranscript}
              onChange={(event) => setDraftTranscript(event.target.value)}
              placeholder={activeDirection.inputPlaceholder}
            />
          </label>

          <label className="upload-box">
            <span className="upload-title">
              Tải file MP3/WAV ({activeDirection.sourceLanguageLabel})
            </span>
            <input
              type="file"
              accept="audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/wave,.mp3,.wav"
              onChange={handleAudioChange}
            />
          </label>

          {selectedAudio ? (
            <div className="compact-card">
              <strong>{selectedAudio.name}</strong>
              <span>
                {Math.ceil(selectedAudio.size / 1024)} KB ·{' '}
                {selectedAudio.type || 'audio'}
              </span>
              <audio controls src={audioPreviewUrl} />
            </div>
          ) : null}

          <div className="composer-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={
                isMicListening ? stopMicListening : handleStartConversation
              }
              disabled={isConnecting || sendState.status === 'sending'}
            >
              {composerMicLabel}
            </button>
            {autoStoppedIndicator ? (
              <span
                className="auto-stop-pill composer-auto-stop"
                aria-live="polite"
              >
                Auto-stopped
              </span>
            ) : null}
            {showInterruptControl ? (
              <button
                type="button"
                className="secondary-button stop-button"
                onClick={() => interruptAgentPlayback('force-stop')}
                disabled={isInterrupting}
              >
                {isInterrupting ? 'Đang dừng...' : 'Dừng agent'}
              </button>
            ) : null}
            <button
              type="button"
              className="primary-button direction-send-button"
              onClick={() => handleSend(false)}
              disabled={
                !hasTranscript || sendState.status === 'sending' || !isConnected
              }
            >
              {sendState.status === 'sending' ? (
                'Đang nói...'
              ) : (
                <>
                  <span>Gửi</span>
                  <DirectionLabel
                    direction={activeDirection}
                    className="direction-label-inline"
                  />
                </>
              )}
            </button>
          </div>

          {shouldShowAudioCard ||
          shouldShowTranscribeCard ||
          shouldShowSendCard ||
          result ||
          agentError ||
          shouldShowTechnicalPanel ? (
            <div className="composer-status-list">
              {shouldShowAudioCard ? (
                <div className={`compact-card status-card-${audioOutputState}`}>
                  <strong>Audio output</strong>
                  <p>{audioOutputMessage}</p>
                </div>
              ) : null}

              {shouldShowTranscribeCard ? (
                <div
                  className={`compact-card status-card-${transcribeState.status}`}
                >
                  <strong>STT</strong>
                  <p>{transcribeState.message || 'Chưa có file audio.'}</p>
                </div>
              ) : null}

              {shouldShowSendCard ? (
                <div className={`compact-card status-card-${sendState.status}`}>
                  <strong>Speak</strong>
                  <p>
                    {sendState.message ||
                      `Sẵn sàng dịch và phát ${activeDirection.targetLanguageLabel}.`}
                  </p>
                </div>
              ) : null}

              {result ? (
                <div className="compact-card result-card">
                  <strong>{result.resultLabel || 'Bản dịch'}</strong>
                  <p>{result.translatedText}</p>
                </div>
              ) : null}

              {agentError ? (
                <div className="compact-card error-card">
                  <strong>Agent error</strong>
                  <p>{agentError}</p>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={handleDisconnect}
                  >
                    Disconnect
                  </button>
                </div>
              ) : null}

              {shouldShowTechnicalPanel ? (
                <section className="debug-card">
                  <div className="debug-card-header">
                    <strong>Debug timeline</strong>
                    <button
                      type="button"
                      className="debug-clear-button"
                      onClick={() => setDebugEvents([])}
                    >
                      Clear
                    </button>
                  </div>

                  {debugEvents.length > 0 ? (
                    <ul className="debug-list">
                      {debugEvents.map((event) => (
                        <li
                          key={event.id}
                          className={`debug-item ${event.level}`}
                        >
                          <div className="debug-item-meta">
                            <span>{event.timestamp}</span>
                            <span>{event.scope}</span>
                          </div>
                          <p>{event.message}</p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="debug-empty">
                      Chưa có log. Hãy bấm Kết nối lại hoặc Dịch và nói để theo
                      dõi luồng.
                    </p>
                  )}
                </section>
              ) : null}
            </div>
          ) : null}
        </div>
      </aside>
    </main>
  )
}

export default Ver2Page
