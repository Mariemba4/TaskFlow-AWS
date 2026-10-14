import { useEffect, useState } from 'react'
import AuthPage from './components/AuthPage.jsx'
import Dashboard from './components/Dashboard.jsx'

// `services` = { demoMode, auth, tasks } from createServices(); injected so tests can swap it.
export default function App({ services }) {
  const [user, setUser] = useState(undefined) // undefined = checking session, null = signed out
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let active = true
    services.auth.getCurrentUser().then((u) => active && setUser(u))
    // Backend returned 401: the session is no longer valid.
    services.onUnauthorized = () => {
      services.auth.signOut()
      setNotice('Your session has expired. Please sign in again.')
      setUser(null)
    }
    return () => {
      active = false
      services.onUnauthorized = null
    }
  }, [services])

  if (user === undefined) return <p className="state" role="status">Loading…</p>

  if (!user) {
    return (
      <AuthPage
        auth={services.auth}
        demoMode={services.demoMode}
        notice={notice}
        onSignedIn={(u) => {
          setNotice('')
          setUser(u)
        }}
      />
    )
  }

  return (
    <Dashboard
      user={user}
      tasksApi={services.tasks}
      demoMode={services.demoMode}
      onSignOut={async () => {
        await services.auth.signOut()
        setNotice('')
        setUser(null)
      }}
    />
  )
}
