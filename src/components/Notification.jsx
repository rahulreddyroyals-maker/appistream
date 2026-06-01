import { usePlayer } from '../context/PlayerContext'

export default function Notification() {
  const { state } = usePlayer()
  const { notification } = state
  if (!notification) return null
  const colors = { info: 'var(--sky)', error: 'var(--danger)', warning: 'var(--warning)', success: 'var(--success)' }
  return (
    <div className="animate-slideUp" style={{
      position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
      background: 'var(--navy-light)', border: `1px solid ${colors[notification.type] || colors.info}`,
      color: colors[notification.type] || colors.info, borderRadius: 8,
      padding: '8px 16px', fontSize: 12, letterSpacing: 0.5, whiteSpace: 'nowrap',
      boxShadow: `0 0 16px ${colors[notification.type] || colors.info}40`,
      zIndex: 9999, fontWeight: 600,
    }}>
      {notification.message}
    </div>
  )
}
