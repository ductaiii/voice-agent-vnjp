const fs = require('fs')
const path = require('path')
const dotenv = require('dotenv')

function loadEnvFile() {
  const repoRoot = path.resolve(__dirname, '..', '..', '..')
  const envPath = path.join(repoRoot, '.env')

  if (!fs.existsSync(envPath)) {
    return null
  }

  const result = dotenv.config({ path: envPath, override: true })
  if (result.error) {
    console.error(`Error loading ${envPath}:`, result.error.message)
    return null
  }

  return envPath
}

module.exports = {
  loadEnvFile
}
