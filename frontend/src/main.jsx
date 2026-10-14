import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { loadConfig } from './config.js'
import { createServices } from './services/index.js'
import './index.css'

const config = loadConfig()
const root = ReactDOM.createRoot(document.getElementById('root'))

if (!config.demoMode && config.missing.length) {
  root.render(
    <main className="auth-page">
      <div className="auth-card">
        <h1>Configuration required</h1>
        <p>AWS mode is enabled but these variables are missing from <code>frontend/.env.local</code>:</p>
        <ul>{config.missing.map((name) => <li key={name}><code>{name}</code></li>)}</ul>
        <p className="muted">Set them from the SAM stack outputs, or set <code>VITE_DEMO_MODE=true</code> for the local demo.</p>
      </div>
    </main>,
  )
} else {
  root.render(
    <React.StrictMode>
      <App services={createServices(config)} />
    </React.StrictMode>,
  )
}
