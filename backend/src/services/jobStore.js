const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

const STEP_DEFINITIONS = [
  {
    key: 'stt',
    order: 1,
    title: 'Speech to Text',
    description: 'Google STT đang chuyển audio thành transcript.'
  },
  {
    key: 'optimize',
    order: 2,
    title: 'Optimize Transcript',
    description: 'Vertex AI đang làm sạch transcript.'
  },
  {
    key: 'translate',
    order: 3,
    title: 'Translate',
    description: 'DeepL đang dịch nội dung sang tiếng Nhật.'
  },
  {
    key: 'avatar',
    order: 4,
    title: 'Avatar Engine',
    description: 'D-ID đang tạo video avatar.'
  }
]

const MESSAGE_STEP_DEFINITIONS = [
  {
    key: 'translate',
    order: 3,
    title: 'Translate',
    description: 'DeepL đang dịch nội dung tiếng Việt sang tiếng Nhật.'
  },
  {
    key: 'avatar',
    order: 4,
    title: 'Avatar Engine',
    description: 'D-ID đang tạo video avatar từ message.'
  }
]

const jobs = new Map()
const JOBS_DIR = path.resolve(process.cwd(), 'tmp', 'jobs')

function ensureJobsDir() {
  fs.mkdirSync(JOBS_DIR, { recursive: true })
}

function getJobFilePath(jobId) {
  return path.join(JOBS_DIR, `${jobId}.json`)
}

function persistJob(job) {
  ensureJobsDir()
  fs.writeFileSync(getJobFilePath(job.id), JSON.stringify(job, null, 2), 'utf8')
}

function loadPersistedJob(jobId) {
  const filePath = getJobFilePath(jobId)
  if (!fs.existsSync(filePath)) {
    return null
  }

  const job = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  jobs.set(jobId, job)
  return job
}

function cloneJob(job) {
  const { stepDefinitions, ...safeJob } = job
  return JSON.parse(JSON.stringify(safeJob))
}

function buildSteps(
  definitions,
  activeKey,
  finalStatus = 'pending',
  failedKey = null
) {
  const activeIndex = definitions.findIndex((step) => step.key === activeKey)

  return definitions.map((step, index) => {
    let status = 'pending'

    if (finalStatus === 'completed') {
      status = 'completed'
    } else if (finalStatus === 'failed' && step.key === failedKey) {
      status = 'failed'
    } else if (activeIndex !== -1) {
      if (index < activeIndex) {
        status = 'completed'
      } else if (index === activeIndex) {
        status = finalStatus === 'failed' ? 'failed' : 'active'
      }
    }

    return {
      ...step,
      status
    }
  })
}

function createJob(meta = {}) {
  const id = meta.id || crypto.randomUUID()
  const stepDefinitions = meta.stepDefinitions || STEP_DEFINITIONS
  const job = {
    id,
    status: 'queued',
    message: 'Đang chờ xử lý.',
    currentStep: null,
    steps: buildSteps(stepDefinitions, null),
    stepDefinitions,
    inputMode: meta.inputMode || 'audio',
    sourceAudio: meta.sourceAudio || null,
    sourceText: meta.sourceText || null,
    result: null,
    error: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }

  jobs.set(id, job)
  persistJob(job)
  return cloneJob(job)
}

function updateJobStep(jobId, stepKey, message) {
  const job = jobs.get(jobId)
  if (!job) {
    return null
  }

  const stepDefinitions = job.stepDefinitions || STEP_DEFINITIONS

  job.status = 'running'
  job.currentStep = stepKey
  job.message =
    message ||
    stepDefinitions.find((step) => step.key === stepKey)?.description ||
    'Đang xử lý.'
  job.steps = buildSteps(stepDefinitions, stepKey)
  job.updatedAt = new Date().toISOString()
  persistJob(job)
  return cloneJob(job)
}

function completeJob(jobId, result) {
  const job = jobs.get(jobId)
  if (!job) {
    return null
  }

  const stepDefinitions = job.stepDefinitions || STEP_DEFINITIONS
  const finalStepKey = stepDefinitions[stepDefinitions.length - 1]?.key || null

  job.status = 'completed'
  job.currentStep = 'completed'
  job.message = 'Đã hoàn tất toàn bộ pipeline.'
  job.steps = buildSteps(stepDefinitions, finalStepKey, 'completed')
  job.result = result
  job.error = null
  job.updatedAt = new Date().toISOString()
  persistJob(job)
  return cloneJob(job)
}

function failJob(jobId, error, stepKey) {
  const job = jobs.get(jobId)
  if (!job) {
    return null
  }

  const stepDefinitions = job.stepDefinitions || STEP_DEFINITIONS
  const failedStepKey = stepKey || job.currentStep
  job.status = 'failed'
  job.currentStep = failedStepKey
  job.message = error.message || 'Pipeline thất bại.'
  job.steps = buildSteps(
    stepDefinitions,
    failedStepKey,
    'failed',
    failedStepKey
  )
  job.error = {
    message: error.message || 'Pipeline thất bại.'
  }
  job.updatedAt = new Date().toISOString()
  persistJob(job)
  return cloneJob(job)
}

function getJob(jobId) {
  const job = jobs.get(jobId) || loadPersistedJob(jobId)
  return job ? cloneJob(job) : null
}

module.exports = {
  createJob,
  updateJobStep,
  completeJob,
  failJob,
  getJob,
  STEP_DEFINITIONS,
  MESSAGE_STEP_DEFINITIONS
}
