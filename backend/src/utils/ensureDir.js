const fs = require('fs')

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true })
  return dirPath
}

module.exports = {
  ensureDir
}
