// Reusable REST client for the TaskFlow API (API Gateway + Cognito authorizer).
// Pure JS, no React. The ID token is read per request and never logged or stored here.
import { ApiError } from './constants.js'

const FALLBACK_MESSAGES = {
  400: 'The request was invalid.',
  401: 'Your session has expired. Please sign in again.',
  403: 'You are not allowed to do that.',
  404: 'Task not found. It may have been deleted.',
  429: 'Too many requests. Please slow down and try again.',
}

function messageFor(status, serverMessage) {
  if (status >= 500) return 'Something went wrong on the server. Please try again later.'
  // 400 carries useful validation text from the backend; other codes use friendly wording.
  if (status === 400 && serverMessage) return serverMessage
  return FALLBACK_MESSAGES[status] ?? 'Unexpected error.'
}

/**
 * @param {object} opts
 * @param {string} opts.baseUrl  API base URL including stage, e.g. https://id.execute-api.region.amazonaws.com/dev
 * @param {() => Promise<string>} opts.getToken  returns the Cognito ID token
 * @param {() => void} [opts.onUnauthorized]  called on 401 so the app can sign the user out
 * @param {typeof fetch} [opts.fetchImpl]
 */
export function createApiClient({ baseUrl, getToken, onUnauthorized, fetchImpl }) {
  const doFetch = fetchImpl ?? ((...args) => fetch(...args))

  async function request(method, path, body) {
    let token
    try {
      token = await getToken()
    } catch {
      onUnauthorized?.()
      throw new ApiError(401, FALLBACK_MESSAGES[401])
    }

    let res
    try {
      res = await doFetch(`${baseUrl}${path}`, {
        method,
        headers: {
          Authorization: token, // ID token, as required by the REST API Cognito authorizer
          ...(body !== undefined && { 'Content-Type': 'application/json' }),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      })
    } catch {
      throw new ApiError(0, 'Network error. Check your connection and try again.')
    }

    if (res.status === 204) return null

    let data = null
    try {
      data = await res.json()
    } catch {
      /* non-JSON body */
    }

    if (!res.ok) {
      if (res.status === 401) onUnauthorized?.()
      throw new ApiError(res.status, messageFor(res.status, data?.message))
    }
    return data
  }

  return {
    async list() {
      const data = await request('GET', '/tasks')
      return data?.tasks ?? []
    },
    create: (title, status) => request('POST', '/tasks', { title, ...(status && { status }) }),
    update: (taskId, patch) => request('PUT', `/tasks/${encodeURIComponent(taskId)}`, patch),
    async remove(taskId) {
      await request('DELETE', `/tasks/${encodeURIComponent(taskId)}`)
    },
  }
}
