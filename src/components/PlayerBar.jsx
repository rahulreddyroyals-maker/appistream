import { useNavigate } from 'react-router-dom'
import { usePlayer } from '../context/PlayerContext'
import { formatTime } from '../utils/helpers'

export default function PlayerBar() {
  const { state, controls, currentTrack } = usePlayer()
  const { isPlaying, currentTime, duration } = state
  const navigate = useNavigate()
  if (!currentTrack) return null
  const progress = duration ? currentTime / duration : 0

  return (
    <div onClick={() => navigate('/')} style={{ background: 'var(--navy-light)', borderTop: '1px solid var(--navy-border)', padding: '8px 16px', cursor: 'pointer', position: 'relative' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, height: 2, width: `${progress * 100}%`, background: 'var(--sky)', boxShadow: '0 0 8px var(--sky-glow)', transition: 'width 0.1s linear' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--navy-mid)', border: '1px solid var(--navy-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
          {currentTrack.type === 'video' ? '🎬' : '🎵'}
        </div>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--white)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{currentTrack.displayName}</div>
          <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'monospace' }}>{formatTime(currentTime)} / {formatTime(duration)}</div>
        </div>
        <button onClick={e => { e.stopPropagation(); controls.prev() }} style={{ color: 'var(--muted)', fontSize: 16, padding: 4 }}>⏮</button>
        <button onClick={e => { e.stopPropagation(); controls.toggle() }}
          style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--blue-dim)', border: '1px solid var(--blue)', color: 'var(--sky)', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {isPlaying ? '⏸' : '▶'}
        </button>
        <button onClick={e => { e.stopPropagation(); controls.next() }} style={{ color: 'var(--muted)', fontSize: 16, padding: 4 }}>⏭</button>
      </div>
    </div>
  )
}
