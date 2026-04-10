/* ═══════════════════════════════════════════════════════════
 * ANIMATION STORYBOARD  —  Card Funding Interaction
 * ═══════════════════════════════════════════════════════════
 *
 *  ── IDLE ─────────────────────────────────────────────────
 *       –  Euro +1.99°  Dollar -4.09°  Naira clipped 146px
 *
 *  ── HOVER ────────────────────────────────────────────────
 *       0ms   Naira springs first  y:0→-50  scale:1→0.86  bounce:0.7
 *      60ms   Dollar follows       y:0→-36  scale:1→0.88
 *     120ms   Euro last            y:0→-22  scale:1→0.90, fans wider
 *             Scale-down keeps 3D-tilted cards inside 343px wallet.
 *             GSAP 3D tilt + holographic shimmer per-card
 *
 *  ── ADD MONEY (Calendar-style inline expansion) ───────────
 *       0ms   wallet slides UP + fades: y→-52, scale→0.93 (320ms ease-in-out)
 *       0ms   container layout-morphs height (spring duration:0.58 bounce:0.1)
 *       0ms   border-radius: 32→20 (same spring)
 *      50ms   sheet slides in from below: y:28→0 (spring duration:0.5)
 *     120ms   mini wallet thumbnail fades in   (y:10→0)
 *     180ms   amount display slides up
 *     260ms   stepper slides up
 *     320ms   breakdown slides up
 *     400ms   proceed button slides up
 *       –     +/− : number crossfades (popLayout)
 *       –     Close → sheet exits down, container collapses, wallet springs in from below
 *
 *  ── SUCCESS ──────────────────────────────────────────────
 *       0ms   overlay fades in
 *     100ms   check pops  (spring bounce:0.45)
 *     250ms   text slides up
 *    2000ms   auto-reset
 *
 * ═══════════════════════════════════════════════════════════ */

import {
  useRef, useState, useCallback, useEffect, useLayoutEffect,
} from 'react'
import {
  motion, AnimatePresence, useReducedMotion,
  useMotionValue, useTransform, animate,
} from 'framer-motion'
import gsap from 'gsap'

// ─── SPRING CONFIGS ───────────────────────────────────────
const SPRING_LAYOUT = { type: 'spring' as const, duration: 0.58, bounce: 0.1 }

const SPRINGS = {
  hover:  { type: 'spring' as const, visualDuration: 0.5,  bounce: 0.7  },
  settle: { type: 'spring' as const, visualDuration: 0.5,  bounce: 0.2  },
  pop:    { type: 'spring' as const, visualDuration: 0.4,  bounce: 0.45 },
}

// ─── CARD ROTATIONS ──────────────────────────────────────
const IDLE_ROTATE  = [1.99, -4.09, 0]
const HOVER_ROTATE = [6, -9, 0]

// ─── HOVER LIFT ──────────────────────────────────────────
//  Scale DOWN on hover so 3D-tilted cards stay inside the 343px
//  wallet boundary. Front card (highest lift) scales most, back least.
const HOVER_LIFT  = [
  { y: -22, scale: 0.90 },   // Euro  — back,  least lift  → least shrink
  { y: -36, scale: 0.88 },   // Dollar — mid
  { y: -50, scale: 0.86 },   // Naira — front, most lift   → most shrink
]
const HOVER_DELAY = [0.12, 0.06, 0]

// ─── HOVER CONFIG ────────────────────────────────────────
const HOVER = {
  wallet: { maxTilt: 4, duration: 0.5 },
  cards: [
    { maxX: 5,  maxY: 7,  duration: 0.55 },
    { maxX: 9,  maxY: 12, duration: 0.45 },
    { maxX: 14, maxY: 18, duration: 0.35 },
  ],
  shimmerOpacity: 0.28,
  resetDuration:  0.7,
  resetEase:      'elastic.out(1, 0.5)',
}

// ─── CARD DATA ────────────────────────────────────────────
const CARDS = [
  { id: 'euro',   label: 'Euro',   symbol: '€', amount: '50,000', color: '#f02d55' },
  { id: 'dollar', label: 'Dollar', symbol: '$', amount: '50,000', color: '#2cac4d' },
  { id: 'naira',  label: 'Naira',  symbol: '₦', amount: '50,000', color: '#f5841e' },
]

const TEXTURE = 'https://www.figma.com/api/mcp/asset/8bc77c6b-4413-48df-9b5e-0baf2e2f40ae'
const SUCCESS_RESET = 2000

// ─── HELPERS ─────────────────────────────────────────────
const inter = (w: number, s: number, lh: string, c: string, x?: React.CSSProperties): React.CSSProperties => ({
  fontFamily: "'Inter', sans-serif", fontWeight: w, fontSize: s,
  lineHeight: lh, color: c, margin: 0,
  fontFeatureSettings: "'ss11' 1,'calt' 0,'liga' 0", ...x,
})

// Staggered content helper — matches Calendar animation pattern
const cv = (delay: number) => ({
  initial:    { opacity: 0, y: 12 },
  animate:    { opacity: 1, y: 0  },
  exit:       { opacity: 0, y: -6, transition: { duration: 0.07 } },
  transition: { duration: 0.24, ease: [0.165, 0.84, 0.44, 1] as const, delay },
})

// ─── CARD BODY ────────────────────────────────────────────
interface CardBodyProps {
  card: typeof CARDS[number]
  shimmerRef: (el: HTMLDivElement | null) => void
  style?: React.CSSProperties
}

