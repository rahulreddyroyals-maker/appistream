export const formatTime = (s) => {
  if (!s || isNaN(s) || !isFinite(s)) return '0:00'
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = Math.floor(s % 60)
  if (h > 0) return `${h}:${m.toString().padStart(2,'0')}:${sec.toString().padStart(2,'0')}`
  return `${m}:${sec.toString().padStart(2,'0')}`
}
export const formatSize = (b) => {
  if (!b) return '0 B'
  const k=1024, s=['B','KB','MB','GB'], i=Math.floor(Math.log(b)/Math.log(k))
  return `${(b/Math.pow(k,i)).toFixed(1)} ${s[i]}`
}
export const generateId = () => Math.random().toString(36).slice(2)+Date.now().toString(36)
export const getExt = (n='') => n.split('.').pop().toLowerCase()
export const isVideoFile = (n='') => ['mp4','webm','mov','mkv','avi','m4v','3gp'].includes(getExt(n))
export const isAudioFile = (n='') => ['mp3','wav','ogg','aac','flac','m4a','opus','wma','aiff'].includes(getExt(n))
export const isMediaFile = (n) => isAudioFile(n) || isVideoFile(n)
export const getMediaType = (n) => isVideoFile(n) ? 'video' : 'audio'
export const timeAgo = (ts) => {
  const d=Date.now()-ts, m=Math.floor(d/60000), h=Math.floor(m/60), dy=Math.floor(h/24)
  return dy>0?`${dy}d ago`:h>0?`${h}h ago`:m>0?`${m}m ago`:'just now'
}
export const buildTrackFromFile = (file) => ({
  id: generateId(),
  name: file.name,
  displayName: file.name.replace(/\.[^.]+$/, ''),
  url: URL.createObjectURL(file),
  type: getMediaType(file.name),
  ext: getExt(file.name),
  size: file.size,
  addedAt: Date.now(),
  duration: 0,
  artist: '',
  album: '',
  playCount: 0,
})
export const EQ_FREQUENCIES = [32,64,125,250,500,1000,2000,4000,8000,16000]
export const EQ_PRESETS = {
  flat:       { name:'Flat',       bands:[0,0,0,0,0,0,0,0,0,0] },
  bass:       { name:'Bass Boost', bands:[6,5,4,2,0,0,0,0,0,0] },
  treble:     { name:'Treble',     bands:[0,0,0,0,0,1,2,3,5,6] },
  vocal:      { name:'Vocal',      bands:[-2,-1,0,3,5,4,3,1,0,-1] },
  rock:       { name:'Rock',       bands:[4,3,2,0,-1,0,2,3,4,4] },
  pop:        { name:'Pop',        bands:[-1,0,2,4,4,3,1,0,-1,-1] },
  jazz:       { name:'Jazz',       bands:[0,0,1,3,4,4,2,2,2,2] },
  classical:  { name:'Classical',  bands:[0,0,0,0,0,0,-2,-3,-3,-3] },
  electronic: { name:'Electronic', bands:[4,3,0,0,-1,1,2,3,4,5] },
}
