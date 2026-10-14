// Runtime configuration from Vite env vars. All values are PUBLIC identifiers (no secrets).
//
// Safe default: demo mode is ON unless VITE_DEMO_MODE is explicitly "false".
// AWS mode with missing variables is a configuration error - it never falls back to demo
// (and demo never falls back to AWS).

export const AWS_REQUIRED_VARS = [
  'VITE_API_URL',
  'VITE_COGNITO_USER_POOL_ID',
  'VITE_COGNITO_CLIENT_ID',
  'VITE_AWS_REGION',
]

export function loadConfig(env = import.meta.env) {
  const demoMode = String(env.VITE_DEMO_MODE ?? 'true').trim().toLowerCase() !== 'false'

  if (demoMode) {
    return { demoMode: true, missing: [] }
  }

  const missing = AWS_REQUIRED_VARS.filter((name) => !String(env[name] ?? '').trim())
  return {
    demoMode: false,
    missing,
    apiUrl: String(env.VITE_API_URL ?? '').trim().replace(/\/+$/, ''),
    userPoolId: String(env.VITE_COGNITO_USER_POOL_ID ?? '').trim(),
    clientId: String(env.VITE_COGNITO_CLIENT_ID ?? '').trim(),
    region: String(env.VITE_AWS_REGION ?? '').trim(),
  }
}
