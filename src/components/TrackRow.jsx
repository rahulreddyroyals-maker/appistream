import { useState } from 'react'
import { formatTime, formatSize } from '../utils/helpers'

export default function TrackRow({ track, index, isActive, isPlaying, onPlay, onAdd, onFavorite, isFav, onRemove, showIndex, draggable, onDragStart, onDragOver, onDrop }) {
  const [showMenu, setShowMenu] = useState(false)
  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', cursor: 'pointer', transition: 'background 0.15s', background: isActive ? 'rgba(56,189,248,0.08)' : 'transparent', borderLeft: isActive ? '2px solid var(--sky)' : '2px solid transparent', position: 'relative' }}
      onClick={onPlay}>
      <div style={{ width: 36, height: 36, borderRadius: 8, background: isActive ? 'rgba(37,99,235,0.3)' : 'var(--navy-light)', border: `1px solid ${isActive ? 'rgba(56,189,248,0.4)' : 'var(--navy-border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: showIndex && !isActive ? 11 : 16, color: isActive ? 'var(--sky)' : 'var(--muted)', flexShrink: 0 }}>
        {isActive && isPlaying ? <span style={{ animation: 'pulse 1s infinite', fontSize: 12 }}>▶</span> : showIndex && !isActive ? <span style={{ fontFamily: 'monospace' }}>{index + 1}</span> : track.type === 'video' ? '🎬' : '🎵'}
      </div>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <div style={{ fontSize: 13, fontWeight: isActive ? 600 : 400, color: isActive ? 'var(--sky)' : 'var(--white)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.displayName}</div>
        <div style={{ fontSize: 10, color: 'var(--dimmed)', marginTop: 1, display: 'flex', gap: 6 }}>
          <span style={{ background: 'var(--navy-border)', padding: '0 4px', borderRadius: 3, letterSpacing: 0.5 }}>{track.ext?.toUpperCase()}</span>
          {track.duration > 0 && <span>{formatTime(track.duration)}</span>}
          <span>{formatSize(track.size)}</span>
          {track.playCount > 0 && <span>▶ {track.playCount}</span>}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        {onFavorite && (
          <button onClick={e => { e.stopPropagation(); onFavorite() }} style={{ color: isFav ? '#EF4444' : 'var(--dimmed)', fontSize: 16, padding: 4 }} title={isFav ? 'Remove favorite' : 'Add favorite'}>
            {isFav ? '♥' : '♡'}
          </button>
        )}
        <button onClick={e => { e.stopPropagation(); setShowMenu(m => !m) }} style={{ color: 'var(--dimmed)', fontSize: 18, padding: '0 4px', lineHeight: 1 }}>⋮</button>
      </div>
      {showMenu && (
        <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', right: 8, top: 44, background: 'var(--navy-light)', border: '1px solid var(--navy-border)', borderRadius: 8, overflow: 'hidden', zIndex: 100, minWidth: 140, boxShadow: '0 8px 24px rgba(0,0,0,0.6)' }}>
          {[
            onAdd && { label: '➕ Add to Queue', fn: onAdd },
            onFavorite && { label: isFav ? '💔 Unfavorite' : '♥ Favorite', fn: onFavorite },
            onRemove && { label: '🗑 Remove', fn: onRemove },
          ].filter(Boolean).map(item => (
            <button key={item.label} onClick={() => { item.fn(); setShowMenu(false) }}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', color: item.label.includes('Remove') ? 'var(--danger)' : 'var(--white)', fontSize: 12, letterSpacing: 0.3, borderBottom: '1px solid var(--navy-border)', background: 'transparent' }}>
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
