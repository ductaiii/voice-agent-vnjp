import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

function syncViewportMetrics() {
  const rootStyle = document.documentElement.style
  const visualViewport = window.visualViewport

  if (!visualViewport) {
    rootStyle.setProperty('--app-viewport-height', '100dvh')
    rootStyle.setProperty('--viewport-bottom-offset', '18px')
    rootStyle.setProperty('--viewport-top-offset', '0px')
    return () => {}
  }

  let frameId = 0

  const updateViewportMetrics = () => {
    frameId = 0

    const topInset = Math.max(0, visualViewport.offsetTop)
    const bottomInset = Math.max(
      0,
      window.innerHeight - visualViewport.height - visualViewport.offsetTop
    )

    rootStyle.setProperty('--app-viewport-height', `${visualViewport.height}px`)
    rootStyle.setProperty('--viewport-top-offset', `${topInset}px`)
    rootStyle.setProperty(
      '--viewport-bottom-offset',
      `${Math.max(18, bottomInset + 18)}px`
    )
  }

  const queueUpdate = () => {
    if (frameId) {
      return
    }

    frameId = window.requestAnimationFrame(updateViewportMetrics)
  }

  queueUpdate()

  visualViewport.addEventListener('resize', queueUpdate)
  visualViewport.addEventListener('scroll', queueUpdate)
  window.addEventListener('resize', queueUpdate)
  window.addEventListener('orientationchange', queueUpdate)

  return () => {
    if (frameId) {
      window.cancelAnimationFrame(frameId)
    }

    visualViewport.removeEventListener('resize', queueUpdate)
    visualViewport.removeEventListener('scroll', queueUpdate)
    window.removeEventListener('resize', queueUpdate)
    window.removeEventListener('orientationchange', queueUpdate)
  }
}

syncViewportMetrics()

createRoot(document.getElementById('root')).render(<App />)
