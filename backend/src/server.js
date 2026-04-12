const { createApp } = require('./app')
const { loadEnvFile } = require('./bootstrap/loadEnvFile')
const { loadEnv, getMissingConfig } = require('./config/env')

const loadedEnvFile = loadEnvFile()
if (loadedEnvFile) {
  console.log(`Loaded environment file: ${loadedEnvFile}`)
} else {
  console.warn('No root environment file found in repository (.env)')
}

const env = loadEnv()
const app = createApp(env)

app.listen(env.port, () => {
  const missingConfig = getMissingConfig(env)
  console.log(
    `Speech-to-speech backend listening on http://localhost:${env.port}`
  )

  if (missingConfig.length > 0) {
    console.log(`Missing environment variables: ${missingConfig.join(', ')}`)
  }
})
