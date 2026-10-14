import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadConfig } from '../config.js'
import { createDemoTasks } from './demo.js'
import { createServices } from './index.js'

afterEach(() => vi.unstubAllGlobals())

describe('demo task store', () => {
  it('supports full CRUD', async () => {
    const api = createDemoTasks()
    const t = await api.create('  Buy milk ')
    expect(t).toMatchObject({ title: 'Buy milk', status: 'todo' })
    expect(await api.list()).toHaveLength(1)
    const u = await api.update(t.taskId, { status: 'done' })
    expect(u.status).toBe('done')
    await api.remove(t.taskId)
    expect(await api.list()).toEqual([])
  })

  it('validates like the backend', async () => {
    const api = createDemoTasks()
    await expect(api.create('')).rejects.toMatchObject({ status: 400 })
    await expect(api.create('x'.repeat(201))).rejects.toMatchObject({ status: 400 })
    await expect(api.create('ok', 'bogus')).rejects.toMatchObject({ status: 400 })
    await expect(api.update('nope', { status: 'done' })).rejects.toMatchObject({ status: 404 })
    await expect(api.remove('nope')).rejects.toMatchObject({ status: 404 })
  })

  it('uses an isolated storage namespace', async () => {
    localStorage.setItem('some-real-app-key', 'keep')
    await createDemoTasks().create('x')
    expect(localStorage.getItem('some-real-app-key')).toBe('keep')
    expect(Object.keys(localStorage).filter((k) => k !== 'some-real-app-key').every((k) => k.startsWith('taskflow-demo:'))).toBe(true)
  })

  it('survives corrupted storage', async () => {
    localStorage.setItem('taskflow-demo:tasks', '{broken')
    expect(await createDemoTasks().list()).toEqual([])
  })
})

describe('mode selection', () => {
  it('defaults to demo when nothing is configured', () => {
    expect(loadConfig({}).demoMode).toBe(true)
    expect(loadConfig({ VITE_DEMO_MODE: 'true' }).demoMode).toBe(true)
  })

  it('AWS mode reports missing variables and never falls back to demo', () => {
    const cfg = loadConfig({ VITE_DEMO_MODE: 'false' })
    expect(cfg.demoMode).toBe(false)
    expect(cfg.missing).toHaveLength(4)
    expect(() => createServices(cfg)).toThrow(/Missing configuration/)
  })

  it('demo services never call fetch', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const { auth, tasks } = createServices(loadConfig({ VITE_DEMO_MODE: 'true', VITE_API_URL: 'https://real.example/dev' }))
    await auth.signInAsDemo()
    await tasks.create('x')
    await tasks.list()
    await auth.signOut()
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
