// Chooses ONE backend implementation at startup. The two modes share an interface but no code
// path: demo services never receive a URL or token, so they cannot reach AWS.
import { createApiClient } from './apiClient.js'
import { createCognitoAuth } from './cognitoAuth.js'
import { createDemoAuth, createDemoTasks } from './demo.js'

export function createServices(config) {
  if (config.demoMode) {
    return { demoMode: true, auth: createDemoAuth(), tasks: createDemoTasks() }
  }
  if (config.missing.length) {
    throw new Error(`Missing configuration: ${config.missing.join(', ')}`)
  }
  const auth = createCognitoAuth({ userPoolId: config.userPoolId, clientId: config.clientId })
  const tasks = createApiClient({
    baseUrl: config.apiUrl,
    getToken: () => auth.getIdToken(),
    onUnauthorized: () => services.onUnauthorized?.(),
  })
  const services = { demoMode: false, auth, tasks, onUnauthorized: null }
  return services
}
