const fs = require('fs')
const path = require('path')

function removeExpiredFiles(dirPath, maxAgeMs) {
  if (!dirPath || !fs.existsSync(dirPath)) {
    return 0
  }

  const now = Date.now()
  let removedCount = 0

  for (const entryName of fs.readdirSync(dirPath)) {
    const entryPath = path.join(dirPath, entryName)
    const entryStat = fs.statSync(entryPath)

    if (!entryStat.isFile()) {
      continue
    }

    if (now - entryStat.mtimeMs < maxAgeMs) {
      continue
    }

    fs.unlinkSync(entryPath)
    removedCount += 1
  }

  return removedCount
}

function startFileCleanupJob({ dirPath, maxAgeMs, intervalMs }) {
  if (!dirPath || !Number.isFinite(maxAgeMs) || maxAgeMs <= 0) {
    return null
  }

  removeExpiredFiles(dirPath, maxAgeMs)

  const timerId = setInterval(() => {
    try {
      removeExpiredFiles(dirPath, maxAgeMs)
    } catch (error) {
      console.warn(`TTS cleanup failed for ${dirPath}: ${error.message}`)
    }
  }, intervalMs)

  timerId.unref?.()
  return timerId
}

module.exports = {
  removeExpiredFiles,
  startFileCleanupJob
}