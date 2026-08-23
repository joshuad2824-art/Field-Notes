import { useId } from 'react'
import { NOCTURNAL, conditionFamily, conditionWord, type Family } from '../weather/codes'

/* The weather, drawn rather than typed.

   `codes.ts` carries the argument for why this is an SVG and not a character;
   the short of it is that no vendored subset has ☀ in it, so a typed sky would
   be the operating system's picture rather than ours, in colour, and different
   on every platform. This is the app's own hand — the same technique the table
   rules and the felt underline already use.

   One box, 24 units square, ten drawings in it, three of which have a moon
   after dark. Everything is a stroke in `currentColor`, so the line's own
   colour governs and there is no second palette. Where a group is scaled, its
   stroke width is divided by the same number, because a scaled stroke is a
   different weight and the whole set has to look like one pen. */

const PEN = 1.7

/* The cloud, once, at rest: a flat bottom at y 17.2 and three lobes over it.
   Everything that has a cloud in it uses this path under a transform. */
const CLOUD = 'M5 17.2 A3.4 3.4 0 0 1 6.7 10.8 A5 5 0 0 1 16 11.4 A3.2 3.2 0 0 1 17.8 17.2 Z'

/* The crescent: the major arc of a circle at (12,12) r7, closed by the minor
   arc of a second circle biting into it from the upper right. The numbers are
   the two circles' intersections, worked out rather than nudged. */
const MOON = 'M10.85 5.1 A7 7 0 1 0 18.41 14.82 A6.6 6.6 0 0 1 10.85 5.1 Z'

/* Eight rays, so the sun is a sun and not a full stop. */
const RAYS = [0, 45, 90, 135, 180, 225, 270, 315]

function Sun({ cx, cy, r, inner, outer }: { cx: number; cy: number; r: number; inner: number; outer: number }) {
  return (
    <>
      <circle cx={cx} cy={cy} r={r} />
      {RAYS.map((deg) => {
        const a = (deg * Math.PI) / 180
        return (
          <line
            key={deg}
            x1={round(cx + Math.cos(a) * inner)}
            y1={round(cy + Math.sin(a) * inner)}
            x2={round(cx + Math.cos(a) * outer)}
            y2={round(cy + Math.sin(a) * outer)}
          />
        )
      })}
    </>
  )
}

function round(n: number): number {
  return Math.round(n * 100) / 100
}

/* A cloud under a transform, with the pen kept at one weight through it. */
function Cloud({ at, scale }: { at: [number, number]; scale: number }) {
  return (
    <g transform={`translate(${at[0]} ${at[1]}) scale(${scale})`} strokeWidth={round(PEN / scale)}>
      <path d={CLOUD} />
    </g>
  )
}

function Moon({ at, scale }: { at: [number, number]; scale: number }) {
  return (
    <g transform={`translate(${at[0]} ${at[1]}) scale(${scale})`} strokeWidth={round(PEN / scale)}>
      <path d={MOON} />
    </g>
  )
}

/* A snowflake small enough to survive at fifteen pixels: three crossed strokes
   and no six-pointed filigree, which turns to mush below about 30. */
