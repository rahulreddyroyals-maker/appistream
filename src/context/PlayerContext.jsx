import { createContext, useContext, useReducer, useRef, useEffect, useCallback } from 'react'
import { EQ_FREQUENCIES, isMediaFile, buildTrackFromFile } from '../utils/helpers'
import { addToHistory, getSetting, setSetting, getEQSettings, saveEQSettings, saveAllTrackMeta } from '../utils/db'
import { restoreLibrary, addIndividualFiles, clearLibrary } from '../utils/folderScanner'

const PlayerContext = createContext(null)

const initial = {
  audioQueue: [], audioIndex: null,
  audioPlaying: false, audioTime: 0, audioDuration: 0,
  videoQueue: [], videoIndex: null,
  videoPlaying: false, videoTime: 0, videoDuration: 0,
  activeMode: 'audio',
  volume: 0.8, isMuted: false,
  loop: 'none', shuffle: false,
  eqEnabled: false, eqBands: [0,0,0,0,0,0,0,0,0,0],
  noiseCancelEnabled: true,   // ← noise cancellation on by default
  playbackRate: 1, sleepTimerEnd: null,
  notification: null,
  restoring: true,
  needsPermission: false,
  totalSaved: 0,
  hasSavedFiles: false,
}

function reducer(s, { type, payload, index }) {
  switch(type) {
    case 'SET': return { ...s, ...payload }
    // Load both queues atomically - prevents the split-dispatch timing bug
    case 'LOAD_LIBRARY': {
      const { audio, video } = payload
      return {
        ...s,
        audioQueue: audio,
        videoQueue: video,
        audioIndex: audio.length ? 0 : null,
        videoIndex: video.length ? 0 : null,
      }
    }
    case 'ADD_AUDIO': {
      const q = [...s.audioQueue, ...payload]
      return { ...s, audioQueue: q, audioIndex: s.audioIndex ?? (q.length ? 0 : null) }
    }
    case 'ADD_VIDEO': {
      const q = [...s.videoQueue, ...payload]
      return { ...s, videoQueue: q, videoIndex: s.videoIndex ?? (q.length ? 0 : null) }
    }
    // MERGE: add tracks that aren't already in the queue (dedup by id)
    case 'MERGE_AUDIO': {
      const existing = new Set(s.audioQueue.map(t => t.id))
      const newTracks = payload.filter(t => !existing.has(t.id))
      if (!newTracks.length) return s
      const q = [...s.audioQueue, ...newTracks]
      return { ...s, audioQueue: q, audioIndex: s.audioIndex ?? (q.length ? 0 : null) }
    }
    case 'MERGE_VIDEO': {
      const existing = new Set(s.videoQueue.map(t => t.id))
      const newTracks = payload.filter(t => !existing.has(t.id))
      if (!newTracks.length) return s
      const q = [...s.videoQueue, ...newTracks]
      return { ...s, videoQueue: q, videoIndex: s.videoIndex ?? (q.length ? 0 : null) }
    }
    case 'SET_AUDIO_Q': return { ...s, audioQueue: payload, audioIndex: typeof index==='number'?index:0 }
    case 'SET_VIDEO_Q': return { ...s, videoQueue: payload, videoIndex: typeof index==='number'?index:0 }
    case 'DEL_AUDIO': {
      const q=s.audioQueue.filter((_,i)=>i!==index)
      const ci=s.audioIndex; const ni=index<ci?ci-1:index===ci?(q.length?Math.min(ci,q.length-1):null):ci
      return { ...s, audioQueue:q, audioIndex:ni }
    }
    case 'DEL_VIDEO': {
      const q=s.videoQueue.filter((_,i)=>i!==index)
      const ci=s.videoIndex; const ni=index<ci?ci-1:index===ci?(q.length?Math.min(ci,q.length-1):null):ci
      return { ...s, videoQueue:q, videoIndex:ni }
    }
    case 'NOTIFY': return { ...s, notification: payload }
    case 'CLEAR_N': return { ...s, notification: null }
    default: return s
  }
}

