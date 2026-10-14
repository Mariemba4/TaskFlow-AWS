import { describe, expect, it, vi } from 'vitest'
import { createApiClient } from './apiClient.js'

const json = (status, body) => ({ ok: status < 400, status, json: async () => body })

function setup(response, extra = {}) {
  const fetchImpl = vi.fn().mockResolvedValue(response)
  const onUnauthorized = vi.fn()
  const client = createApiClient({
    baseUrl: 'https://api.example.test/dev',
    getToken: async () => 'ID_TOKEN',
    onUnauthorized,
    fetchImpl,
    ...extra,
  })
  return { client, fetchImpl, onUnauthorized }
}

describe('apiClient', () => {
  it('lists tasks with the ID token in the Authorization header', async () => {
    const { client, fetchImpl } = setup(json(200, { tasks: [{ taskId: '1' }] }))
    expect(await client.list()).toEqual([{ taskId: '1' }])
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('https://api.example.test/dev/tasks')
    expect(init.method).toBe('GET')
    expect(init.headers.Authorization).toBe('ID_TOKEN')
  })

  it('creates a task with a JSON body', async () => {
    const { client, fetchImpl } = setup(json(201, { taskId: 'a', title: 'x' }))
    await client.create('x')
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url.endsWith('/tasks')).toBe(true)
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual({ title: 'x' })
    expect(init.headers['Content-Type']).toBe('application/json')
  })

  it('updates with PUT and encodes the task id', async () => {
    const { client, fetchImpl } = setup(json(200, {}))
    await client.update('a/b', { status: 'done' })
    expect(fetchImpl.mock.calls[0][0]).toBe('https://api.example.test/dev/tasks/a%2Fb')
    expect(fetchImpl.mock.calls[0][1].method).toBe('PUT')
  })

  it('handles 204 on delete', async () => {
    const { client, fetchImpl } = setup({ ok: true, status: 204 })
    await expect(client.remove('a')).resolves.toBeUndefined()
    expect(fetchImpl.mock.calls[0][1].method).toBe('DELETE')
  })

  it('401 triggers onUnauthorized and a friendly error', async () => {
    const { client, onUnauthorized } = setup(json(401, { message: 'Unauthorized' }))
    await expect(client.list()).rejects.toMatchObject({ status: 401 })
    expect(onUnauthorized).toHaveBeenCalledOnce()
  })

  it('404 gives a friendly message', async () => {
    const { client } = setup(json(404, { message: 'Task not found' }))
    await expect(client.remove('a')).rejects.toMatchObject({ status: 404, message: expect.stringMatching(/not found/i) })
  })

  it('500 hides server details', async () => {
    const { client } = setup(json(500, { message: 'secret internals' }))
    const err = await client.list().catch((e) => e)
    expect(err.status).toBe(500)
    expect(err.message).not.toMatch(/secret/)
  })

  it('400 surfaces validation text', async () => {
    const { client } = setup(json(400, { message: 'title must not be empty' }))
    await expect(client.create('')).rejects.toMatchObject({ message: 'title must not be empty' })
  })

  it('network failure is reported', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('failed'))
    const client = createApiClient({ baseUrl: 'x', getToken: async () => 't', fetchImpl })
    await expect(client.list()).rejects.toMatchObject({ status: 0 })
  })

  it('missing session (no token) triggers onUnauthorized without calling fetch', async () => {
    const fetchImpl = vi.fn()
    const onUnauthorized = vi.fn()
    const client = createApiClient({
      baseUrl: 'x',
      getToken: async () => {
        throw new Error('no session')
      },
      onUnauthorized,
      fetchImpl,
    })
    await expect(client.list()).rejects.toMatchObject({ status: 401 })
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(onUnauthorized).toHaveBeenCalled()
  })

  it('never logs the token', async () => {
    const spies = ['log', 'info', 'warn', 'error', 'debug'].map((m) => vi.spyOn(console, m).mockImplementation(() => {}))
    const { client } = setup(json(500, {}))
    await client.list().catch(() => {})
    spies.forEach((s) => expect(s).not.toHaveBeenCalled())
    spies.forEach((s) => s.mockRestore())
  })
})
