// Mirrors the backend validation rules (backend/src/common/validation.py).
export const STATUSES = ['todo', 'in_progress', 'done']
export const STATUS_LABELS = { todo: 'To do', in_progress: 'In progress', done: 'Done' }
export const MAX_TITLE_LENGTH = 200

export class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

/** Client-side check shared by the demo store and the forms. Returns the trimmed title. */
export function validateTitle(value) {
  const title = String(value ?? '').trim()
  if (!title) throw new ApiError(400, 'Title must not be empty.')
  if (title.length > MAX_TITLE_LENGTH) {
    throw new ApiError(400, `Title must be at most ${MAX_TITLE_LENGTH} characters.`)
  }
  return title
}

export function validateStatus(value) {
  if (!STATUSES.includes(value)) throw new ApiError(400, 'Invalid status.')
  return value
}
