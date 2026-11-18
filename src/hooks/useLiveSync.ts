/**
 * Live Synchronization Hook
 * 
 * Provides near-real-time polling (5-10s interval) and browser tab focus synchronization.
 * Prevents overlapping network requests and updates data without full-page reloads.
 * Timezone: Asia/Kolkata (Indian Standard Time - IST).
 * Zero emojis per specification.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { formatISTTime } from '../utils/timezone'

interface UseLiveSyncOptions {
  /**
   * Polling interval in milliseconds.
   * Default: 8000ms (8 seconds, conforming to the 5-10s requirement).
   */
  pollIntervalMs?: number
  /**
   * Optional custom refresh callback (e.g. backend fetch).
   */
  onSync?: () => Promise<void> | void
}

interface UseLiveSyncResult {
  revision: number
  lastUpdated: string
  isSyncing: boolean
  triggerSync: () => Promise<void>
}

export function useLiveSync(options: UseLiveSyncOptions = {}): UseLiveSyncResult {
  const { pollIntervalMs = 8000, onSync } = options

  const [revision, setRevision] = useState<number>(0)
  const [lastUpdated, setLastUpdated] = useState<string>(() => formatISTTime(new Date()))
  const [isSyncing, setIsSyncing] = useState<boolean>(false)

  const isSyncingRef = useRef<boolean>(false)
  const onSyncRef = useRef(onSync)

  useEffect(() => {
    onSyncRef.current = onSync
  }, [onSync])

  const triggerSync = useCallback(async () => {
    // Prevent overlapping network or storage sync requests
    if (isSyncingRef.current) {
      return
    }

    try {
      isSyncingRef.current = true
      setIsSyncing(true)

      if (onSyncRef.current) {
        await onSyncRef.current()
      }

      setRevision((prev) => prev + 1)
      setLastUpdated(formatISTTime(new Date()))
    } catch (err) {
      // Gracefully log without crashing the UI
      console.warn('Live sync refresh encountered an error:', err)
    } finally {
      isSyncingRef.current = false
      setIsSyncing(false)
    }
  }, [])

  useEffect(() => {
    // 1. Recurring Polling Timer (5-10s, default 8s)
    const intervalId = window.setInterval(() => {
      // Only poll if document is visible to save battery/bandwidth
      if (document.visibilityState === 'visible') {
        void triggerSync()
      }
    }, pollIntervalMs)

    // 2. Tab Visibility and Focus Listener
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void triggerSync()
      }
    }

    const handleFocus = () => {
      void triggerSync()
    }

    // 3. Multi-Tab Cross-Storage Synchronization
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key && e.key.startsWith('gitam_')) {
        void triggerSync()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)
    window.addEventListener('storage', handleStorageChange)

    return () => {
      window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [pollIntervalMs, triggerSync])

  return {
    revision,
    lastUpdated,
    isSyncing,
    triggerSync,
  }
}
