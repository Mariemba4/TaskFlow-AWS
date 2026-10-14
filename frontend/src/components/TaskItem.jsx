import { useState } from 'react'
import { MAX_TITLE_LENGTH, STATUSES, STATUS_LABELS } from '../services/constants.js'
import StatusBadge from './StatusBadge.jsx'

export default function TaskItem({ task, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [title, setTitle] = useState(task.title)
  const [status, setStatus] = useState(task.status)
  const [busy, setBusy] = useState(false)

  async function run(fn) {
    setBusy(true)
    const ok = await fn()
    setBusy(false)
    return ok
  }

  async function save(e) {
    e.preventDefault()
    if (!title.trim()) return
    const patch = {}
    if (title.trim() !== task.title) patch.title = title.trim()
    if (status !== task.status) patch.status = status
    if (Object.keys(patch).length === 0) return setEditing(false)
    if (await run(() => onUpdate(task.taskId, patch))) setEditing(false)
  }

  function startEdit() {
    setTitle(task.title)
    setStatus(task.status)
    setEditing(true)
  }

  if (editing) {
    return (
      <li className="task">
        <form className="task-edit" onSubmit={save}>
          <label className="sr-only" htmlFor={`title-${task.taskId}`}>Task title</label>
          <input
            id={`title-${task.taskId}`}
            value={title}
            maxLength={MAX_TITLE_LENGTH}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
          <label className="sr-only" htmlFor={`status-${task.taskId}`}>Task status</label>
          <select id={`status-${task.taskId}`} value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
          <div className="task-actions">
            <button type="submit" className="btn btn-primary" disabled={busy || !title.trim()}>Save</button>
            <button type="button" className="btn" onClick={() => setEditing(false)} disabled={busy}>Cancel</button>
          </div>
        </form>
      </li>
    )
  }

  const done = task.status === 'done'
  return (
    <li className={`task${done ? ' task-done' : ''}`}>
      <div className="task-main">
        <span className="task-title">{task.title}</span>
        <StatusBadge status={task.status} />
      </div>
      <div className="task-actions">
        {confirmingDelete ? (
          <>
            <span className="muted">Delete this task?</span>
            <button
              type="button"
              className="btn btn-danger"
              disabled={busy}
              onClick={async () => {
                if (!(await run(() => onDelete(task.taskId)))) setConfirmingDelete(false)
              }}
            >
              Confirm delete
            </button>
            <button type="button" className="btn" onClick={() => setConfirmingDelete(false)} disabled={busy}>
              Cancel
            </button>
          </>
        ) : (
          <>
            {!done && (
              <button
                type="button"
                className="btn"
                disabled={busy}
                aria-label={`Mark "${task.title}" as done`}
                onClick={() => run(() => onUpdate(task.taskId, { status: 'done' }))}
              >
                Complete
              </button>
            )}
            <button type="button" className="btn" disabled={busy} onClick={startEdit} aria-label={`Edit "${task.title}"`}>
              Edit
            </button>
            <button
              type="button"
              className="btn btn-danger-outline"
              disabled={busy}
              onClick={() => setConfirmingDelete(true)}
              aria-label={`Delete "${task.title}"`}
            >
              Delete
            </button>
          </>
        )}
      </div>
    </li>
  )
}