function CardBody({ card, shimmerRef, style }: CardBodyProps) {
  return (
    <div style={{
      width: 309.202, height: 187.257, background: card.color,
      borderRadius: 11.17, overflow: 'hidden', position: 'relative',
      flexShrink: 0, ...style,
    }}>
      <div aria-hidden style={{
        position: 'absolute', inset: 0, borderRadius: 11.17, pointerEvents: 'none',
        boxShadow: [
          'inset 0 2px 0 rgba(255,255,255,0.55)',
          'inset 0 -1px 0 rgba(255,255,255,0.12)',
          'inset 2px 0 8px rgba(255,255,255,0.08)',
          'inset -2px 0 8px rgba(255,255,255,0.08)',
          'inset 0 0 28px rgba(255,255,255,0.06)',
        ].join(', '),
      }} />
      <div aria-hidden style={{
        position: 'absolute', inset: 0, borderRadius: 11.17, pointerEvents: 'none',
        background: 'linear-gradient(150deg, rgba(255,255,255,0.18) 0%, transparent 45%)',
      }} />
      <p style={inter(700, 14, '20px', '#fff', {
        position: 'absolute', top: 14, left: 16, letterSpacing: '-0.3px',
        textShadow: '0 1px 3px rgba(0,0,0,0.25)',
      })}>{card.label}</p>
      <p style={inter(700, 14, '20px', '#fff', {
        position: 'absolute', top: 14, right: 16, letterSpacing: '-0.3px',
        textShadow: '0 1px 3px rgba(0,0,0,0.25)', whiteSpace: 'nowrap',
        fontVariantNumeric: 'tabular-nums',
      })}>{card.symbol}{card.amount}</p>
      <div ref={shimmerRef} aria-hidden style={{
        position: 'absolute', inset: 0, opacity: 0, pointerEvents: 'none',
        mixBlendMode: 'overlay', borderRadius: 11.17, transition: 'opacity 0.3s ease',
        background: 'linear-gradient(105deg, transparent 20%, rgba(255,255,255,0.3) 50%, transparent 80%)',
      }} />
    </div>
  )
}

// ─── MINI WALLET ASSETS ──────────────────────────────────
const MW = {
  texture:       '/mini-wallet/texture.png',
  cardDeco:      '/mini-wallet/card-deco.svg',       // corner deco (orange + green)
  cardDecoWhite: '/mini-wallet/card-deco-white.svg', // corner deco (white)
  apexA:         '/mini-wallet/apex-a.svg',
  apexB:         '/mini-wallet/apex-b.svg',
  mcLeft:        '/mini-wallet/mc-left.svg',
  mcRight:       '/mini-wallet/mc-right.svg',
  mcOverlap:     '/mini-wallet/mc-overlap.svg',
}

// Shared Apex logo (top-left of each card)
function CardApex() {
  return (
    <div style={{
      position:'absolute', left:1.92, top:1.92,
      width:3.235, height:3.235, borderRadius:10.404,
      background:'#335cff', overflow:'hidden',
    }}>
      <div style={{ position:'absolute', inset:'40.83% 14.94% 22.5% 29.94%' }}>
        <img alt="" src={MW.apexA} style={{ display:'block', width:'100%', height:'100%', maxWidth:'none' }} />
      </div>
      <div style={{ position:'absolute', inset:'22.5% 34.77% 40.83% 14.77%' }}>
        <img alt="" src={MW.apexB} style={{ display:'block', width:'100%', height:'100%', maxWidth:'none' }} />
      </div>
    </div>
  )
}

// Shared Mastercard logo (top-right of each card)
function CardMastercard() {
  return (
    <div style={{ position:'absolute', right:1.92, top:1.92, width:3.235, height:3.235, overflow:'hidden' }}>
      <div style={{ position:'absolute', inset:'23.75% 41.25% 23.75% 6.25%' }}>
        <img alt="" src={MW.mcLeft} style={{ display:'block', width:'100%', height:'100%', maxWidth:'none' }} />
      </div>
      <div style={{ position:'absolute', inset:'23.75% 6.25% 23.75% 41.25%' }}>
        <img alt="" src={MW.mcRight} style={{ display:'block', width:'100%', height:'100%', maxWidth:'none' }} />
      </div>
      <div style={{ position:'absolute', inset:'30.44% 41.25% 30.43% 41.25%' }}>
        <img alt="" src={MW.mcOverlap} style={{ display:'block', width:'100%', height:'100%', maxWidth:'none' }} />
      </div>
    </div>
  )
}

