import { useCallback, useEffect, useState } from 'react'
import * as api from '../api/client'
import type { AuthUser, DeviceAccount } from '../api/client'
import { useCookieConsent } from './useCookieConsent'

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'

function applySession(
  payload: api.AuthSessionPayload,
  setUser: (u: AuthUser | null) => void,
  setAccounts: (a: DeviceAccount[]) => void,
  setStatus: (s: AuthStatus) => void,
) {
  setUser(payload.user)
  setAccounts(payload.accounts)
  setStatus(payload.user ? 'authenticated' : 'unauthenticated')
}

export function useAuth() {
  const { accepted: cookieConsent } = useCookieConsent()
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [user, setUser] = useState<AuthUser | null>(null)
  const [accounts, setAccounts] = useState<DeviceAccount[]>([])
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!cookieConsent) {
      setUser(null)
      setAccounts([])
      setStatus('unauthenticated')
      return null
    }
    try {
      const payload = await api.getMe()
      applySession(payload, setUser, setAccounts, setStatus)
      setError(null)
      return payload.user
    } catch (err) {
      setUser(null)
      setAccounts([])
      setStatus('unauthenticated')
      setError(err instanceof Error ? err.message : 'Failed to check session')
      return null
    }
  }, [cookieConsent])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const login = useCallback(
    async (loginValue: string, password: string) => {
      setError(null)
      setInfo(null)
      if (!cookieConsent) {
        const message = 'Cookie consent is required before signing in'
        setError(message)
        throw new Error(message)
      }
      try {
        const payload = await api.login(loginValue, password)
        applySession(payload, setUser, setAccounts, setStatus)
        return payload.user!
      } catch (err) {
        const message = err instanceof api.ApiError ? err.message : 'Login failed'
        setError(message)
        throw err
      }
    },
    [cookieConsent],
  )

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

  const uploadAvatar = useCallback(async (file: File) => {
    setError(null)
    try {
      const payload = await api.uploadAvatar(file)
      applySession(payload, setUser, setAccounts, setStatus)
      return payload.user!
    } catch (err) {
      const message = err instanceof api.ApiError ? err.message : 'Failed to upload avatar'
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
      const payload = await api.logout()
      applySession(payload, setUser, setAccounts, setStatus)
      return payload
    } catch {
      setUser(null)
      setAccounts([])
      setStatus('unauthenticated')
      return { user: null, accounts: [] as DeviceAccount[] }
    }
  }, [])

  const switchAccount = useCallback(async (userId: string) => {
    setError(null)
    try {
      const payload = await api.switchAccount(userId)
      applySession(payload, setUser, setAccounts, setStatus)
      return payload.user!
    } catch (err) {
      const message = err instanceof api.ApiError ? err.message : 'Switch failed'
      setError(message)
      throw err
    }
  }, [])

  const removeAccount = useCallback(async (userId: string) => {
    setError(null)
    try {
      const payload = await api.removeDeviceAccount(userId)
      applySession(payload, setUser, setAccounts, setStatus)
      return payload
    } catch (err) {
      const message = err instanceof api.ApiError ? err.message : 'Remove failed'
      setError(message)
      throw err
    }
  }, [])

  const patchActiveProfileId = useCallback((activeProfileId: string | null) => {
    setUser((prev) => (prev ? { ...prev, activeProfileId } : prev))
  }, [])

  return {
    status,
    user,
    accounts,
    error,
    info,
    cookieConsent,
    login,
    register,
    uploadAvatar,
    forgotPassword,
    resendVerification,
    logout,
    switchAccount,
    removeAccount,
    refresh,
    setError,
    setInfo,
    patchActiveProfileId,
  }
}
