import { useNavigate } from 'react-router-dom'
import { usePlayer } from '../context/PlayerContext'
import { EQ_PRESETS, EQ_FREQUENCIES } from '../utils/helpers'

export default function Equalizer() {
  const { state, controls } = usePlayer()
  const { eqEnabled, eqBands, noiseCancelEnabled } = state
  const navigate = useNavigate()

  return (
    <div style={{ minHeight:'100%',background:'var(--navy)',paddingBottom:24 }}>
      <div style={{ padding:'14px 16px',display:'flex',alignItems:'center',justifyContent:'space-between',borderBottom:'1px solid var(--navy-border)' }}>
        <div style={{ display:'flex',alignItems:'center',gap:10 }}>
          <button onClick={()=>navigate(-1)} style={{ color:'var(--muted)',fontSize:16,background:'none',border:'none' }}>←</button>
          <h1 style={{ fontSize:17,fontWeight:700,letterSpacing:2,color:'var(--sky)' }}>EQUALIZER</h1>
        </div>
        <button onClick={()=>controls.toggleEQ()}
          style={{ background:eqEnabled?'var(--blue)':'transparent',border:`1px solid ${eqEnabled?'var(--sky)':'var(--dimmed)'}`,color:eqEnabled?'#fff':'var(--muted)',borderRadius:20,padding:'5px 16px',fontSize:11,fontWeight:700,letterSpacing:1,boxShadow:eqEnabled?'0 0 12px rgba(56,189,248,0.4)':'none' }}>
          {eqEnabled?'ON':'OFF'}
        </button>
      </div>

      {/* Noise cancel */}
      <div style={{ padding:'12px 16px',background:'var(--navy-light)',borderBottom:'1px solid var(--navy-border)',display:'flex',alignItems:'center',gap:12 }}>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:13,color:'var(--white)',fontWeight:600 }}>🎧 Noise Cancellation</div>
          <div style={{ fontSize:10,color:'var(--dimmed)',marginTop:2 }}>High-pass 60Hz · Low-pass 18kHz · Dynamics compressor</div>
        </div>
        <div onClick={()=>controls.toggleNoiseCancel()}
          style={{ width:46,height:26,borderRadius:13,background:noiseCancelEnabled?'var(--blue)':'var(--dimmed)',position:'relative',cursor:'pointer',transition:'background 0.2s',boxShadow:noiseCancelEnabled?'0 0 8px rgba(56,189,248,0.5)':'none',flexShrink:0 }}>
          <div style={{ position:'absolute',top:3,left:noiseCancelEnabled?23:3,width:20,height:20,borderRadius:'50%',background:'#fff',transition:'left 0.2s',boxShadow:'0 1px 4px rgba(0,0,0,0.4)' }}/>
        </div>
      </div>

      {/* Presets */}
      <div style={{ padding:'12px 16px',borderBottom:'1px solid var(--navy-border)' }}>
        <div style={{ fontSize:10,color:'var(--muted)',letterSpacing:1,marginBottom:8,fontWeight:600 }}>PRESETS</div>
        <div style={{ display:'flex',gap:6,overflowX:'auto',paddingBottom:4 }}>
          {Object.entries(EQ_PRESETS).map(([key,preset])=>(
            <button key={key} onClick={()=>controls.setEQPreset(preset.bands)}
              style={{ flexShrink:0,background:'var(--navy-light)',border:'1px solid var(--navy-border)',color:'var(--muted)',borderRadius:6,padding:'6px 12px',fontSize:11,fontWeight:600 }}>
              {preset.name}
            </button>
          ))}
        </div>
      </div>

      {/* Bands */}
      <div style={{ padding:'16px' }}>
        <div style={{ display:'flex',alignItems:'flex-end',justifyContent:'space-between',height:200,gap:4 }}>
          {EQ_FREQUENCIES.map((freq,i)=>{
            const val=eqBands[i]??0, pct=((val+12)/24)*100
            const label=freq>=1000?`${freq/1000}k`:`${freq}`
            return (
              <div key={freq} style={{ flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:5,height:'100%' }}>
                <span style={{ fontSize:9,color:val>0?'var(--sky)':val<0?'var(--muted)':'var(--dimmed)',fontFamily:'monospace',fontWeight:700,minHeight:14 }}>
                  {val>0?`+${val}`:val===0?'':val}
                </span>
                <div style={{ flex:1,display:'flex',alignItems:'center',justifyContent:'center' }}>
                  <input type="range" min={-12} max={12} step={1} value={val}
                    onChange={e=>controls.setEQBand(i,parseInt(e.target.value))}
                    disabled={!eqEnabled}
                    style={{ writingMode:'vertical-lr',direction:'rtl',height:140,width:24,cursor:eqEnabled?'pointer':'not-allowed',opacity:eqEnabled?1:0.35,background:`linear-gradient(to top,var(--sky) ${pct}%,var(--dimmed) ${pct}%)` }}/>
                </div>
                <span style={{ fontSize:8,color:'var(--dimmed)',letterSpacing:-0.3,fontFamily:'monospace' }}>{label}</span>
              </div>
            )
          })}
        </div>
        <div style={{ display:'flex',justifyContent:'space-between',marginTop:8,paddingTop:8,borderTop:'1px solid var(--navy-border)' }}>
          <span style={{ fontSize:10,color:'var(--dimmed)' }}>-12 dB</span>
          <span style={{ fontSize:10,color:'var(--dimmed)' }}>0 dB</span>
          <span style={{ fontSize:10,color:'var(--dimmed)' }}>+12 dB</span>
        </div>
      </div>

      <div style={{ padding:'0 16px' }}>
        <button onClick={()=>controls.setEQPreset([0,0,0,0,0,0,0,0,0,0])}
          style={{ width:'100%',background:'transparent',border:'1px solid var(--navy-border)',color:'var(--muted)',borderRadius:8,padding:'10px',fontSize:12,fontWeight:600,letterSpacing:1,fontFamily:'inherit' }}>
          RESET TO FLAT
        </button>
      </div>
    </div>
  )
}