// ─── MINI WALLET ─────────────────────────────────────────
function MiniWallet() {
  return (
    // Shadow lives on outer; overflow:hidden on inner clips rotated cards
    <div style={{
      position: 'relative', width: 75.922, height: 57.329, flexShrink: 0,
      borderRadius: 7.083,
      boxShadow: '0px 0.101px 0.202px 0px rgba(14,18,27,0.24), 0px 0px 0px 0.101px #2547d0',
    }}>
      <div style={{ position:'absolute', inset:0, borderRadius:7.083, overflow:'hidden' }}>

        {/* Wallet shell */}
        <div style={{
          position:'absolute', inset:0, background:'#19242e', borderRadius:7.083,
          border:'0.051px solid rgba(255,255,255,0.1)',
        }} />

        {/* Card 1 — orange, back, rotate +1.99° */}
        <div style={{
          position:'absolute', left:2.82, top:-5.85, width:69.839, height:43.801,
          display:'flex', alignItems:'center', justifyContent:'center',
        }}>
          <div style={{ transform:'rotate(1.99deg)', flexShrink:0 }}>
            <div style={{
              width:68.441, height:41.449, background:'#f5841e',
              borderRadius:2.472, overflow:'hidden', position:'relative',
              border:'0.101px solid rgba(255,255,255,0.1)',
              boxShadow:'0px 0.101px 0.303px 0px rgba(14,18,27,0.12),0px 0px 0px 0.101px #e1e4ea',
            }}>
              {/* Corner deco ×2 */}
              <div style={{ position:'absolute', width:31.946, height:21.129, right:-22.54, top:-14.36 }}>
                <div style={{ position:'absolute', inset:'0 2.59%' }}>
                  <img alt="" src={MW.cardDeco} style={{ display:'block', width:'100%', height:'100%', maxWidth:'none' }} />
                </div>
              </div>
              <div style={{ position:'absolute', width:31.946, height:21.129, right:-26.39, top:-8.19 }}>
                <div style={{ position:'absolute', inset:'0 2.59%' }}>
                  <img alt="" src={MW.cardDeco} style={{ display:'block', width:'100%', height:'100%', maxWidth:'none' }} />
                </div>
              </div>
              <CardApex />
              <CardMastercard />
              <p style={{ position:'absolute', bottom:5.76, left:1.92, transform:'translateY(100%)',
                fontFamily:"'Geist','Geist Medium',sans-serif", fontWeight:500, fontSize:3.24,
                lineHeight:'4.044px', color:'#0e121b', letterSpacing:'-0.0162px', whiteSpace:'nowrap',
              }}>*********</p>
              <p style={{ position:'absolute', bottom:8.19, left:1.92, transform:'translateY(100%)',
                fontFamily:"'Inter',sans-serif", fontWeight:400, fontSize:1.42,
                lineHeight:'2.022px', color:'#525866', letterSpacing:'-0.0085px', whiteSpace:'nowrap',
              }}>Savings Card</p>
            </div>
          </div>
        </div>

        {/* Card 2 — green, mid, rotate −4.09° */}
        <div style={{
          position:'absolute', left:2.13, top:0.03, width:71.22, height:46.22,
          display:'flex', alignItems:'center', justifyContent:'center',
        }}>
          <div style={{ transform:'rotate(-4.09deg)', flexShrink:0 }}>
            <div style={{
              width:68.441, height:41.449, background:'#2cac4d',
              borderRadius:2.472, overflow:'hidden', position:'relative',
              border:'0.101px solid rgba(255,255,255,0.1)',
              boxShadow:'0px 0.101px 0.303px 0px rgba(14,18,27,0.12),0px 0px 0px 0.101px #e1e4ea',
            }}>
              <div style={{ position:'absolute', width:31.946, height:21.129, right:-22.54, top:-14.36 }}>
                <div style={{ position:'absolute', inset:'0 2.59%' }}>
                  <img alt="" src={MW.cardDeco} style={{ display:'block', width:'100%', height:'100%', maxWidth:'none' }} />
                </div>
              </div>
              <div style={{ position:'absolute', width:31.946, height:21.129, right:-26.39, top:-8.19 }}>
                <div style={{ position:'absolute', inset:'0 2.59%' }}>
                  <img alt="" src={MW.cardDeco} style={{ display:'block', width:'100%', height:'100%', maxWidth:'none' }} />
                </div>
              </div>
              <CardApex />
              <CardMastercard />
              <p style={{ position:'absolute', bottom:5.76, left:1.92, transform:'translateY(100%)',
                fontFamily:"'Geist','Geist Medium',sans-serif", fontWeight:500, fontSize:3.24,
                lineHeight:'4.044px', color:'#0e121b', letterSpacing:'-0.0162px', whiteSpace:'nowrap',
              }}>*********</p>
              <p style={{ position:'absolute', bottom:8.19, left:1.92, transform:'translateY(100%)',
                fontFamily:"'Inter',sans-serif", fontWeight:400, fontSize:1.42,
                lineHeight:'2.022px', color:'#525866', letterSpacing:'-0.0085px', whiteSpace:'nowrap',
              }}>Savings Card</p>
            </div>
          </div>
        </div>

        {/* Card 3 — white, front, clipped to 32.316px height */}
        <div style={{
          position:'absolute', left:3.76, top:10.85, width:68.396, height:32.316,
          background:'#ffffff', borderRadius:2.472, overflow:'hidden',
          border:'0.101px solid #e1e4ea',
          boxShadow:'0px 0.101px 0.303px 0px rgba(14,18,27,0.12),0px 0px 0px 0.101px #e1e4ea',
        }}>
          <div style={{ position:'absolute', width:31.946, height:21.129, right:-22.54, top:-14.36 }}>
            <div style={{ position:'absolute', inset:'0 2.59%' }}>
              <img alt="" src={MW.cardDecoWhite} style={{ display:'block', width:'100%', height:'100%', maxWidth:'none' }} />
            </div>
          </div>
          <div style={{ position:'absolute', width:31.946, height:21.129, right:-26.39, top:-8.19 }}>
            <div style={{ position:'absolute', inset:'0 2.59%' }}>
              <img alt="" src={MW.cardDecoWhite} style={{ display:'block', width:'100%', height:'100%', maxWidth:'none' }} />
            </div>
          </div>
          <CardApex />
          <CardMastercard />
        </div>

        {/* Texture overlay */}
        <div style={{ position:'absolute', left:2.66, top:17.26, width:70.609, height:37.407, pointerEvents:'none' }}>
          <div style={{ position:'absolute', inset:'-0.5% -3.29% -18.05% -3.29%' }}>
            <img alt="" src={MW.texture} width={75.258} height={44.345}
              style={{ display:'block', width:'100%', height:'100%', maxWidth:'none' }} />
          </div>
        </div>

        {/* Balance */}
        <div style={{
          position:'absolute', left:'calc(50% - 0.13px)', top:30.31,
          transform:'translateX(-50%)', width:31.201,
          display:'flex', flexDirection:'column', alignItems:'center',
        }}>
          <div style={{ display:'flex', flexDirection:'column', gap:0.693, width:26.695 }}>
            <p style={inter(500, 6.24, '8.32px', '#fff', { letterSpacing:'-0.094px', fontVariantNumeric:'tabular-nums' })}>
              $98,000
            </p>
            <p style={inter(400, 4.16, '5.547px', 'rgba(255,255,255,0.7)')}>Total balance</p>
          </div>
        </div>

      </div>
    </div>
  )
}

