import { useState, useRef } from 'react'
import { usePlayer } from '../context/PlayerContext'
import { formatTime } from '../utils/helpers'

export default function VideoOverlay() {
  const { state, controls, videoRef, currentTrack } = usePlayer()
  const { isPlaying, currentTime, duration, volume, isMuted } = state
  const [showControls, setShowControls] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const containerRef = useRef(null)
  const hideTimer = useRef(null)

  const handleTouch = () => {
    setShowControls(true)
    clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => setShowControls(false), 3000)
  }

  const toggleFullscreen = () => {
    if (!isFullscreen) {
      containerRef.current?.requestFullscreen?.()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen?.()
      setIsFullscreen(false)
    }
  }

  const progress = duration ? currentTime / duration : 0

  // Wire video element events
  if (videoRef.current) {
    videoRef.current.ontimeupdate = () => controls.seek && null
    videoRef.current.style.display = 'block'
  }

  return (
    <div ref={containerRef} onClick={handleTouch}
      style={{ position: 'relative', background: '#000', width: '100%', aspectRatio: '16/9', flexShrink: 0 }}>
      <video
        ref={videoRef}
        style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
        playsInline
        onTimeUpdate={() => { }}
        onLoadedMetadata={() => { }}
      />
      {showControls && (
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 40%, transparent 70%, rgba(0,0,0,0.4) 100%)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 12 }}>
          <div style={{ color: '#fff', fontSize: 12, fontWeight: 600, letterSpacing: 0.5, textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>{currentTrack?.displayName}</div>
          <div>
            <input type="range" min={0} max={duration || 1} step={0.5} value={currentTime}
              onChange={e => controls.seek(parseFloat(e.target.value))}
              style={{ width: '100%', marginBottom: 8, background: `linear-gradient(to right, var(--sky) ${progress*100}%, rgba(255,255,255,0.3) ${progress*100}%)` }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <button onClick={e => { e.stopPropagation(); controls.prev() }} style={{ color: '#fff', fontSize: 18 }}>⏮</button>
                <button onClick={e => { e.stopPropagation(); controls.toggle() }} style={{ color: 'var(--sky)', fontSize: 24, width: 44, height: 44, borderRadius: '50%', background: 'rgba(56,189,248,0.2)', border: '1px solid var(--sky)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {isPlaying ? '⏸' : '▶'}
                </button>
                <button onClick={e => { e.stopPropagation(); controls.next() }} style={{ color: '#fff', fontSize: 18 }}>⏭</button>
                <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, fontFamily: 'monospace' }}>{formatTime(currentTime)} / {formatTime(duration)}</span>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={e => { e.stopPropagation(); controls.toggleMute() }} style={{ color: '#fff', fontSize: 16 }}>{isMuted ? '🔇' : '🔊'}</button>
                <button onClick={e => { e.stopPropagation(); toggleFullscreen() }} style={{ color: '#fff', fontSize: 16 }}>{isFullscreen ? '⊡' : '⊞'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
