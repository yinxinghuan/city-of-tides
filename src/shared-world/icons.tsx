import type { SVGProps } from 'react'

function Icon({ children, ...props }: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{children}</svg>
}

export const WaveIcon = (p: SVGProps<SVGSVGElement>) => <Icon {...p}><path d="M2 9c3.2 0 3.2-3 6.4-3s3.2 3 6.4 3S18 6 22 6"/><path d="M2 15c3.2 0 3.2-3 6.4-3s3.2 3 6.4 3 3.2-3 7.2-3"/></Icon>
export const MapIcon = (p: SVGProps<SVGSVGElement>) => <Icon {...p}><path d="m3 6 5-2 8 2 5-2v14l-5 2-8-2-5 2Z"/><path d="M8 4v14M16 6v14"/></Icon>
export const TraceIcon = (p: SVGProps<SVGSVGElement>) => <Icon {...p}><path d="M7 19c-2-1.2-3-3.2-2.6-5.2.5-2.5 2.8-4.2 5.3-3.8 2.1.4 3.6 2.3 3.4 4.4-.2 1.6-1.5 2.8-3.1 2.6-1.2-.2-2-1.3-1.8-2.5"/><path d="M14 8c.2-2 1.6-3.5 3.5-3.3 1.7.2 2.9 1.8 2.5 3.5-.3 1.2-1.4 2.1-2.7 2"/></Icon>
export const AnchorIcon = (p: SVGProps<SVGSVGElement>) => <Icon {...p}><circle cx="12" cy="5" r="2"/><path d="M12 7v13M5 12H2c0 5.5 4.5 8 10 8s10-2.5 10-8h-3M7 12h10"/></Icon>
export const BellIcon = (p: SVGProps<SVGSVGElement>) => <Icon {...p}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></Icon>
export const SendIcon = (p: SVGProps<SVGSVGElement>) => <Icon {...p}><path d="m3 3 18 9-18 9 3-9Z"/><path d="M6 12h15"/></Icon>
export const ReplyIcon = (p: SVGProps<SVGSVGElement>) => <Icon {...p}><path d="m9 17-6-5 6-5"/><path d="M3 12h10c5 0 8 2 8 7"/></Icon>
export const PlusIcon = (p: SVGProps<SVGSVGElement>) => <Icon {...p}><path d="M12 5v14M5 12h14"/></Icon>
export const BoxIcon = (p: SVGProps<SVGSVGElement>) => <Icon {...p}><path d="m4 7 8-4 8 4-8 4Z"/><path d="M4 7v10l8 4 8-4V7M12 11v10"/></Icon>
export const VolumeIcon = (p: SVGProps<SVGSVGElement>) => <Icon {...p}><path d="M5 9H2v6h3l5 4V5Z"/><path d="M14 9a4 4 0 0 1 0 6M17 6a8 8 0 0 1 0 12"/></Icon>
export const MuteIcon = (p: SVGProps<SVGSVGElement>) => <Icon {...p}><path d="M5 9H2v6h3l5 4V5Z"/><path d="m15 9 6 6M21 9l-6 6"/></Icon>
export const CloseIcon = (p: SVGProps<SVGSVGElement>) => <Icon {...p}><path d="m6 6 12 12M18 6 6 18"/></Icon>
export const CheckIcon = (p: SVGProps<SVGSVGElement>) => <Icon {...p}><path d="m5 12 4 4L19 6"/></Icon>
export const ClockIcon = (p: SVGProps<SVGSVGElement>) => <Icon {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></Icon>
export const FlagIcon = (p: SVGProps<SVGSVGElement>) => <Icon {...p}><path d="M5 21V4"/><path d="M5 5h11l-2 4 2 4H5"/></Icon>
