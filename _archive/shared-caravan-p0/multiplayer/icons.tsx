import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>
const Base = ({ children, ...props }: IconProps) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{children}</svg>

export const RouteIcon = (props: IconProps) => <Base {...props}><path d="M5 19c0-5 4-5 4-9s-4-3-4-7"/><path d="M19 5c0 5-4 5-4 9s4 3 4 7"/><circle cx="5" cy="3" r="1.5"/><circle cx="19" cy="21" r="1.5"/></Base>
export const UsersIcon = (props: IconProps) => <Base {...props}><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3.5 19c.5-3.6 2.4-5.5 5.5-5.5s5 1.9 5.5 5.5"/><path d="M14.5 14.2c3.2-.7 5.3.9 6 4.3"/></Base>
export const CheckIcon = (props: IconProps) => <Base {...props}><path d="m5 12 4 4 10-10"/></Base>
export const WarningIcon = (props: IconProps) => <Base {...props}><path d="M12 3 2.8 20h18.4L12 3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></Base>
export const VolumeIcon = (props: IconProps) => <Base {...props}><path d="M4 10v4h4l5 4V6l-5 4H4Z"/><path d="M16 9c1.4 1.5 1.4 4.5 0 6"/><path d="M18.5 6.5c3.3 3.2 3.3 7.8 0 11"/></Base>
export const MuteIcon = (props: IconProps) => <Base {...props}><path d="M4 10v4h4l5 4V6l-5 4H4Z"/><path d="m17 10 4 4"/><path d="m21 10-4 4"/></Base>
export const ResetIcon = (props: IconProps) => <Base {...props}><path d="M4 8V3l3 3a8 8 0 1 1-2 10"/></Base>
export const SendIcon = (props: IconProps) => <Base {...props}><path d="m3 11 17-8-7 18-2-8-8-2Z"/><path d="m11 13 9-10"/></Base>
export const VersionIcon = (props: IconProps) => <Base {...props}><path d="M7 4h10l3 5-8 11L4 9l3-5Z"/><path d="M4 9h16"/><path d="m9 4 3 16 3-16"/></Base>
