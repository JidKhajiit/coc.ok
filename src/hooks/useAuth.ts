import { useCallback, useEffect, useState } from 'react'
import * as api from '../api/client'
import type { AuthUser } from '../api/client'

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'

export function useAuth() {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [user, setUser] = useState<AuthUser | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const me = await api.getMe()
      setUser(me)
      setStatus(me ? 'authenticated' : 'unauthenticated')
      setError(null)
      return me
    } catch (err) {
      setUser(null)
      setStatus('unauthenticated')
      setError(err instanceof Error ? err.message : 'Failed to check session')
      return null
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const login = useCallback(async (loginValue: string, password: string) => {
    setError(null)
    setInfo(null)
    try {
      const loggedIn = await api.login(loginValue, password)
      setUser(loggedIn)
      setStatus('authenticated')
      return loggedIn
    } catch (err) {
      const message = err instanceof api.ApiError ? err.message : 'Login failed'
      setError(message)
      throw err
    }
  }, [])

  const register = useCallback(async (username: string, email: string, password: string) => {
    setError(null)
    setInfo(null)
    try {
      const result = await api.register(username, email, password)
      setInfo(result.message)
      return result
    } catch (err) {
      const message = err instanceof api.ApiError ? err.message : 'Registration failed'
      setError(message)
      throw err
    }
  }, [])

  const forgotPassword = useCallback(async (email: string) => {
    setError(null)
    setInfo(null)
    try {
      const result = await api.forgotPassword(email)
      setInfo(result.message)
      return result
    } catch (err) {
      const message = err instanceof api.ApiError ? err.message : 'Request failed'
      setError(message)
      throw err
    }
  }, [])

  const resendVerification = useCallback(async (email: string) => {
    setError(null)
    try {
      const result = await api.resendVerification(email)
      setInfo(result.message)
      return result
    } catch (err) {
      const message = err instanceof api.ApiError ? err.message : 'Request failed'
      setError(message)
      throw err
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      await api.logout()
    } finally {
      setUser(null)
      setStatus('unauthenticated')
    }
  }, [])

  return {
    status,
    user,
    error,
    info,
    login,
    register,
    forgotPassword,
    resendVerification,
    logout,
    refresh,
    setError,
    setInfo,
  }
}
