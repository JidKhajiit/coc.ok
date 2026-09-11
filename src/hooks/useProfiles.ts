import { useCallback, useEffect, useState } from 'react'
import * as api from '../api/client'
import type { GameProfile, ProfileMember } from '../api/client'

export function useProfiles(enabled: boolean) {
  const [profiles, setProfiles] = useState<GameProfile[]>([])
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null)
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!enabled) {
      setProfiles([])
      setActiveProfileId(null)
      setLoading(false)
      return null
    }
    setLoading(true)
    setError(null)
    try {
      const data = await api.listProfiles()
      setProfiles(data.profiles)
      setActiveProfileId(data.activeProfileId)
      return data
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profiles')
      setProfiles([])
      setActiveProfileId(null)
      return null
    } finally {
      setLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const create = useCallback(
    async (gameUid: string, nickname: string) => {
      const result = await api.createProfile(gameUid, nickname)
      await refresh()
      return result
    },
    [refresh],
  )

  const update = useCallback(
    async (id: string, nickname: string) => {
      const result = await api.updateProfile(id, nickname)
      await refresh()
      return result
    },
    [refresh],
  )

  const remove = useCallback(
    async (id: string) => {
      const result = await api.deleteProfile(id)
      await refresh()
      return result
    },
    [refresh],
  )

  const setActive = useCallback(
    async (profileId: string) => {
      const result = await api.setActiveProfile(profileId)
      setActiveProfileId(result.activeProfileId)
      await refresh()
      return result
    },
    [refresh],
  )

  const listAdmins = useCallback(async (profileId: string): Promise<ProfileMember[]> => {
    const { members } = await api.listProfileAdmins(profileId)
    return members
  }, [])

  const addAdmin = useCallback(async (profileId: string, username: string) => {
    return api.addProfileAdmin(profileId, username)
  }, [])

  const removeAdmin = useCallback(async (profileId: string, userId: string) => {
    return api.removeProfileAdmin(profileId, userId)
  }, [])

  const claim = useCallback(
    async (profileId: string, screenshot: File, message?: string) => {
      return api.submitProfileClaim(profileId, screenshot, message)
    },
    [],
  )

  const activeProfile =
    profiles.find((p) => p.id === activeProfileId) ?? profiles[0] ?? null
  const effectiveActiveProfileId = activeProfileId ?? activeProfile?.id ?? null

  return {
    profiles,
    activeProfileId: effectiveActiveProfileId,
    activeProfile,
    loading,
    error,
    refresh,
    create,
    update,
    remove,
    setActive,
    listAdmins,
    addAdmin,
    removeAdmin,
    claim,
    setError,
  }
}
