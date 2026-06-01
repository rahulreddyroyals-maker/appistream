import { useRef, useState, useCallback, useEffect } from 'react'
import { formatTime } from '../utils/helpers'

export default function SeekBar({ currentTime, duration, onSeek, color = 'var(--sky)' }) {
  const barRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [dragTime, setDragTime] = useState(0)
  const [tooltip, setTooltip] = useState(null) // pct 0-1 | null

  const pctFromClient = useCallback((clientX) => {
    const bar = barRef.current
    if (!bar) return 0
    const { left, width } = bar.getBoundingClientRect()
    return Math.min(1, Math.max(0, (clientX - left) / width))
  }, [])

  const startDrag = useCallback((clientX) => {
    const pct = pctFromClient(clientX)
    setDragging(true)
    setDragTime(pct * (duration || 0))
    setTooltip(pct)
  }, [pctFromClient, duration])

  const moveDrag = useCallback((clientX) => {
    const pct = pctFromClient(clientX)
    setDragTime(pct * (duration || 0))
    setTooltip(pct)
  }, [pctFromClient, duration])

  const endDrag = useCallback((clientX) => {
    const pct = pctFromClient(clientX)
    const t = pct * (duration || 0)
    setDragging(false)
    setTooltip(null)
    onSeek(t)
  }, [pctFromClient, duration, onSeek])

  // Global pointer events so drag works even if finger leaves bar
  useEffect(() => {
    if (!dragging) return
    const onMove = (e) => {
      e.preventDefault()
      moveDrag(e.touches ? e.touches[0].clientX : e.clientX)
    }
    const onUp = (e) => {
      const clientX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX
      endDrag(clientX)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    window.addEventListener('touchmove', onMove, { passive: false })
    window.addEventListener('touchend', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onUp)
    }
  }, [dragging, moveDrag, endDrag])

  const displayTime = dragging ? dragTime : (currentTime || 0)
  const displayPct = duration ? displayTime / duration : 0
  const tooltipPct = tooltip ?? displayPct

  return (
    <div style={{ padding: '10px 0', userSelect: 'none', WebkitUserSelect: 'none' }}>
      {/* Tooltip */}
      {tooltip !== null && duration > 0 && (
        <div style={{
          position: 'absolute', zIndex: 100,
          left: `calc(${tooltipPct * 100}% )`,
          transform: 'translateX(-50%)',
          background: 'var(--navy)', border: '1px solid var(--sky)',
          color: 'var(--sky)', borderRadius: 6, padding: '2px 8px',
          fontSize: 11, fontFamily: 'monospace', whiteSpace: 'nowrap',
          boxShadow: '0 0 10px rgba(56,189,248,0.4)', pointerEvents: 'none',
          marginTop: -28,
        }}>
          {formatTime(displayTime)}
        </div>
      )}

      {/* Hit area (large for easy touch) */}
      <div ref={barRef}
        style={{ position: 'relative', height: 28, display: 'flex', alignItems: 'center', cursor: 'pointer', touchAction: 'none' }}
        onMouseDown={e => startDrag(e.clientX)}
        onTouchStart={e => { e.preventDefault(); startDrag(e.touches[0].clientX) }}>

        {/* Track */}
        <div style={{ position: 'absolute', left: 0, right: 0, height: dragging ? 6 : 4, borderRadius: 3, background: 'rgba(255,255,255,0.12)', transition: 'height 0.15s' }}>
          {/* Fill */}
          <div style={{
            position: 'absolute', left: 0, top: 0, bottom: 0,
            width: `${Math.min(100, displayPct * 100)}%`, borderRadius: 3,
            background: `linear-gradient(to right, var(--blue), ${color})`,
            boxShadow: dragging ? `0 0 12px ${color}` : `0 0 4px ${color}55`,
            transition: dragging ? 'none' : 'width 0.1s linear',
          }} />
        </div>

        {/* Thumb */}
        <div style={{
          position: 'absolute',
          left: `${Math.min(100, displayPct * 100)}%`,
          transform: 'translateX(-50%)',
          width: dragging ? 22 : 16, height: dragging ? 22 : 16,
          borderRadius: '50%',
          background: '#fff',
          border: `3px solid ${color}`,
          boxShadow: dragging ? `0 0 0 6px ${color}33, 0 0 16px ${color}` : `0 0 6px ${color}88`,
          transition: dragging ? 'none' : 'width 0.15s, height 0.15s',
          zIndex: 2,
        }} />
      </div>

      {/* Time labels */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2, fontSize: 11, color: 'var(--muted)', fontFamily: 'monospace' }}>
        <span>{formatTime(displayTime)}</span>
        <span style={{ color: 'var(--dimmed)' }}>{formatTime(duration)}</span>
      </div>
    </div>
  )
}