export function PlayerProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initial)
  const ref = useRef(state); ref.current = state
  const audioRef = useRef(null)
  const videoRef = useRef(null)
  const restoreLastRef = useRef('')

  // Audio graph nodes
  const audioCtx   = useRef(null)
  const eqSource   = useRef(null)
  const eqNodes    = useRef([])
  const gainNode   = useRef(null)
  const noiseGate  = useRef(null)   // DynamicsCompressor acts as noise gate
  const highPass   = useRef(null)   // High-pass to cut low rumble
  const lowPass    = useRef(null)   // Low-pass to cut hiss

  const _activeEl = () => ref.current.activeMode==='audio' ? audioRef.current : videoRef.current

  // ── Restore library on mount ──────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [volume,loop,shuffle,eqEnabled,eqBands,noiseCancelEnabled] = await Promise.all([
          getSetting('volume',0.8), getSetting('loop','none'), getSetting('shuffle',false),
          getSetting('eqEnabled',false), getEQSettings(), getSetting('noiseCancelEnabled',true)
        ])
        if (!cancelled) dispatch({ type:'SET', payload:{ volume, loop, shuffle, eqEnabled, noiseCancelEnabled,
          eqBands: eqBands||[0,0,0,0,0,0,0,0,0,0] }})

        const result = await restoreLibrary((count, name) => {
          if (!cancelled) { dispatch({ type:'SET', payload:{ totalSaved:count }}); restoreLastRef.current = name }
        })
        if (cancelled) return

        const { tracks, needsPermission, totalSaved } = result
        // ── KEY FIX: dispatch both audio+video in ONE atomic action ──
        const audio = tracks.filter(t => t.type === 'audio')
        const video = tracks.filter(t => t.type === 'video')

        dispatch({ type:'LOAD_LIBRARY', payload:{ audio, video } })
        dispatch({ type:'SET', payload:{
          restoring: false,
          needsPermission: needsPermission && tracks.length === 0,
          hasSavedFiles: totalSaved > 0,
          totalSaved,
        }})

        if (tracks.length > 0)
          notify(`Loaded ${audio.length} songs + ${video.length} videos 🎵`)
        else if (needsPermission)
          notify(`${totalSaved} files saved — tap Restore`, 'warning')

      } catch(e) {
        if (!cancelled) dispatch({ type:'SET', payload:{ restoring:false }})
      }
    })()
    return () => { cancelled = true }
  }, [])

  // ── Build Web Audio graph: EQ + Noise Cancellation ───────────────────────
  const setupAudioGraph = useCallback(() => {
    if (audioCtx.current || !audioRef.current || eqSource.current) return
    const ctx = audioCtx.current = new (window.AudioContext||window.webkitAudioContext)()

    // Source
    eqSource.current = ctx.createMediaElementSource(audioRef.current)

    // 1. High-pass filter — remove low-frequency rumble/noise (below 60Hz)
    const hp = highPass.current = ctx.createBiquadFilter()
    hp.type = 'highpass'; hp.frequency.value = 60; hp.Q.value = 0.5

    // 2. Low-pass filter — remove ultra-high hiss (above 18kHz)
    const lp = lowPass.current = ctx.createBiquadFilter()
    lp.type = 'lowpass'; lp.frequency.value = 18000; lp.Q.value = 0.5

    // 3. Dynamics compressor as noise gate/limiter
    //    Reduces background hiss, prevents clipping, improves clarity
    const comp = noiseGate.current = ctx.createDynamicsCompressor()
    comp.threshold.value = -40   // dB: noise below -40dB gets compressed
    comp.knee.value = 10         // smooth transition
    comp.ratio.value = 4         // 4:1 compression ratio
    comp.attack.value = 0.003    // fast attack (3ms)
    comp.release.value = 0.25    // 250ms release

    // 4. EQ bands (10-band parametric)
    const bands = eqNodes.current = EQ_FREQUENCIES.map((freq, i) => {
      const f = ctx.createBiquadFilter()
      f.type = i===0?'lowshelf':i===EQ_FREQUENCIES.length-1?'highshelf':'peaking'
      f.frequency.value = freq; f.gain.value = 0; return f
    })

    // 5. Master gain
    gainNode.current = ctx.createGain(); gainNode.current.gain.value = 1.0

    // Chain: source → highPass → lowPass → compressor → EQ[0..9] → gain → output
    eqSource.current.connect(hp)
    hp.connect(lp)
    lp.connect(comp)
    comp.connect(bands[0])
    for (let i=0;i<bands.length-1;i++) bands[i].connect(bands[i+1])
    bands[bands.length-1].connect(gainNode.current)
    gainNode.current.connect(ctx.destination)
  }, [])

  // Update EQ gains
  useEffect(() => {
    eqNodes.current.forEach((n,i) => { if(n) n.gain.value = state.eqEnabled ? state.eqBands[i] : 0 })
  }, [state.eqBands, state.eqEnabled])

  // Update noise cancellation
  useEffect(() => {
    const { noiseCancelEnabled } = ref.current
    // Toggle high-pass and low-pass effect
    if (highPass.current) highPass.current.frequency.value = noiseCancelEnabled ? 60 : 20
    if (lowPass.current) lowPass.current.frequency.value = noiseCancelEnabled ? 18000 : 22000
    if (noiseGate.current) {
      noiseGate.current.threshold.value = noiseCancelEnabled ? -40 : -100
      noiseGate.current.ratio.value = noiseCancelEnabled ? 4 : 1
    }
  }, [state.noiseCancelEnabled])

  // ── Load track ────────────────────────────────────────────────────────────
  const loadAndPlay = useCallback((track, mode, autoplay=true) => {
    if (!track) return
    const el = mode==='audio' ? audioRef.current : videoRef.current
    if (!el) return
    const other = mode==='audio' ? videoRef.current : audioRef.current
    if (other && !other.paused) other.pause()
    el.src = track.url
    el.volume = ref.current.isMuted ? 0 : ref.current.volume
    el.playbackRate = ref.current.playbackRate
    el.load()
    if (autoplay) {
      if (mode==='audio') {
        setupAudioGraph()
        if (audioCtx.current?.state==='suspended') audioCtx.current.resume()
      }
      el.play().catch(()=>{})
    }
    addToHistory(track)
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.displayName, artist: track.artist||'AppiStream', album: ''
      })
      navigator.mediaSession.setActionHandler('play', ()=>controls.play())
      navigator.mediaSession.setActionHandler('pause', ()=>controls.pause())
      navigator.mediaSession.setActionHandler('nexttrack', ()=>controls.next())
      navigator.mediaSession.setActionHandler('previoustrack', ()=>controls.prev())
      navigator.mediaSession.setActionHandler('seekto', d=>{ if(d.seekTime!=null) controls.seek(d.seekTime) })
    }
  }, [setupAudioGraph])

  // Watch audio index
  useEffect(() => {
    const { audioQueue, audioIndex, activeMode } = ref.current
    if (audioIndex===null || !audioQueue[audioIndex] || activeMode!=='audio') return
    loadAndPlay(audioQueue[audioIndex], 'audio', true)
  }, [state.audioIndex])

  // Watch video index
  useEffect(() => {
    const { videoQueue, videoIndex, activeMode } = ref.current
    if (videoIndex===null || !videoQueue[videoIndex] || activeMode!=='video') return
    loadAndPlay(videoQueue[videoIndex], 'video', true)
  }, [state.videoIndex])

  // Volume/mute
  useEffect(() => {
    const v = state.isMuted ? 0 : state.volume
    if (audioRef.current) audioRef.current.volume = v
    if (videoRef.current) videoRef.current.volume = v
  }, [state.volume, state.isMuted])

  // Playback rate
  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = state.playbackRate
    if (videoRef.current) videoRef.current.playbackRate = state.playbackRate
  }, [state.playbackRate])

  // Sleep timer
  useEffect(() => {
    if (!state.sleepTimerEnd) return
    const left = state.sleepTimerEnd - Date.now()
    if (left <= 0) { _activeEl()?.pause(); dispatch({type:'SET',payload:{audioPlaying:false,videoPlaying:false,sleepTimerEnd:null}}); return }
    const t = setTimeout(() => {
      _activeEl()?.pause()
      dispatch({type:'SET',payload:{audioPlaying:false,videoPlaying:false,sleepTimerEnd:null}})
      notify('Sleep timer ended')
    }, left)
    return () => clearTimeout(t)
  }, [state.sleepTimerEnd])

  // Persist settings
  useEffect(()=>{setSetting('volume',state.volume)},[state.volume])
  useEffect(()=>{setSetting('loop',state.loop)},[state.loop])
  useEffect(()=>{setSetting('shuffle',state.shuffle)},[state.shuffle])
  useEffect(()=>{setSetting('eqEnabled',state.eqEnabled)},[state.eqEnabled])
  useEffect(()=>{saveEQSettings(state.eqBands)},[state.eqBands])
  useEffect(()=>{setSetting('noiseCancelEnabled',state.noiseCancelEnabled)},[state.noiseCancelEnabled])

  const notify = (msg, type='info') => {
    dispatch({ type:'NOTIFY', payload:{ message:msg, type, id:Date.now() }})
    setTimeout(() => dispatch({ type:'CLEAR_N' }), 3500)
  }

  // ── Event handlers ────────────────────────────────────────────────────────
  const audioHandlers = {
    onTimeUpdate(e) { dispatch({type:'SET',payload:{audioTime:e.target.currentTime}}) },
    onLoadedMetadata(e) { dispatch({type:'SET',payload:{audioDuration:e.target.duration}}) },
    onPlay()  { dispatch({type:'SET',payload:{audioPlaying:true}}) },
    onPause() { dispatch({type:'SET',payload:{audioPlaying:false}}) },
    onEnded() { controls.next('audio') },
    onError() { notify('Cannot play — skipping','error'); setTimeout(()=>controls.next('audio'),800) },
  }
  const videoHandlers = {
    onTimeUpdate(e) { dispatch({type:'SET',payload:{videoTime:e.target.currentTime}}) },
    onLoadedMetadata(e) { dispatch({type:'SET',payload:{videoDuration:e.target.duration}}) },
    onPlay()  { dispatch({type:'SET',payload:{videoPlaying:true}}) },
    onPause() { dispatch({type:'SET',payload:{videoPlaying:false}}) },
    onEnded() { controls.next('video') },
    onError() { notify('Cannot play — skipping','error'); setTimeout(()=>controls.next('video'),800) },
  }

  // ── Controls ──────────────────────────────────────────────────────────────
  const controls = {
    setMode(mode) {
      _activeEl()?.pause()
      dispatch({ type:'SET', payload:{ activeMode:mode }})
      setTimeout(() => {
        if (mode==='audio') {
          const {audioQueue,audioIndex}=ref.current
          if (audioIndex!==null && audioQueue[audioIndex]) loadAndPlay(audioQueue[audioIndex],'audio',true)
        } else {
          const {videoQueue,videoIndex}=ref.current
          if (videoIndex!==null && videoQueue[videoIndex]) loadAndPlay(videoQueue[videoIndex],'video',true)
        }
      }, 60)
    },
    play() {
      const el=_activeEl(); if(!el) return
      if (ref.current.activeMode==='audio') { setupAudioGraph(); if(audioCtx.current?.state==='suspended') audioCtx.current.resume() }
      el.play().catch(()=>{})
    },
    pause() { _activeEl()?.pause() },
    toggle() {
      const {activeMode,audioPlaying,videoPlaying}=ref.current
      ;(activeMode==='audio'?audioPlaying:videoPlaying) ? controls.pause() : controls.play()
    },
    seek(t) { const el=_activeEl(); if(el&&isFinite(t)) el.currentTime=t },
    seekBy(d) {
      const {activeMode,audioTime,videoTime,audioDuration,videoDuration}=ref.current
      const cur=activeMode==='audio'?audioTime:videoTime, dur=activeMode==='audio'?audioDuration:videoDuration
      controls.seek(Math.max(0,Math.min(dur||0,cur+d)))
    },
    setVolume(v) { dispatch({type:'SET',payload:{volume:v,isMuted:v===0}}) },
    toggleMute() { dispatch({type:'SET',payload:{isMuted:!ref.current.isMuted}}) },
    setLoop(m) { dispatch({type:'SET',payload:{loop:m}}) },
    toggleShuffle() { dispatch({type:'SET',payload:{shuffle:!ref.current.shuffle}}) },
    setPlaybackRate(r) { dispatch({type:'SET',payload:{playbackRate:r}}) },
    toggleNoiseCancel() {
      const next = !ref.current.noiseCancelEnabled
      dispatch({type:'SET',payload:{noiseCancelEnabled:next}})
      notify(next ? '🎵 Noise cancellation ON' : 'Noise cancellation OFF')
    },

    playAudioAt(i) { dispatch({type:'SET',payload:{activeMode:'audio',audioIndex:i,audioTime:0,audioPlaying:true}}) },
    playVideoAt(i) { dispatch({type:'SET',payload:{activeMode:'video',videoIndex:i,videoTime:0,videoPlaying:true}}) },

    next(mode) {
      const m=mode||ref.current.activeMode
      const {audioQueue,audioIndex,videoQueue,videoIndex,shuffle,loop}=ref.current
      const queue=m==='audio'?audioQueue:videoQueue, ci=m==='audio'?audioIndex:videoIndex
      if (!queue.length) return
      if (loop==='one') { const el=m==='audio'?audioRef.current:videoRef.current; if(el){el.currentTime=0;el.play().catch(()=>{})}; return }
      let ni; if(shuffle){do{ni=Math.floor(Math.random()*queue.length)}while(queue.length>1&&ni===ci)}else ni=(ci??-1)+1
      if (ni>=queue.length) { if(loop==='all') ni=0; else{controls.pause();return} }
      if (m==='audio') dispatch({type:'SET',payload:{audioIndex:ni,audioTime:0,audioPlaying:true}})
      else dispatch({type:'SET',payload:{videoIndex:ni,videoTime:0,videoPlaying:true}})
    },
    prev(mode) {
      const m=mode||ref.current.activeMode
      const {audioQueue,audioIndex,videoQueue,videoIndex,audioTime,videoTime}=ref.current
      const ci=m==='audio'?audioIndex:videoIndex, ct=m==='audio'?audioTime:videoTime
      if (ct>3){controls.seek(0);return}
      const ni=Math.max(0,(ci??1)-1)
      if (m==='audio') dispatch({type:'SET',payload:{audioIndex:ni,audioTime:0,audioPlaying:true}})
      else dispatch({type:'SET',payload:{videoIndex:ni,videoTime:0,videoPlaying:true}})
    },

    // addAudio/addVideo MERGE — never clears existing, deduplicates by id
    addAudio(tracks) {
      dispatch({type:'MERGE_AUDIO',payload:tracks})
      if (ref.current.audioIndex===null && tracks.length) setTimeout(()=>dispatch({type:'SET',payload:{audioIndex:0,audioPlaying:true}}),60)
    },
    addVideo(tracks) {
      dispatch({type:'MERGE_VIDEO',payload:tracks})
      if (ref.current.videoIndex===null && tracks.length) setTimeout(()=>dispatch({type:'SET',payload:{videoIndex:0,videoPlaying:true}}),60)
    },
    // replaceAudio/replaceVideo — used only when explicitly replacing entire library
    replaceAudio(tracks) {
      if(audioRef.current){audioRef.current.pause();audioRef.current.src=''}
      dispatch({type:'SET',payload:{audioQueue:tracks,audioIndex:tracks.length?0:null,audioPlaying:false,audioTime:0,audioDuration:0}})
      if (tracks.length) setTimeout(()=>dispatch({type:'SET',payload:{audioPlaying:true}}),60)
    },
    replaceVideo(tracks) {
      if(videoRef.current){videoRef.current.pause();videoRef.current.src=''}
      dispatch({type:'SET',payload:{videoQueue:tracks,videoIndex:tracks.length?0:null,videoPlaying:false,videoTime:0,videoDuration:0}})
      if (tracks.length) setTimeout(()=>dispatch({type:'SET',payload:{videoPlaying:true}}),60)
    },
    removeAudio(i) { dispatch({type:'DEL_AUDIO',index:i}) },
    removeVideo(i) { dispatch({type:'DEL_VIDEO',index:i}) },
    clearAudio() {
      if(audioRef.current){audioRef.current.pause();audioRef.current.src=''}
      dispatch({type:'SET',payload:{audioQueue:[],audioIndex:null,audioPlaying:false,audioTime:0,audioDuration:0}})
    },
    clearVideo() {
      if(videoRef.current){videoRef.current.pause();videoRef.current.src=''}
      dispatch({type:'SET',payload:{videoQueue:[],videoIndex:null,videoPlaying:false,videoTime:0,videoDuration:0}})
    },
    async clearAll() { controls.clearAudio(); controls.clearVideo(); await clearLibrary(); dispatch({type:'SET',payload:{hasSavedFiles:false,totalSaved:0}}) },

    setEQBand(i,v) { const b=[...ref.current.eqBands];b[i]=v;dispatch({type:'SET',payload:{eqBands:b}}) },
    setEQPreset(b) { dispatch({type:'SET',payload:{eqBands:b}}) },
    toggleEQ() { dispatch({type:'SET',payload:{eqEnabled:!ref.current.eqEnabled}}) },
    setSleepTimer(m) {
      if(!m){dispatch({type:'SET',payload:{sleepTimerEnd:null}});return}
      dispatch({type:'SET',payload:{sleepTimerEnd:Date.now()+m*60000}}); notify(`Sleep timer: ${m} minutes`)
    },
  }

  const loadFiles = useCallback(async (files) => {
    const valid = Array.from(files).filter(f=>isMediaFile(f.name))
    if (!valid.length) { notify('No supported files','warning'); return }
    const tracks = await addIndividualFiles(valid)
    const audio=tracks.filter(t=>t.type==='audio'), video=tracks.filter(t=>t.type==='video')
    if(audio.length) controls.addAudio(audio)
    if(video.length) controls.addVideo(video)
    notify(`Added ${tracks.length} file${tracks.length>1?'s':''}`)
  }, [])

  const derived = {
    get currentAudioTrack() { const {audioQueue,audioIndex}=state; return audioIndex!=null?audioQueue[audioIndex]:null },
    get currentVideoTrack() { const {videoQueue,videoIndex}=state; return videoIndex!=null?videoQueue[videoIndex]:null },
    get currentTrack() { return state.activeMode==='audio'?this.currentAudioTrack:this.currentVideoTrack },
    get isPlaying() { return state.activeMode==='audio'?state.audioPlaying:state.videoPlaying },
    get currentTime() { return state.activeMode==='audio'?state.audioTime:state.videoTime },
    get duration() { return state.activeMode==='audio'?state.audioDuration:state.videoDuration },
  }

  return (
    <PlayerContext.Provider value={{ state, dispatch, controls, audioRef, videoRef, audioHandlers, videoHandlers, derived, notify, loadFiles, restoreLastRef }}>
      {children}
    </PlayerContext.Provider>
  )
}

export const usePlayer = () => {
  const ctx = useContext(PlayerContext)
  if (!ctx) throw new Error('usePlayer must be inside PlayerProvider')
  return ctx
}
