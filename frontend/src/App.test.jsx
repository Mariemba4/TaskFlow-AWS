import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import App from './App.jsx'
import { loadConfig } from './config.js'
import { createServices } from './services/index.js'

const demoServices = () => createServices(loadConfig({ VITE_DEMO_MODE: 'true' }))

async function enterDemo(user) {
  render(<App services={demoServices()} />)
  await user.click(await screen.findByRole('button', { name: /continue as demo user/i }))
  await screen.findByRole('heading', { name: /your tasks/i })
}

describe('App (demo mode)', () => {
  it('labels demo mode and shows the empty state', async () => {
    const user = userEvent.setup()
    await enterDemo(user)
    expect(screen.getByText(/demo mode/i)).toBeInTheDocument()
    expect(screen.getByText(/no tasks yet/i)).toBeInTheDocument()
  })

  it('creates, completes, edits and deletes a task', async () => {
    const user = userEvent.setup()
    await enterDemo(user)

    await user.type(screen.getByLabelText(/new task title/i), 'Write report')
    await user.click(screen.getByRole('button', { name: /add task/i }))
    const item = (await screen.findByText('Write report')).closest('li')
    expect(within(item).getByText('To do')).toBeInTheDocument()

    await user.click(within(item).getByRole('button', { name: /mark "write report" as done/i }))
    await waitFor(() => expect(within(item).getByText('Done')).toBeInTheDocument())

    await user.click(within(item).getByRole('button', { name: /edit "write report"/i }))
    const input = within(item).getByLabelText(/task title/i)
    await user.clear(input)
    await user.type(input, 'Write final report')
    await user.click(within(item).getByRole('button', { name: /save/i }))
    expect(await screen.findByText('Write final report')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /delete "write final report"/i }))
    await user.click(screen.getByRole('button', { name: /confirm delete/i }))
    await waitFor(() => expect(screen.queryByText('Write final report')).not.toBeInTheDocument())
    expect(screen.getByText(/no tasks yet/i)).toBeInTheDocument()
  })

  it('does not submit an empty title', async () => {
    const user = userEvent.setup()
    await enterDemo(user)
    expect(screen.getByRole('button', { name: /add task/i })).toBeDisabled()
  })

  it('persists across reload and signs out', async () => {
    const user = userEvent.setup()
    await enterDemo(user)
    await user.type(screen.getByLabelText(/new task title/i), 'Persisted')
    await user.click(screen.getByRole('button', { name: /add task/i }))
    await screen.findByText('Persisted')
    document.body.innerHTML = ''

    render(<App services={demoServices()} />)
    expect(await screen.findByText('Persisted')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /sign out/i }))
    expect(await screen.findByRole('button', { name: /continue as demo user/i })).toBeInTheDocument()
  })
})

describe('App error handling', () => {
  function awsLikeServices(tasks) {
    return {
      demoMode: false,
      auth: {
        getCurrentUser: async () => ({ email: 'user@example.test' }),
        signOut: vi.fn(),
      },
      tasks,
    }
  }

  it('shows an error message when loading fails', async () => {
    const tasks = { list: vi.fn().mockRejectedValue(Object.assign(new Error('Something went wrong on the server.'), { status: 500 })) }
    render(<App services={awsLikeServices(tasks)} />)
    expect(await screen.findByRole('alert')).toHaveTextContent(/something went wrong/i)
    expect(screen.queryByText(/demo mode/i)).not.toBeInTheDocument()
  })

  it('returns to sign-in with a notice when the session expires', async () => {
    const services = awsLikeServices({ list: vi.fn() })
    services.auth.signIn = vi.fn()
    services.tasks.list.mockImplementation(async () => {
      services.onUnauthorized()
      throw Object.assign(new Error('Your session has expired.'), { status: 401 })
    })
    render(<App services={services} />)
    expect(await screen.findByRole('heading', { name: /sign in/i })).toBeInTheDocument()
    expect(screen.getByText(/session has expired/i)).toBeInTheDocument()
    expect(services.auth.signOut).toHaveBeenCalled()
  })
})

describe('AWS-mode auth forms', () => {
  it('renders accessible login fields and can switch to register', async () => {
    const user = userEvent.setup()
    const services = { demoMode: false, auth: { getCurrentUser: async () => null }, tasks: {} }
    render(<App services={services} />)
    expect(await screen.findByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /create one/i }))
    expect(screen.getByRole('heading', { name: /create account/i })).toBeInTheDocument()
  })
})
