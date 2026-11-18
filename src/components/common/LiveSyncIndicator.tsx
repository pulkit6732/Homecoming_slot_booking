/**
 * Live Synchronization Status Bar Component
 * 
 * Displays live polling status, last updated timestamp in Asia/Kolkata (IST),
 * and provides manual refresh capability.
 * Zero emojis per specification.
 */

interface LiveSyncIndicatorProps {
  lastUpdated: string
  isSyncing: boolean
  onRefresh: () => void
  label?: string
}

export function LiveSyncIndicator({
  lastUpdated,
  isSyncing,
  onRefresh,
  label = 'Real-Time Sync'
}: LiveSyncIndicatorProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.5rem 1rem',
        backgroundColor: '#f0fdf4',
        border: '1px solid #bbf7d0',
        borderRadius: 'var(--radius-md)',
        marginBottom: '1rem',
        fontSize: '0.825rem',
        color: '#166534',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <span
          style={{
            display: 'inline-block',
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: isSyncing ? '#eab308' : '#22c55e',
            transition: 'background-color 0.2s ease',
          }}
          aria-hidden="true"
        />
        <span>
          <strong>{label}</strong>: {isSyncing ? 'Synchronizing latest records...' : 'Auto-polling every 8s and on tab focus.'}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <span style={{ color: '#15803d' }}>
          Last checked: <strong>{lastUpdated}</strong>
        </span>
        <button
          type="button"
          onClick={onRefresh}
          disabled={isSyncing}
          style={{
            padding: '0.25rem 0.65rem',
            fontSize: '0.75rem',
            fontWeight: 600,
            color: '#166534',
            backgroundColor: '#ffffff',
            border: '1px solid #86efac',
            borderRadius: 'var(--radius-sm)',
            cursor: isSyncing ? 'not-allowed' : 'pointer',
          }}
        >
          {isSyncing ? 'Refreshing...' : 'Refresh Now'}
        </button>
      </div>
    </div>
  )
}