// ─── ODOMETER DIGIT ──────────────────────────────────────
/*
 * Clock-style digit roller — each character slides vertically
 * like an odometer. Direction is determined by the parent
 * (1 = counting up, -1 = counting down).
 *
 *  Structure:
 *    overflow:hidden container (64px tall — matches lineHeight)
 *      AnimatePresence → motion.span slides out/in on key change
 *
 *  Easing: cubic-bezier(0.22, 1, 0.36, 1) — snappy settle
 *  Duration: 0.45s
 */
type OdomDir = 1 | -1

function OdometerDigit({ char, dir }: { char: string; dir: OdomDir }) {
  // Punctuation (decimal point) renders statically — no animation
  if (!/\d/.test(char)) {
    return (
      <span style={{
        fontFamily: "'Inter Display','Inter',sans-serif",
        fontWeight: 500, fontSize: 56, lineHeight: '64px',
        color: '#171717', letterSpacing: '-0.56px',
        display: 'inline-block', verticalAlign: 'bottom',
        fontFeatureSettings: "'ss11' 1,'calt' 0,'liga' 0",
      }}>{char}</span>
    )
  }
  return (
    // Fixed-height window — only one digit visible at a time
    <span style={{
      display: 'inline-block', overflow: 'hidden',
      height: 64, verticalAlign: 'bottom', position: 'relative',
    }}>
      <AnimatePresence initial={false} mode="popLayout" custom={dir}>
        <motion.span
          key={char}
          custom={dir}
          variants={{
            // Counting up  → enter from below, exit through top
            // Counting down → enter from above, exit through bottom
            initial: (d: OdomDir) => ({ y: d > 0 ? '110%' : '-110%', opacity: 0 }),
            animate: { y: '0%', opacity: 1 },
            exit:    (d: OdomDir) => ({ y: d > 0 ? '-110%' : '110%', opacity: 0 }),
          }}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          style={{
            display: 'block',
            fontFamily: "'Inter Display','Inter',sans-serif",
            fontWeight: 500, fontSize: 56, lineHeight: '64px',
            color: '#171717', letterSpacing: '-0.56px',
            fontVariantNumeric: 'tabular-nums',
            fontFeatureSettings: "'ss11' 1,'calt' 0,'liga' 0",
          }}
        >
          {char}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}

// ─── SHEET CONTENT (inline, no fixed overlay) ────────────
const SD = { wallet: 0.12, amount: 0.19, stepper: 0.27, breakdown: 0.34, button: 0.42 }

const MIN_AMOUNT  = 1
const MAX_AMOUNT  = 200
const SHEET_FEE   = 1
// Slider dimensions from Figma (node 202353:373057)
const FILL_INSET  = 4   // fill left/top inset from container edge
const FILL_H      = 52  // fill height
const THUMB_W     = 8   // drag thumb width
const THUMB_H     = 44  // drag thumb height

interface SheetContentProps {
  onClose:   () => void
  onProceed: (label: string) => void
}

function SheetContent({ onClose, onProceed }: SheetContentProps) {
  const [value, setValue]         = useState(69)
  const [odomDir, setOdomDir]     = useState<OdomDir>(1)
  const [trackHovered, setTrackHovered] = useState(false)
  const prevVal    = useRef(69)
  const isDragging = useRef(false)
  const total = value + SHEET_FEE

  // ── Fill-grow slider ──────────────────────────────────────
  //
  //  Track (trackRef): full stepper width, bg #f7f7f7, h:60px
  //  Fill (fillW)    : grows left→right as value increases
  //    min fw = FILL_INSET + THUMB_W  (thumb at left inset)
  //    max fw = trackW - FILL_INSET   (fill reaches right inset)
  //  Thumb: narrow pill at fill's right edge, dragged via pointer capture
  //
  const trackRef  = useRef<HTMLDivElement>(null)
  const fillW     = useMotionValue(0)   // px, initialised after mount
  const thumbLeft = useTransform(fillW, fw => Math.max(FILL_INSET, fw - THUMB_W))

  const valToFW = useCallback((v: number, tw: number) => {
    const range = tw - 2 * FILL_INSET - THUMB_W
    return FILL_INSET + THUMB_W + ((v - MIN_AMOUNT) / (MAX_AMOUNT - MIN_AMOUNT)) * range
  }, [])

  const fwToVal = useCallback((fw: number, tw: number) => {
    const range = tw - 2 * FILL_INSET - THUMB_W
    const raw   = MIN_AMOUNT + ((fw - FILL_INSET - THUMB_W) / range) * (MAX_AMOUNT - MIN_AMOUNT)
    return Math.max(MIN_AMOUNT, Math.min(MAX_AMOUNT, Math.round(raw)))
  }, [])

  useLayoutEffect(() => {
    if (!trackRef.current) return
    fillW.set(valToFW(69, trackRef.current.clientWidth))
  }, [fillW, valToFW])

  // Central change: value + odometer direction + animated fill
  const changeValue = useCallback((next: number, animateFill = true) => {
    const dir: OdomDir = next >= prevVal.current ? 1 : -1
    setOdomDir(dir)
    prevVal.current = next
    setValue(next)
    if (animateFill && trackRef.current) {
      animate(fillW, valToFW(next, trackRef.current.clientWidth), {
        type: 'spring', visualDuration: 0.3, bounce: 0,
      })
    }
  }, [fillW, valToFW])

  const handleDecrement = useCallback(() => {
    const next = Math.max(MIN_AMOUNT, prevVal.current - 1)
    if (next !== prevVal.current) changeValue(next)
  }, [changeValue])

  const handleIncrement = useCallback(() => {
    const next = Math.min(MAX_AMOUNT, prevVal.current + 1)
    if (next !== prevVal.current) changeValue(next)
  }, [changeValue])

  // ── Pointer-capture drag on thumb ─────────────────────────
  const onThumbPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    isDragging.current = true
  }, [])

  const onThumbPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging.current || !trackRef.current) return
    const rect  = trackRef.current.getBoundingClientRect()
    const x     = e.clientX - rect.left
    const tw    = rect.width
    const minFW = FILL_INSET + THUMB_W
    const maxFW = tw - FILL_INSET
    const fw    = Math.max(minFW, Math.min(maxFW, x + THUMB_W / 2))
    fillW.set(fw)
    const next = fwToVal(fw, tw)
    if (next !== prevVal.current) {
      setOdomDir(next > prevVal.current ? 1 : -1)
      prevVal.current = next
      setValue(next)
    }
  }, [fillW, fwToVal])

  const onThumbPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.releasePointerCapture(e.pointerId)
    isDragging.current = false
    // If pointer released outside the track, hide fill
    if (trackRef.current) {
      const rect = trackRef.current.getBoundingClientRect()
      const outside = e.clientX < rect.left || e.clientX > rect.right ||
                      e.clientY < rect.top  || e.clientY > rect.bottom
      if (outside) setTrackHovered(false)
    }
  }, [])

  // ── Odometer: split formatted value into chars ────────────
  const chars = value.toFixed(2).split('')

  return (
    <div style={{ background: '#ffffff', width: '100%' }}>

      {/* Top: mini wallet + close */}
      <motion.div {...cv(SD.wallet)} style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        padding: '16px 16px 0',
      }}>
        <MiniWallet />
        <motion.button
          onClick={onClose}
          whileTap={{ scale: 0.88 }}
          transition={{ type: 'spring', visualDuration: 0.2, bounce: 0 }}
          aria-label="Close"
          style={{
            width: 28, height: 28, borderRadius: '50%', border: 'none',
            background: '#f0f0f0', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#5c5c5c', flexShrink: 0,
          }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
            <path d="M10 2L2 10M2 2l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </motion.button>
      </motion.div>

      {/* ── Hero amount — odometer digit roller ─────────────── */}
      <motion.div {...cv(SD.amount)} style={{
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        gap: 4, padding: '24px 16px 20px',
      }}>
        {/* $ — Inter Display 20px, soft gray, from Figma */}
        <span style={{
          fontFamily: "'Inter Display', 'Inter', sans-serif",
          fontWeight: 500, fontSize: 20, lineHeight: '28px',
          color: '#a3a3a3', paddingBottom: 10, margin: 0,
          fontFeatureSettings: "'ss11' 1,'calt' 0,'liga' 0",
        }}>$</span>
        {/* Each digit rolls independently like an odometer */}
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          {chars.map((char, i) => (
            <OdometerDigit key={i} char={char} dir={odomDir} />
          ))}
        </div>
      </motion.div>

      {/* ── Stepper — fill-grow slider ──────────────────────── */}
      <motion.div {...cv(SD.stepper)} style={{ padding: '0 16px' }}>
        {/*
          Track (60px tall): bg #f7f7f7, rounded-16
          Fill: bg #ebebeb, grows from left, rounded-12, h:52 inset 4px
          Thumb: narrow 8×44px pill at fill's right edge — pointer-capture drag
          Buttons + label overlay at z:3, above fill and thumb
        */}
        <div
          ref={trackRef}
          onMouseEnter={() => setTrackHovered(true)}
          onMouseLeave={() => { if (!isDragging.current) setTrackHovered(false) }}
          style={{
            background: '#f7f7f7', borderRadius: 16,
            height: FILL_H + 2 * FILL_INSET,
            position: 'relative', userSelect: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0 8px',
          }}
        >
          {/* Fill — always visible, grows with value */}
          <motion.div style={{
            position: 'absolute', left: FILL_INSET, top: FILL_INSET,
            height: FILL_H, borderRadius: 12,
            background: '#ebebeb', width: fillW,
            pointerEvents: 'none',
          }} />

          {/* Thumb — only appears on hover, sits at fill's right edge */}
          <motion.div
            animate={{ opacity: trackHovered ? 1 : 0 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            onPointerDown={onThumbPointerDown}
            onPointerMove={onThumbPointerMove}
            onPointerUp={onThumbPointerUp}
            style={{
              position: 'absolute',
              top: (FILL_H + 2 * FILL_INSET - THUMB_H) / 2,
              left: thumbLeft,
              width: THUMB_W, height: THUMB_H,
              borderRadius: 8, background: '#d1d1d1',
              cursor: trackHovered ? 'ew-resize' : 'default',
              zIndex: 2, touchAction: 'none',
              pointerEvents: trackHovered ? 'auto' : 'none',
            }}
          />

          {/* Minus */}
          <motion.button
            onClick={handleDecrement}
            whileTap={{ scale: 0.82 }}
            transition={{ type: 'spring', visualDuration: 0.18, bounce: 0 }}
            aria-label="Decrease amount"
            style={{
              position: 'relative', zIndex: 3,
              width: 40, height: 40, border: 'none',
              background: 'transparent', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#171717', flexShrink: 0,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path d="M3 8h10" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
            </svg>
          </motion.button>

          {/* Value label — fixed width prevents layout shift */}
          <span style={inter(500, 20, '28px', '#171717', {
            fontVariantNumeric: 'tabular-nums', position: 'relative', zIndex: 3,
            width: 79, textAlign: 'center', flexShrink: 0,
          })}>
            ${value.toFixed(2)}
          </span>

          {/* Plus */}
          <motion.button
            onClick={handleIncrement}
            whileTap={{ scale: 0.82 }}
            transition={{ type: 'spring', visualDuration: 0.18, bounce: 0 }}
            aria-label="Increase amount"
            style={{
              position: 'relative', zIndex: 3,
              width: 40, height: 40, border: 'none',
              background: 'transparent', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#171717', flexShrink: 0,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path d="M3 8h10M8 3v10" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
            </svg>
          </motion.button>
        </div>
      </motion.div>

      {/* ── Breakdown ───────────────────────────────────────── */}
      <motion.div {...cv(SD.breakdown)} style={{
        margin: '12px 16px 0', background: '#f7f7f7',
        borderRadius: 16, padding: 12,
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        {[
          { label: 'Amount', val: `$${value.toFixed(2)}` },
          { label: 'Fees',   val: `$${SHEET_FEE.toFixed(2)}` },
        ].map(({ label, val }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={inter(400, 14, '20px', '#5c5c5c', { letterSpacing: '-0.084px' })}>{label}</span>
            <span style={inter(500, 16, '24px', '#171717', { letterSpacing: '-0.176px', fontVariantNumeric: 'tabular-nums' })}>{val}</span>
          </div>
        ))}
        {/* Divider — #ebebeb from Figma */}
        <div style={{ height: 1, background: '#ebebeb' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={inter(400, 14, '20px', '#5c5c5c', { letterSpacing: '-0.084px' })}>Total</span>
          <span style={inter(500, 16, '24px', '#171717', { letterSpacing: '-0.176px', fontVariantNumeric: 'tabular-nums' })}>
            ${total.toFixed(2)}
          </span>
        </div>
      </motion.div>

      {/* ── Proceed — 40px height, 8px radius from Figma ────── */}
      <motion.div {...cv(SD.button)} style={{ padding: '12px 16px 0' }}>
        <motion.button
          onClick={() => onProceed(`$${value.toFixed(2)}`)}
          whileTap={{ scale: 0.98 }}
          transition={{ type: 'spring', visualDuration: 0.2, bounce: 0 }}
          style={{
            width: '100%',
            height: 40,           // Figma: 40px
            borderRadius: 8,      // Figma: 8px
            border: 'none',
            background: '#171717',
            cursor: 'pointer',
            position: 'relative', overflow: 'hidden',
            boxShadow: [
              '0px 0px 0px 0.75px #171717',
              '0px 1px 3px -1.5px rgba(51,51,51,0.16)',
              '0px 5px 5px -2.5px rgba(51,51,51,0.08)',
              '0px 12px 6px -6px rgba(51,51,51,0.02)',
              '0px 16px 8px -8px rgba(51,51,51,0.01)',
            ].join(', '),
          }}
        >
          {/* Gradient overlay from Figma: 179.99°, white 15.4%, 6.67% → 103.33% */}
          <div aria-hidden style={{
            position: 'absolute', inset: 0, borderRadius: 'inherit', pointerEvents: 'none',
            background: 'linear-gradient(179.99deg, rgba(255,255,255,0.154) 6.67%, rgba(255,255,255,0) 103.33%)',
          }} />
          <div aria-hidden style={{
            position: 'absolute', inset: 0, borderRadius: 'inherit', pointerEvents: 'none',
            boxShadow: 'inset 0px 1px 2px 0px rgba(255,255,255,0.16)',
          }} />
          <span style={inter(500, 14, '20px', '#fff', { position: 'relative', letterSpacing: '-0.084px' })}>
            Proceed
          </span>
        </motion.button>
      </motion.div>

      {/* Home indicator */}
      <div style={{ height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 132, height: 5, background: '#ebebeb', borderRadius: 100 }} />
      </div>

      {/* Inner edge shadow */}
      <div aria-hidden style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', borderRadius: 'inherit',
        boxShadow: 'inset 0px -0.5px 0.5px 0px rgba(51,51,51,0.08)',
      }} />
    </div>
  )
}

// ─── MAIN COMPONENT ──────────────────────────────────────
type Stage = 'idle' | 'sheet' | 'success'

export default function CardFunding() {
  const [stage, setStage]           = useState<Stage>('idle')
  const [isHovered, setIsHovered]   = useState(false)
  const [successAmt, setSuccessAmt] = useState('')
  const shouldReduceMotion          = useReducedMotion()

  const deckRef     = useRef<HTMLDivElement>(null)
  const wrapperRefs = useRef<(HTMLDivElement | null)[]>([null, null, null])
  const shimmerRefs = useRef<(HTMLDivElement | null)[]>([null, null, null])
  const quickToX    = useRef<(gsap.QuickToFunc | null)[]>([null, null, null])
  const quickToY    = useRef<(gsap.QuickToFunc | null)[]>([null, null, null])

  useLayoutEffect(() => {
    if (shouldReduceMotion) return
    wrapperRefs.current.forEach((el, i) => {
      if (!el) return
      gsap.set(el, { transformPerspective: 900 })
      quickToX.current[i] = gsap.quickTo(el, 'rotateY', { duration: HOVER.cards[i].duration, ease: 'power3.out' })
      quickToY.current[i] = gsap.quickTo(el, 'rotateX', { duration: HOVER.cards[i].duration, ease: 'power3.out' })
    })
  }, [shouldReduceMotion])

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (stage !== 'idle' || shouldReduceMotion) return
    const rect = deckRef.current?.getBoundingClientRect()
    if (!rect) return
    const dx = ((e.clientX - rect.left) / rect.width  - 0.5) * 2
    const dy = ((e.clientY - rect.top)  / rect.height - 0.5) * 2
    const angle = Math.atan2(dy, dx) * (180 / Math.PI)
    gsap.to(deckRef.current, {
      rotateX: -dy * HOVER.wallet.maxTilt, rotateY: dx * HOVER.wallet.maxTilt,
      duration: HOVER.wallet.duration, ease: 'power2.out', transformPerspective: 1200,
    })
    wrapperRefs.current.forEach((el, i) => {
      if (!el) return
      const cfg = HOVER.cards[i]
      quickToX.current[i]?.(dx * cfg.maxY)
      quickToY.current[i]?.(-dy * cfg.maxX)
      const sh = shimmerRefs.current[i]
      if (sh) {
        sh.style.background = `linear-gradient(${angle + 90}deg, transparent 15%, rgba(255,255,255,${HOVER.shimmerOpacity}) 50%, transparent 85%)`
        sh.style.opacity = '1'
      }
    })
  }, [stage, shouldReduceMotion])

  const onMouseEnter = useCallback(() => {
    if (stage !== 'idle' || shouldReduceMotion) return
    setIsHovered(true)
  }, [stage, shouldReduceMotion])

  const onMouseLeave = useCallback(() => {
    setIsHovered(false)
    if (shouldReduceMotion) return
    wrapperRefs.current.forEach(el => {
      if (el) gsap.to(el, { rotateX: 0, rotateY: 0, duration: HOVER.resetDuration, ease: HOVER.resetEase })
    })
    shimmerRefs.current.forEach(sh => { if (sh) sh.style.opacity = '0' })
    if (deckRef.current) gsap.to(deckRef.current, { rotateX: 0, rotateY: 0, duration: HOVER.resetDuration, ease: HOVER.resetEase })
  }, [shouldReduceMotion])

  useEffect(() => {
    if (stage !== 'idle') {
      setIsHovered(false)
      wrapperRefs.current.forEach(el => {
        if (el) gsap.to(el, { rotateX: 0, rotateY: 0, duration: 0.3, ease: 'power2.out' })
      })
      shimmerRefs.current.forEach(sh => { if (sh) sh.style.opacity = '0' })
      if (deckRef.current) gsap.to(deckRef.current, { rotateX: 0, rotateY: 0, duration: 0.3 })
    }
  }, [stage])

  const cardAnimate = (i: number) => {
    if (isHovered) return { y: HOVER_LIFT[i].y, scale: HOVER_LIFT[i].scale, rotate: HOVER_ROTATE[i] }
    return { y: 0, scale: 1, rotate: IDLE_ROTATE[i] }
  }
  const cardTransition = (i: number) =>
    isHovered ? { ...SPRINGS.hover, delay: HOVER_DELAY[i] } : SPRINGS.settle

  // ── RENDER ───────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100svh' }}>

      {/* ── Layout container — the Calendar animation pattern ──
          motion.div layout handles height morph via spring.
          overflow:hidden clips content during transition.
          width is consistent (390) for both wallet and sheet.
          borderRadius animates from 32 (wallet) to 20 (sheet). */}
      <motion.div
        layout
        animate={{ borderRadius: stage === 'sheet' ? 20 : 32 }}
        style={{
          width: 390,
          overflow: 'hidden',
          boxShadow: stage === 'sheet'
            ? '0px 0px 0px 1px rgba(51,51,51,0.04), 0px 12px 6px -6px rgba(51,51,51,0.02), 0px 5px 5px -2.5px rgba(51,51,51,0.08), 0px 1px 3px -1.5px rgba(51,51,51,0.16)'
            : 'none',
        }}
        transition={{ layout: SPRING_LAYOUT, borderRadius: SPRING_LAYOUT, boxShadow: { duration: 0.2 } }}
      >
        <AnimatePresence mode="popLayout" initial={false}>

          {stage !== 'sheet' ? (

            /* ── WALLET VIEW ─────────────────────────────────
               paddingTop:80 creates headroom so overflow:hidden
               doesn't clip back cards that bleed above wallet.
               The wallet (343px) is centered inside 390px.
               Exit: slides UP and out — as if the wallet lifted
               away to reveal the sheet expanding beneath it. */
            <motion.div
              key="wallet"
              style={{ paddingTop: 80, position: 'relative' }}
              initial={{ opacity: 0, y: 32 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{
                opacity: 0,
                y: -52,
                scale: 0.93,
                transition: { duration: 0.32, ease: [0.4, 0, 0.55, 1] },
              }}
              transition={{ type: 'spring', duration: 0.52, bounce: 0.24 }}
            >
              {/*
                contain:paint is the CSS spec guarantee that nothing renders outside
                this element's border box — stronger than overflow:hidden because it
                applies at the compositing stage, not just the paint stage.
                paddingTop + negative marginTop creates headroom for cards springing up.
              */}
              <div style={{
                width: 343,
                margin: '0 auto',
                contain: 'paint',
                paddingTop: 70,
                marginTop: -70,
              }}>
              <div
                ref={deckRef}
                onMouseMove={onMouseMove}
                onMouseEnter={onMouseEnter}
                onMouseLeave={onMouseLeave}
                style={{
                  position: 'relative',
                  width: 343, height: 259,
                }}
              >
                {/* Wallet shell */}
                <div style={{
                  position: 'absolute', inset: 0, background: '#19242e', borderRadius: 32,
                  border: '0.228px solid rgba(255,255,255,0.1)',
                  boxShadow: '0px 0.457px 0.913px 0px rgba(14,18,27,0.24), 0px 0px 0px 0.457px #1a262f',
                }} />

                {/* Euro — BACK */}
                <motion.div
                  style={{
                    position: 'absolute', left: 12.74, top: -26.42,
                    width: 315.52, height: 197.885,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1,
                  }}
                  initial={{ rotate: IDLE_ROTATE[0] }}
                  animate={cardAnimate(0)}
                  transition={cardTransition(0)}
                >
                  <div ref={el => { wrapperRefs.current[0] = el }} style={{ flexShrink: 0 }}>
                    <CardBody card={CARDS[0]} shimmerRef={el => { shimmerRefs.current[0] = el }} />
                  </div>
                </motion.div>

                {/* Dollar — MID */}
                <motion.div
                  style={{
                    position: 'absolute', left: 9.62, top: 0.12,
                    width: 321.76, height: 208.813,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2,
                  }}
                  initial={{ rotate: IDLE_ROTATE[1] }}
                  animate={cardAnimate(1)}
                  transition={cardTransition(1)}
                >
                  <div ref={el => { wrapperRefs.current[1] = el }} style={{ flexShrink: 0 }}>
                    <CardBody card={CARDS[1]} shimmerRef={el => { shimmerRefs.current[1] = el }} />
                  </div>
                </motion.div>

                {/* Naira — FRONT, clipped 146px */}
                <motion.div
                  style={{
                    position: 'absolute', left: 17, top: 49, width: 309,
                    borderRadius: 11.17,
                    border: '0.457px solid rgba(255,255,255,0.15)',
                    boxShadow: '0px 0.457px 1.37px 0px rgba(14,18,27,0.12), 0px 0px 0px 0.457px rgba(255,255,255,0.1)',
                    overflow: 'hidden', zIndex: 3,
                  }}
                  animate={isHovered
                    ? { height: 146, y: HOVER_LIFT[2].y, scale: HOVER_LIFT[2].scale, rotate: HOVER_ROTATE[2] }
                    : { height: 146, y: 0, scale: 1, rotate: IDLE_ROTATE[2] }}
                  transition={cardTransition(2)}
                >
                  <div ref={el => { wrapperRefs.current[2] = el }}>
                    <CardBody card={CARDS[2]} shimmerRef={el => { shimmerRefs.current[2] = el }} style={{ borderRadius: 11.17 }} />
                  </div>
                </motion.div>

                {/* Texture — z:6, covers naira seam */}
                <div style={{
                  position: 'absolute', left: 12, top: 78, width: 319, height: 169,
                  zIndex: 6, pointerEvents: 'none', overflow: 'hidden',
                }}>
                  <div style={{ position: 'absolute', top: '-0.5%', right: '-3.29%', bottom: '-18.05%', left: '-3.29%' }}>
                    <img alt="" src={TEXTURE} width={340} height={200.343}
                      style={{ display: 'block', width: '100%', height: '100%', maxWidth: 'none' }} />
                  </div>
                </div>

                {/* Balance + button */}
                <AnimatePresence>
                  {stage === 'idle' && (
                    <motion.div
                      key="balance"
                      style={{
                        position: 'absolute', left: 127, top: 124, width: 90, zIndex: 7,
                        display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center',
                      }}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0, transition: { duration: 0.15 } }}
                      transition={{ duration: 0.3 }}
                    >
                      <div style={{ width: 77, display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <p style={inter(500, 18, '24px', '#fff', { width: '100%', letterSpacing: '-0.27px', fontVariantNumeric: 'tabular-nums' })}>
                          $98,000
                        </p>
                        <p style={inter(400, 12, '16px', 'rgba(255,255,255,0.7)', { width: '100%' })}>
                          Total balance
                        </p>
                      </div>
                      <button
                        onClick={() => setStage('sheet')}
                        aria-label="Add money"
                        style={{
                          position: 'relative', width: '100%', height: 32,
                          display: 'flex', gap: 4, alignItems: 'center', justifyContent: 'center',
                          overflow: 'hidden', padding: 6, borderRadius: 8,
                          border: 'none', background: 'transparent', cursor: 'pointer',
                          boxShadow: '0px 1px 3px 0px rgba(14,18,27,0.12), 0px 0px 0px 1px rgba(255,255,255,0.1)',
                        }}
                      >
                        <div aria-hidden style={{ position: 'absolute', inset: 0, borderRadius: 8, backdropFilter: 'blur(15px)', background: 'rgba(255,255,255,0.1)', pointerEvents: 'none' }} />
                        <p style={inter(500, 13, '20px', '#fff', { position: 'relative', whiteSpace: 'nowrap', padding: '0 4px', letterSpacing: '-0.078px' })}>
                          Add money
                        </p>
                        <div aria-hidden style={{ position: 'absolute', inset: 0, borderRadius: 'inherit', boxShadow: 'inset 0px 0px 4px 2px rgba(255,255,255,0.1)', pointerEvents: 'none' }} />
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Success overlay */}
                <AnimatePresence>
                  {stage === 'success' && (
                    <motion.div
                      key="success"
                      style={{
                        position: 'absolute', inset: 0, zIndex: 20, borderRadius: 32,
                        display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center', gap: 12,
                        backdropFilter: 'blur(10px)', background: 'rgba(25,36,46,0.82)',
                      }}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.22 }}
                    >
                      <motion.div
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ ...SPRINGS.pop, delay: 0.1 }}
                        style={{
                          width: 48, height: 48, borderRadius: '50%',
                          background: 'rgba(44,172,77,0.18)', border: '1px solid rgba(44,172,77,0.4)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                          <motion.path d="M5 13l4 4L19 7" stroke="#2cac4d" strokeWidth="2.5"
                            strokeLinecap="round" strokeLinejoin="round"
                            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                            transition={{ duration: 0.35, delay: 0.2 }} />
                        </svg>
                      </motion.div>
                      <motion.div
                        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}
                        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.28, delay: 0.28 }}
                      >
                        <p style={inter(500, 15, '22px', '#fff')}>{successAmt} added!</p>
                        <p style={inter(400, 12, '18px', 'rgba(255,255,255,0.6)')}>Funds are on their way</p>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>

              </div>
              </div>{/* end GPU-layer clip container */}

              {/* Bottom breathing room so wallet shadow isn't clipped */}
              <div style={{ height: 20 }} />
            </motion.div>

          ) : (

            /* ── SHEET VIEW ──────────────────────────────────
               Inline white card, same width as layout container.
               Enters from below as the container morphs open.
               Exit: fades down — quick so wallet re-entry feels snappy. */
            <motion.div
              key="sheet"
              style={{ position: 'relative' }}
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{
                opacity: 0,
                y: 16,
                scale: 0.97,
                transition: { duration: 0.18, ease: [0.4, 0, 1, 1] },
              }}
              transition={{ type: 'spring', duration: 0.5, bounce: 0.15 }}
            >
              <SheetContent
                onClose={() => setStage('idle')}
                onProceed={(label) => {
                  setSuccessAmt(label)
                  setStage('success')
                  setTimeout(() => setStage('idle'), SUCCESS_RESET)
                }}
              />
            </motion.div>

          )}
        </AnimatePresence>
      </motion.div>

    </div>
  )
}