function Flake({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  const h = round(r * 0.5)
  const v = round(r * 0.866)
  return (
    <>
      <line x1={cx - r} y1={cy} x2={cx + r} y2={cy} />
      <line x1={cx - h} y1={cy - v} x2={cx + h} y2={cy + v} />
      <line x1={cx + h} y1={cy - v} x2={cx - h} y2={cy + v} />
    </>
  )
}

/* Where the cloud sits when something is falling out of it: high enough to
   leave nine units of box underneath. */
const WEEPING: { at: [number, number]; scale: number } = { at: [1.97, -2.91], scale: 0.9 }

interface Props {
  code: number
  /* Open-Meteo's own `is_day`. A sun at nine in the evening is simply wrong. */
  isDay: boolean
}

export function WeatherGlyph({ code, isDay }: Props) {
  const family = conditionFamily(code)
  const word = conditionWord(code)
  /* The line is rendered in two places — the rail and the list's date — and
     for a moment in both while the drawer reconciles, so the mask's id cannot
     be a constant. Everything that is not a letter or a digit comes out:
     React's own separators have changed shape between versions and a stray
     one inside `url(#…)` is a mask that silently does nothing. */
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const mask = `cloudmask-${uid}`

  return (
    /* `title` for the pointer, `role="img"` plus `<title>` for the accessible
       name — said once, on the element that is actually the picture, so the
       word the line used to show is still the word the line reports. */
    <span className="weather-glyph" title={word}>
      <svg
        viewBox="0 0 24 24"
        role="img"
        fill="none"
        stroke="currentColor"
        strokeWidth={PEN}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <title>{word}</title>
        {draw(family, isDay, mask)}
      </svg>
    </span>
  )
}

/* The knockout that lets a cloud sit in front of a sun without the two sets of
   strokes crossing. A background-coloured fill would have been the easy way
   and would have been a second place that knows what the frame is; a mask
   works on any surface, which is what a glyph that appears in the rail and on
   the list's date needs. */
function Knockout({ id, cloud }: { id: string; cloud: { at: [number, number]; scale: number } }) {
  return (
    <mask id={id} maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
      <rect x="0" y="0" width="24" height="24" fill="#fff" />
      <g
        transform={`translate(${cloud.at[0]} ${cloud.at[1]}) scale(${cloud.scale})`}
        fill="#000"
        stroke="#000"
        strokeWidth={round(3.6 / cloud.scale)}
      >
        <path d={CLOUD} />
      </g>
    </mask>
  )
}

function draw(family: Family, isDay: boolean, mask: string) {
  const night = !isDay && NOCTURNAL.has(family)

  if (family === 'clear') {
    return night ? (
      <Moon at={[0, 0]} scale={1} />
    ) : (
      <Sun cx={12} cy={12} r={4.4} inner={6.7} outer={9.6} />
    )
  }

  if (family === 'mostly-clear' || family === 'partly-cloudy') {
    const cloud: { at: [number, number]; scale: number } =
      family === 'mostly-clear' ? { at: [9.45, 10.5], scale: 0.62 } : { at: [4.8, 6], scale: 0.82 }
    const light =
      family === 'mostly-clear' ? { cx: 9.5, cy: 9, r: 3.6, inner: 5.6, outer: 8.2 } : { cx: 9, cy: 9, r: 3.2, inner: 5, outer: 7.4 }
    const moon: { at: [number, number]; scale: number } =
      family === 'mostly-clear' ? { at: [2.65, 2.15], scale: 0.571 } : { at: [3, 3], scale: 0.5 }

    return (
      <>
        <Knockout id={mask} cloud={cloud} />
        <g mask={`url(#${mask})`}>
          {night ? <Moon at={moon.at} scale={moon.scale} /> : <Sun {...light} />}
        </g>
        <Cloud at={cloud.at} scale={cloud.scale} />
      </>
    )
  }

  /* Alone in the box, the cloud has to carry the same optical weight as the
     sun does — at rest it is a third shorter, which reads as a smaller glyph
     rather than a different sky. So overcast is the one that is drawn large. */
  if (family === 'overcast') return <Cloud at={[-1.94, -3.29]} scale={1.25} />

  if (family === 'fog') {
    return (
      <>
        <Cloud {...WEEPING} />
        <line x1="6.2" y1="15.8" x2="17.8" y2="15.8" />
        <line x1="8.4" y1="19.4" x2="16.2" y2="19.4" />
      </>
    )
  }

  if (family === 'drizzle') {
    return (
      <>
        <Cloud {...WEEPING} />
        <line x1="10" y1="15.4" x2="10" y2="17.9" />
        <line x1="14" y1="15.4" x2="14" y2="17.9" />
      </>
    )
  }

  if (family === 'rain') {
    return (
      <>
        <Cloud {...WEEPING} />
        <line x1="8.4" y1="15" x2="8.4" y2="19.2" />
        <line x1="12" y1="15.4" x2="12" y2="20.8" />
        <line x1="15.6" y1="15" x2="15.6" y2="19.2" />
      </>
    )
  }

  if (family === 'showers') {
    return (
      <>
        <Cloud {...WEEPING} />
        <line x1="9.2" y1="15" x2="7.4" y2="19.4" />
        <line x1="12.8" y1="15" x2="11" y2="19.4" />
        <line x1="16.4" y1="15" x2="14.6" y2="19.4" />
      </>
    )
  }

  if (family === 'snow') {
    return (
      <>
        <Cloud {...WEEPING} />
        <Flake cx={9.2} cy={17.2} r={1.9} />
        <Flake cx={14.8} cy={17.2} r={1.9} />
      </>
    )
  }

  /* thunder */
  return (
    <>
      <Cloud {...WEEPING} />
      <path d="M12.64 14.1 L9 18.24 L11.79 18.24 L11.36 21.3 L15 17.16 L12.21 17.16 Z" />
    </>
  )
}
