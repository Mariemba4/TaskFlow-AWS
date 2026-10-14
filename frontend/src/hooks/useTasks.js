import { useCallback, useEffect, useState } from 'react'

/** Task state + actions on top of the tasks service (demo or AWS - the hook doesn't know). */
export function useTasks(api) {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setTasks(await api.list())
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [api])

  useEffect(() => {
    load()
  }, [load])

  // Runs a mutation; resolves true on success. A 404 means the task vanished, so resync the list.
  const mutate = useCallback(
    async (fn) => {
      setError('')
      try {
        await fn()
        return true
      } catch (e) {
        setError(e.message)
        if (e.status === 404) {
          try {
            setTasks(await api.list())
          } catch {
            /* keep the original error */
          }
        }
        return false
      }
    },
    [api],
  )

  const addTask = (title) =>
    mutate(async () => {
      const task = await api.create(title)
      setTasks((prev) => [task, ...prev])
    })

  const updateTask = (taskId, patch) =>
    mutate(async () => {
      const task = await api.update(taskId, patch)
      setTasks((prev) => prev.map((t) => (t.taskId === taskId ? task : t)))
    })

  const deleteTask = (taskId) =>
    mutate(async () => {
      await api.remove(taskId)
      setTasks((prev) => prev.filter((t) => t.taskId !== taskId))
    })

  return { tasks, loading, error, clearError: () => setError(''), reload: load, addTask, updateTask, deleteTask }
}
