import { useRef, useState, type MouseEvent } from 'react'
import { BOARD_ORDER, RINGS, segmentAngle } from '../game/board'
import type { Dart, Multiplier } from '../game/types'
import { dartLabel } from '../game/types'
import { cx } from './ui'

const C = {
  black: '#141312',
  cream: '#efe2bf',
  red: '#d42a2f',
  green: '#1d8a4a',
  wire: '#c9a961',
  surround: '#0b0b0b',
}

function polar(r: number, deg: number): [number, number] {
  const a = (deg * Math.PI) / 180
  return [r * Math.cos(a), r * Math.sin(a)]
}

function sector(r0: number, r1: number, a0: number, a1: number): string {
  const [x0, y0] = polar(r1, a0)
  const [x1, y1] = polar(r1, a1)
  const [x2, y2] = polar(r0, a1)
  const [x3, y3] = polar(r0, a0)
  return `M${x0.toFixed(3)} ${y0.toFixed(3)}A${r1} ${r1} 0 0 1 ${x1.toFixed(3)} ${y1.toFixed(3)}L${x2.toFixed(3)} ${y2.toFixed(3)}A${r0} ${r0} 0 0 0 ${x3.toFixed(3)} ${y3.toFixed(3)}Z`
}

interface Region {
  key: string
  d: string
  fill: string
  dart: Dart
}

const REGIONS: Region[] = (() => {
  const out: Region[] = []
  BOARD_ORDER.forEach((n, i) => {
    const { start, end } = segmentAngle(i)
    const dark = i % 2 === 0
    const single = dark ? C.black : C.cream
    const ring = dark ? C.red : C.green
    const add = (r0: number, r1: number, mult: Multiplier, fill: string, tag: string) =>
      out.push({ key: `${tag}${n}`, d: sector(r0, r1, start, end), fill, dart: { segment: n, mult } })
    add(RINGS.outerBull, RINGS.tripleIn, 1, single, 'si')
    add(RINGS.tripleIn, RINGS.tripleOut, 3, ring, 'T')
    add(RINGS.tripleOut, RINGS.doubleIn, 1, single, 'so')
    add(RINGS.doubleIn, RINGS.doubleOut, 2, ring, 'D')
  })
  return out
})()

interface Hit {
  id: number
  x: number
  y: number
  label: string
  key: string
  tone: 'single' | 'double' | 'triple' | 'miss'
}

interface Props {
  onDart?: (d: Dart) => void
  highlight?: (segment: number) => boolean
  disabled?: boolean
  /** Show the number ring (and allow tapping it as a miss). */
  numbers?: boolean
  className?: string
  /** Decorative (game picker art): no interaction or feedback. */
  art?: boolean
  /** Extra highlight per-region, used for picker art. */
  emphasize?: (d: Dart) => boolean
  /** Label shown in the hit pop-up. */
  labelFor?: (d: Dart) => string
}

