import { useState } from 'react'
import Alert from './Alert.jsx'

function Field({ id, label, ...props }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} {...props} />
    </div>
  )
}

function DemoEntry({ onDemo, notice }) {
  const [busy, setBusy] = useState(false)
  return (
    <div className="auth-card">
      <h1>TaskFlow</h1>
      <p className="muted">Secure serverless task management</p>
      <Alert kind="info" message={notice} />
      <div className="demo-banner" role="note">
        <strong>Demo mode</strong> - runs entirely in your browser with a fake demo user. No account,
        no AWS, no real credentials.
      </div>
      <button
        type="button"
        className="btn btn-primary btn-block"
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          await onDemo()
        }}
      >
        Continue as demo user
      </button>
      <p className="muted small">Registration and login forms appear when the app is configured for AWS mode.</p>
    </div>
  )
}

export default function AuthPage({ auth, demoMode, onSignedIn, notice }) {
  const [view, setView] = useState('login') // login | register | confirm
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)

  if (demoMode) return <main className="auth-page"><DemoEntry onDemo={async () => onSignedIn(await auth.signInAsDemo())} notice={notice} /></main>

  async function run(fn) {
    setBusy(true)
    setError('')
    setInfo('')
    try {
      await fn()
    } catch (e) {
      setError(e.message)
      if (e.code === 'UserNotConfirmed') setView('confirm')
    } finally {
      setBusy(false)
    }
  }

  const go = (v) => {
    setView(v)
    setError('')
    setInfo('')
  }

  const login = (e) => {
    e.preventDefault()
    run(async () => onSignedIn(await auth.signIn(email.trim(), password)))
  }

  const register = (e) => {
    e.preventDefault()
    run(async () => {
      await auth.signUp(email.trim(), password)
      setPassword('')
      setView('confirm')
      setInfo('We sent a verification code to your email.')
    })
  }

  const confirm = (e) => {
    e.preventDefault()
    run(async () => {
      await auth.confirmSignUp(email.trim(), code.trim())
      setCode('')
      setView('login')
      setInfo('Email confirmed. You can now sign in.')
    })
  }

  const resend = () =>
    run(async () => {
      await auth.resendCode(email.trim())
      setInfo('A new code has been sent.')
    })

  return (
    <main className="auth-page">
      <div className="auth-card">
        <h1>TaskFlow</h1>
        <h2>{view === 'login' ? 'Sign in' : view === 'register' ? 'Create account' : 'Confirm your email'}</h2>
        <Alert kind="info" message={notice} />
        <Alert kind="info" message={info} />
        <Alert message={error} />

        {view === 'login' && (
          <form onSubmit={login}>
            <Field id="email" label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            <Field id="password" label="Password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            <button type="submit" className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
            <p className="muted small">
              No account? <button type="button" className="btn-link" onClick={() => go('register')}>Create one</button>
            </p>
          </form>
        )}

        {view === 'register' && (
          <form onSubmit={register}>
            <Field id="email" label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            <Field id="new-password" label="Password" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} />
            <p className="muted small">At least 8 characters, with upper-case, lower-case and a number.</p>
            <button type="submit" className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Creating…' : 'Create account'}</button>
            <p className="muted small">
              Already registered? <button type="button" className="btn-link" onClick={() => go('login')}>Sign in</button>
            </p>
          </form>
        )}

        {view === 'confirm' && (
          <form onSubmit={confirm}>
            <Field id="email" label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            <Field id="code" label="Verification code" inputMode="numeric" autoComplete="one-time-code" required value={code} onChange={(e) => setCode(e.target.value)} />
            <button type="submit" className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Confirming…' : 'Confirm'}</button>
            <p className="muted small">
              <button type="button" className="btn-link" onClick={resend} disabled={busy || !email}>Resend code</button>
              {' · '}
              <button type="button" className="btn-link" onClick={() => go('login')}>Back to sign in</button>
            </p>
          </form>
        )}
      </div>
    </main>
  )
}
