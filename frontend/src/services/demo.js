// Local demo mode. NO network access and NO AWS: this module must never import apiClient or the
// Cognito SDK. Data lives in localStorage under a dedicated key prefix, separate from real data.
// Only non-sensitive sample tasks are stored - never tokens or credentials.
import { ApiError, validateStatus, validateTitle } from './constants.js'

export const DEMO_USER = { email: 'demo@taskflow.local' }
const TASKS_KEY = 'taskflow-demo:tasks'
const SESSION_KEY = 'taskflow-demo:signed-in'

function read(storage) {
  try {
    const parsed = JSON.parse(storage.getItem(TASKS_KEY))
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function write(storage, tasks) {
  try {
    storage.setItem(TASKS_KEY, JSON.stringify(tasks))
  } catch {
    throw new ApiError(500, 'Demo storage is unavailable in this browser.')
  }
}

const nowIso = () => new Date().toISOString()
const newId = () => globalThis.crypto?.randomUUID?.() ?? `demo-${Date.now()}-${Math.random().toString(16).slice(2)}`

export function createDemoAuth(storage = globalThis.localStorage) {
  return {
    mode: 'demo',
    async getCurrentUser() {
      return storage.getItem(SESSION_KEY) === '1' ? DEMO_USER : null
    },
    async signInAsDemo() {
      storage.setItem(SESSION_KEY, '1')
      return DEMO_USER
    },
    async signOut() {
      storage.removeItem(SESSION_KEY)
    },
  }
}

export function createDemoTasks(storage = globalThis.localStorage) {
  return {
    async list() {
      return read(storage).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    },
    async create(title, status = 'todo') {
      const now = nowIso()
      const task = {
        userId: 'demo-user',
        taskId: newId(),
        title: validateTitle(title),
        status: validateStatus(status),
        createdAt: now,
        updatedAt: now,
      }
      write(storage, [...read(storage), task])
      return task
    },
    async update(taskId, patch) {
      const tasks = read(storage)
      const idx = tasks.findIndex((t) => t.taskId === taskId)
      if (idx === -1) throw new ApiError(404, 'Task not found. It may have been deleted.')
      if (!('title' in patch) && !('status' in patch)) throw new ApiError(400, 'Nothing to update.')
      const updated = {
        ...tasks[idx],
        ...('title' in patch && { title: validateTitle(patch.title) }),
        ...('status' in patch && { status: validateStatus(patch.status) }),
        updatedAt: nowIso(),
      }
      tasks[idx] = updated
      write(storage, tasks)
      return updated
    },
    async remove(taskId) {
      const tasks = read(storage)
      if (!tasks.some((t) => t.taskId === taskId)) {
        throw new ApiError(404, 'Task not found. It may have been deleted.')
      }
      write(storage, tasks.filter((t) => t.taskId !== taskId))
    },
  }
}
