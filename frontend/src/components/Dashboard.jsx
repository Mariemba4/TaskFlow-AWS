import { useState } from 'react'
import { useTasks } from '../hooks/useTasks.js'
import { MAX_TITLE_LENGTH, STATUSES, STATUS_LABELS } from '../services/constants.js'
import Alert from './Alert.jsx'
import TaskItem from './TaskItem.jsx'

export default function Dashboard({ user, tasksApi, demoMode, onSignOut }) {
  const { tasks, loading, error, clearError, reload, addTask, updateTask, deleteTask } = useTasks(tasksApi)
  const [title, setTitle] = useState('')
  const [adding, setAdding] = useState(false)
  const [filter, setFilter] = useState('all')

  async function submit(e) {
    e.preventDefault()
    if (!title.trim()) return
    setAdding(true)
    if (await addTask(title)) setTitle('')
    setAdding(false)
  }

  const visible = filter === 'all' ? tasks : tasks.filter((t) => t.status === filter)
  const counts = Object.fromEntries(STATUSES.map((s) => [s, tasks.filter((t) => t.status === s).length]))

  return (
    <div className="app">
      <header className="topbar">
        <h1>TaskFlow</h1>
        <div className="topbar-right">
          <span className="muted user-email">{user.email}</span>
          <button type="button" className="btn" onClick={onSignOut}>Sign out</button>
        </div>
      </header>

      {demoMode && (
        <div className="demo-banner" role="note">
          <strong>Demo mode</strong> - sample data is stored only in this browser. No AWS services are used.
        </div>
      )}

      <main className="container">
        <section aria-label="Summary" className="stats">
          {STATUSES.map((s) => (
            <div key={s} className={`stat stat-${s}`}>
              <span className="stat-number">{counts[s]}</span>
              <span className="stat-label">{STATUS_LABELS[s]}</span>
            </div>
          ))}
        </section>

        <form className="add-form" onSubmit={submit}>
          <label htmlFor="new-task" className="sr-only">New task title</label>
          <input
            id="new-task"
            placeholder="What needs to be done?"
            value={title}
            maxLength={MAX_TITLE_LENGTH}
            onChange={(e) => setTitle(e.target.value)}
          />
          <button type="submit" className="btn btn-primary" disabled={adding || !title.trim()}>
            {adding ? 'Adding…' : 'Add task'}
          </button>
        </form>

        <Alert message={error} onDismiss={clearError} />

        <div className="list-header">
          <h2>Your tasks</h2>
          <div>
            <label htmlFor="filter" className="sr-only">Filter by status</label>
            <select id="filter" value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">All</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <p className="state" role="status">Loading tasks…</p>
        ) : tasks.length === 0 && error ? (
          <p className="state">
            Could not load tasks. <button type="button" className="btn-link" onClick={reload}>Try again</button>
          </p>
        ) : tasks.length === 0 ? (
          <p className="state">No tasks yet. Add your first task above.</p>
        ) : visible.length === 0 ? (
          <p className="state">No tasks with this status.</p>
        ) : (
          <ul className="tasks">
            {visible.map((t) => (
              <TaskItem key={t.taskId} task={t} onUpdate={updateTask} onDelete={deleteTask} />
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}
