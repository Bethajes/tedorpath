import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from './app/App'
import { AuthProvider } from './features/auth/AuthProvider'
import './index.css'

const container = document.getElementById('root')

if (!container) {
  throw new Error('Root element #root was not found in index.html')
}

createRoot(container).render(
  <StrictMode>
    {/* Above the router so every page — the header included — can see who is
        signed in, and so the session is resolved once on startup. */}
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
)
