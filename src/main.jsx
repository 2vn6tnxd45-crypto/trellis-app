// src/main.jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import * as Sentry from '@sentry/react'
import App from './App.jsx'
import './styles/krib-theme.css'

// Initialize Sentry error monitoring (only in production)
if (import.meta.env.PROD) {
  Sentry.init({
    dsn: "https://0f4bf681b7c55446147eae48742faf73@o4510604408127488.ingest.us.sentry.io/4510604411928576",
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
