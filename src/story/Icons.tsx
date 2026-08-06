import type { SVGProps } from 'react'

export type IconName = 'people' | 'map' | 'bag' | 'book' | 'close' | 'back' | 'pen' | 'arrow' | 'image' | 'refresh' | 'volume' | 'volumeOff'

const paths: Record<IconName, React.ReactNode> = {
  people: <><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3.5 20c.6-4 2.5-6 5.5-6s4.9 2 5.5 6M14 15c2.9-.6 5.2.9 6 4"/></>,
  map: <><path d="m3 6 5-2 8 3 5-2v14l-5 2-8-3-5 2Z"/><path d="M8 4v14M16 7v14"/></>,
  bag: <><path d="M5 8h14l1 13H4Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></>,
  book: <><path d="M4 5.5A3.5 3.5 0 0 1 7.5 2H11v17H7.5A3.5 3.5 0 0 0 4 22Z"/><path d="M20 5.5A3.5 3.5 0 0 0 16.5 2H13v17h3.5A3.5 3.5 0 0 1 20 22Z"/></>,
  close: <path d="m6 6 12 12M18 6 6 18"/>,
  back: <><path d="M19 12H6M10 7l-5 5 5 5"/></>,
  pen: <><path d="m4 20 4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10Z"/><path d="m13.5 7.5 3 3"/></>,
  arrow: <><path d="M5 12h13M14 7l5 5-5 5"/></>,
  image: <><rect x="3" y="4" width="18" height="16" rx="1"/><circle cx="9" cy="9" r="2"/><path d="m4 17 5-5 4 4 2-2 5 4"/></>,
  refresh: <><path d="M20 7v5h-5"/><path d="M19 12a7 7 0 1 0-1.5 4.3"/></>,
  volume: <><path d="M5 10v4h3l4 4V6L8 10Z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/></>,
  volumeOff: <><path d="M5 10v4h3l4 4V6L8 10Z"/><path d="m16 10 5 5M21 10l-5 5"/></>,
}

export function Icon({ name, ...props }: SVGProps<SVGSVGElement> & { name: IconName }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name]}</svg>
}