export default function Dartboard({
  onDart,
  highlight,
  disabled,
  numbers = true,
  className,
  art,
  emphasize,
  labelFor = dartLabel,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [hits, setHits] = useState<Hit[]>([])
  const idRef = useRef(0)
  const outer = numbers ? RINGS.numbers : RINGS.doubleOut + 2

  const fire = (dart: Dart, key: string, e: MouseEvent) => {
    if (art || disabled || !onDart) return
    let x = 0
    let y = 0
    const svg = svgRef.current
    const m = svg?.getScreenCTM()
    if (svg && m) {
      const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse())
      x = p.x
      y = p.y
    }
    const id = ++idRef.current
    const tone = dart.segment === 0 ? 'miss' : dart.mult === 3 ? 'triple' : dart.mult === 2 ? 'double' : 'single'
    setHits((h) => [...h.slice(-4), { id, x, y, label: labelFor(dart), key, tone }])
    svg?.animate(
      [
        { transform: 'scale(1)' },
        { transform: `scale(${dart.segment === 0 ? 0.99 : 0.975})` },
        { transform: 'scale(1)' },
      ],
      { duration: 160, easing: 'ease-out' },
    )
    window.setTimeout(() => setHits((h) => h.filter((k) => k.id !== id)), 900)
    onDart(dart)
  }

  const dim = (segment: number) => (highlight ? !highlight(segment) : false)
  const flashKey = hits.length ? hits[hits.length - 1].key : ''

  return (
    <svg
      ref={svgRef}
      viewBox={`${-outer - 2} ${-outer - 2} ${(outer + 2) * 2} ${(outer + 2) * 2}`}
      className={cx('block select-none', !art && 'touch-manipulation', className)}
      role={art ? 'img' : 'group'}
      aria-label={art ? 'Dartboard' : 'Dartboard input: tap a segment'}
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      <defs>
        <radialGradient id="db-metal" cx="50%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#f6dc8e" />
          <stop offset="55%" stopColor="#b8892f" />
          <stop offset="100%" stopColor="#6b4c16" />
        </radialGradient>
        <radialGradient id="db-shade" cx="50%" cy="40%" r="60%">
          <stop offset="70%" stopColor="#000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.35" />
        </radialGradient>
      </defs>

      {/* surround */}
      <circle r={outer + 1.5} fill={C.surround} stroke="url(#db-metal)" strokeWidth={art ? 3 : 2} />
      {numbers && (
        <g>
          {BOARD_ORDER.map((n, i) => {
            const { start, end, mid } = segmentAngle(i)
            const [tx, ty] = polar((RINGS.doubleOut + RINGS.numbers) / 2 + 0.5, mid)
            return (
              <g
                key={n}
                onClick={(e) => fire({ segment: 0, mult: 1 }, 'miss', e)}
                className={cx(!art && 'cursor-pointer')}
              >
                <path d={sector(RINGS.doubleOut, RINGS.numbers, start, end)} fill="transparent" />
                <text
                  x={tx}
                  y={ty}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize="10"
                  fontWeight="800"
                  fill={dim(n) ? '#5b5446' : C.cream}
                  style={{ pointerEvents: 'none', fontFamily: 'inherit' }}
                >
                  {n}
                </text>
              </g>
            )
          })}
        </g>
      )}

      {/* segments */}
      <g stroke={C.wire} strokeWidth={0.45} strokeOpacity={0.8}>
        {REGIONS.map((r) => {
          const em = emphasize?.(r.dart)
          const faded = emphasize ? !em : dim(r.dart.segment)
          return (
            <path
              key={r.key}
              d={r.d}
              fill={r.fill}
              opacity={faded ? (art ? 0.4 : 0.22) : 1}
              onClick={(e) => fire(r.dart, r.key, e)}
              className={cx(!art && 'db-seg cursor-pointer', flashKey === r.key && 'db-flash')}
            />
          )
        })}
        <circle
          r={RINGS.outerBull}
          fill={C.green}
          opacity={(emphasize ? !emphasize({ segment: 25, mult: 1 }) : dim(25)) ? 0.22 : 1}
          onClick={(e) => fire({ segment: 25, mult: 1 }, 'ob', e)}
          className={cx(!art && 'db-seg cursor-pointer', flashKey === 'ob' && 'db-flash')}
        />
        <circle
          r={RINGS.bull}
          fill={C.red}
          opacity={(emphasize ? !emphasize({ segment: 25, mult: 2 }) : dim(25)) ? 0.22 : 1}
          onClick={(e) => fire({ segment: 25, mult: 2 }, 'bull', e)}
          className={cx(!art && 'db-seg cursor-pointer', flashKey === 'bull' && 'db-flash')}
        />
      </g>
      <circle r={RINGS.doubleOut} fill="url(#db-shade)" pointerEvents="none" />
      <circle r={RINGS.doubleOut} fill="none" stroke="url(#db-metal)" strokeWidth={0.9} pointerEvents="none" />

      {/* hit feedback */}
      {hits.map((h) => (
        <g key={h.id} pointerEvents="none">
          <circle cx={h.x} cy={h.y} r={4} className="db-ping" fill="none" stroke="#f6dc8e" strokeWidth={1.6} />
          <circle cx={h.x} cy={h.y} r={1.8} fill="#f6dc8e" className="db-pin" />
          <text
            x={h.x}
            y={h.y - 9}
            textAnchor="middle"
            fontSize="12"
            fontWeight="900"
            className={cx('db-label', `db-label-${h.tone}`)}
            style={{ fontFamily: 'inherit' }}
          >
            {h.label}
          </text>
        </g>
      ))}
    </svg>
  )
}
