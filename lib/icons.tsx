import type { SVGProps } from "react";

// One icon set for Stealth UI. 16px grid, 1.4 stroke, round caps and joins,
// currentColor. Decorative by default (aria-hidden); give the parent button
// the label. Need one that isn't here? Draw it inline in your component on the
// same grid with the same stroke, never import a second icon library.

export type IconProps = SVGProps<SVGSVGElement> & { size?: number };

const base = (size = 16): SVGProps<SVGSVGElement> => ({
  width: size,
  height: size,
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.4,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
  focusable: false,
});

const make = (paths: React.ReactNode, name: string) => {
  const Icon = ({ size, ...rest }: IconProps) => (
    <svg {...base(size)} {...rest}>
      {paths}
    </svg>
  );
  Icon.displayName = name;
  return Icon;
};

export const Check = make(<path d="M3.5 8.5 6.5 11.5 12.5 4.5" />, "Check");
export const X = make(<path d="m4.5 4.5 7 7M11.5 4.5l-7 7" />, "X");
export const Plus = make(<path d="M8 3.5v9M3.5 8h9" />, "Plus");
export const Minus = make(<path d="M3.5 8h9" />, "Minus");
export const ChevronDown = make(<path d="m4.5 6.25 3.5 3.5 3.5-3.5" />, "ChevronDown");
export const ChevronUp = make(<path d="m4.5 9.75 3.5-3.5 3.5 3.5" />, "ChevronUp");
export const ChevronLeft = make(<path d="M9.75 4.5 6.25 8l3.5 3.5" />, "ChevronLeft");
export const ChevronRight = make(<path d="m6.25 4.5 3.5 3.5-3.5 3.5" />, "ChevronRight");
export const ChevronsUpDown = make(<path d="m5 6 3-3 3 3M5 10l3 3 3-3" />, "ChevronsUpDown");
export const ArrowUp = make(<path d="M8 13V3M4 7l4-4 4 4" />, "ArrowUp");
export const ArrowDown = make(<path d="M8 3v10M4 9l4 4 4-4" />, "ArrowDown");
export const ArrowLeft = make(<path d="M13 8H3M7 4 3 8l4 4" />, "ArrowLeft");
export const ArrowRight = make(<path d="M3 8h10M9 4l4 4-4 4" />, "ArrowRight");
export const ArrowUpRight = make(<path d="M5 11 11 5M6 5h5v5" />, "ArrowUpRight");
export const Search = make(<><circle cx="7" cy="7" r="4.25" /><path d="m10.25 10.25 3 3" /></>, "Search");
export const Copy = make(<><rect x="5.5" y="5.5" width="7.5" height="7.5" rx="1.75" /><path d="M10.5 5.5V4.25A1.25 1.25 0 0 0 9.25 3h-5A1.25 1.25 0 0 0 3 4.25v5A1.25 1.25 0 0 0 4.25 10.5H5.5" /></>, "Copy");
export const Trash = make(<path d="M3 4.5h10M6.5 4.5V3.25h3V4.5M4.5 4.5l.6 8.1a1 1 0 0 0 1 .9h3.8a1 1 0 0 0 1-.9l.6-8.1M6.75 7v4M9.25 7v4" />, "Trash");
export const Pencil = make(<path d="M10.5 3.25a1.4 1.4 0 0 1 2 2L5.75 12 3 12.75 3.75 10z" />, "Pencil");
export const Eye = make(<><path d="M1.75 8S4 3.75 8 3.75 14.25 8 14.25 8 12 12.25 8 12.25 1.75 8 1.75 8z" /><circle cx="8" cy="8" r="2" /></>, "Eye");
export const EyeOff = make(<><path d="M6.6 3.9A6 6 0 0 1 8 3.75C12 3.75 14.25 8 14.25 8a11 11 0 0 1-1.6 2.2M4.2 5.2A10.6 10.6 0 0 0 1.75 8S4 12.25 8 12.25a6 6 0 0 0 3-.8" /><path d="M6.6 6.6a2 2 0 0 0 2.8 2.8M2.5 2.5l11 11" /></>, "EyeOff");
export const Lock = make(<><rect x="3.5" y="7" width="9" height="6.5" rx="1.5" /><path d="M5.5 7V5.25a2.5 2.5 0 0 1 5 0V7" /></>, "Lock");
export const Unlock = make(<><rect x="3.5" y="7" width="9" height="6.5" rx="1.5" /><path d="M5.5 7V5.25a2.5 2.5 0 0 1 4.8-1" /></>, "Unlock");
export const User = make(<><circle cx="8" cy="5.5" r="2.5" /><path d="M3.25 13.25c.5-2.4 2.4-3.75 4.75-3.75s4.25 1.35 4.75 3.75" /></>, "User");
export const Users = make(<><circle cx="6" cy="5.5" r="2.25" /><path d="M2 13c.4-2.2 2-3.5 4-3.5s3.6 1.3 4 3.5M10.5 3.4a2.25 2.25 0 0 1 0 4.2M11.75 9.7c1.2.5 2 1.7 2.25 3.3" /></>, "Users");
export const Settings = make(<><circle cx="8" cy="8" r="2" /><path d="M8 1.75v1.5M8 12.75v1.5M1.75 8h1.5M12.75 8h1.5M3.6 3.6l1.05 1.05M11.35 11.35l1.05 1.05M3.6 12.4l1.05-1.05M11.35 4.65 12.4 3.6" /></>, "Settings");
export const Sliders = make(<path d="M3 4.5h6M12 4.5h1M3 11.5h1M7 11.5h6M10.5 3v3M5.5 10v3" />, "Sliders");
export const Filter = make(<path d="M2.75 3.5h10.5L9.25 8.5v4l-2.5-1v-3z" />, "Filter");
export const Home = make(<path d="M2.75 7 8 2.75 13.25 7v5.75a.75.75 0 0 1-.75.75h-3v-4h-3v4h-3a.75.75 0 0 1-.75-.75z" />, "Home");
export const Inbox = make(<path d="M2.5 9.5 4 3.75h8L13.5 9.5v3a.75.75 0 0 1-.75.75H3.25a.75.75 0 0 1-.75-.75zM2.5 9.5h3l.75 1.5h3.5l.75-1.5h3" />, "Inbox");
export const Bell = make(<path d="M4 11V7a4 4 0 0 1 8 0v4l1.25 1.25H2.75zM6.5 13.75a1.6 1.6 0 0 0 3 0" />, "Bell");
export const Calendar = make(<><rect x="2.5" y="3.25" width="11" height="10.25" rx="1.75" /><path d="M2.5 6.5h11M5.5 2v2.5M10.5 2v2.5" /></>, "Calendar");
export const Clock = make(<><circle cx="8" cy="8" r="5.75" /><path d="M8 4.75V8l2.25 1.5" /></>, "Clock");
export const Globe = make(<><circle cx="8" cy="8" r="5.75" /><path d="M2.25 8h11.5M8 2.25c1.6 1.6 2.4 3.5 2.4 5.75S9.6 12.15 8 13.75C6.4 12.15 5.6 10.25 5.6 8S6.4 3.85 8 2.25z" /></>, "Globe");
export const Link = make(<><path d="M6.75 9.25a2.75 2.75 0 0 0 3.9 0l2-2a2.75 2.75 0 0 0-3.9-3.9l-.7.7" /><path d="M9.25 6.75a2.75 2.75 0 0 0-3.9 0l-2 2a2.75 2.75 0 0 0 3.9 3.9l.7-.7" /></>, "Link");
export const External = make(<path d="M9.5 2.75h3.75V6.5M13.25 2.75 7.5 8.5M11.5 9.5v2.75a1 1 0 0 1-1 1H3.75a1 1 0 0 1-1-1V5.5a1 1 0 0 1 1-1H6.5" />, "External");
export const Download = make(<path d="M8 2.75v7.5M4.75 7 8 10.25 11.25 7M3 13.25h10" />, "Download");
export const Upload = make(<path d="M8 10.25v-7.5M4.75 6 8 2.75 11.25 6M3 13.25h10" />, "Upload");
export const File = make(<path d="M4 2.5h5l3.5 3.5v7.5H4zM9 2.5V6h3.5" />, "File");
export const Folder = make(<path d="M2.5 4.25c0-.4.35-.75.75-.75h3l1.5 1.5h5c.4 0 .75.35.75.75v6.5c0 .4-.35.75-.75.75h-9.5a.75.75 0 0 1-.75-.75z" />, "Folder");
export const Image = make(<><rect x="2.5" y="3" width="11" height="10" rx="1.75" /><circle cx="6" cy="6.5" r="1.1" /><path d="m2.75 11.5 3.4-3 2.4 2 1.6-1.4 3.1 2.6" /></>, "Image");
export const Paperclip = make(<path d="m12.75 7.5-4.9 4.9a3 3 0 0 1-4.25-4.25l5.3-5.3a2 2 0 0 1 2.85 2.85l-5.3 5.3a1 1 0 0 1-1.4-1.4L9.9 4.75" />, "Paperclip");
export const Send = make(<><path d="M13.5 2.5 2.5 6.75l5 1.75 1.75 5z" /><path d="m13.5 2.5-6 6" /></>, "Send");
export const Mic = make(<><rect x="6" y="2" width="4" height="7.5" rx="2" /><path d="M3.75 7.5a4.25 4.25 0 0 0 8.5 0M8 11.75v2.25" /></>, "Mic");
export const Play = make(<path d="M5 3.5v9l7.5-4.5z" fill="currentColor" />, "Play");
export const Pause = make(<path d="M5.25 3.5v9M10.75 3.5v9" strokeWidth={2} />, "Pause");
export const Stop = make(<rect x="4" y="4" width="8" height="8" rx="1.5" fill="currentColor" stroke="none" />, "Stop");
export const Volume = make(<path d="M7.5 3.25 4.6 5.6H2.6v4.8h2l2.9 2.35zM10 6.2a2.6 2.6 0 0 1 0 3.6M12 4.4a5.2 5.2 0 0 1 0 7.2" />, "Volume");
export const VolumeOff = make(<path d="M7.5 3.25 4.6 5.6H2.6v4.8h2l2.9 2.35zM10.25 6.4l3.2 3.2M13.45 6.4l-3.2 3.2" />, "VolumeOff");
export const Heart = make(<path d="M8 13.25S2.25 10 2.25 6.1A2.85 2.85 0 0 1 8 4.9a2.85 2.85 0 0 1 5.75 1.2C13.75 10 8 13.25 8 13.25z" />, "Heart");
export const Star = make(<path d="m8 2.25 1.75 3.6 3.95.55-2.85 2.8.7 3.95L8 11.3l-3.55 1.85.7-3.95L2.3 6.4l3.95-.55z" />, "Star");
export const Bookmark = make(<path d="M4.25 2.75h7.5v10.5L8 10.75l-3.75 2.5z" />, "Bookmark");
export const Share = make(<path d="M8 2.5v7.75M5 5.25 8 2.5l3 2.75M4.5 7.5h-.75a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h8.5a1 1 0 0 0 1-1v-4a1 1 0 0 0-1-1h-.75" />, "Share");
export const MoreH = make(<><circle cx="3.75" cy="8" r=".9" fill="currentColor" stroke="none" /><circle cx="8" cy="8" r=".9" fill="currentColor" stroke="none" /><circle cx="12.25" cy="8" r=".9" fill="currentColor" stroke="none" /></>, "MoreH");
export const MoreV = make(<><circle cx="8" cy="3.75" r=".9" fill="currentColor" stroke="none" /><circle cx="8" cy="8" r=".9" fill="currentColor" stroke="none" /><circle cx="8" cy="12.25" r=".9" fill="currentColor" stroke="none" /></>, "MoreV");
export const Grip = make(<>{[5.5, 10.5].flatMap((x) => [4, 8, 12].map((y) => <circle key={`${x}${y}`} cx={x} cy={y} r=".85" fill="currentColor" stroke="none" />))}</>, "Grip");
export const Menu = make(<path d="M2.75 4.5h10.5M2.75 8h10.5M2.75 11.5h10.5" />, "Menu");
export const Sidebar = make(<><rect x="2.25" y="2.75" width="11.5" height="10.5" rx="1.75" /><path d="M6.25 2.75v10.5" /></>, "Sidebar");
export const Info = make(<><circle cx="8" cy="8" r="5.75" /><path d="M8 7.25v3.5" /><circle cx="8" cy="5.1" r=".6" fill="currentColor" stroke="none" /></>, "Info");
export const Alert = make(<><circle cx="8" cy="8" r="5.75" /><path d="M8 5v3.5" /><circle cx="8" cy="10.9" r=".6" fill="currentColor" stroke="none" /></>, "Alert");
export const Warning = make(<><path d="M7.1 2.9a1 1 0 0 1 1.8 0l5 9.1a1 1 0 0 1-.9 1.5H3a1 1 0 0 1-.9-1.5z" /><path d="M8 6.25v3" /><circle cx="8" cy="11.1" r=".6" fill="currentColor" stroke="none" /></>, "Warning");
export const CircleCheck = make(<><circle cx="8" cy="8" r="5.75" /><path d="m5.5 8.25 1.75 1.75 3.25-3.75" /></>, "CircleCheck");
export const CircleX = make(<><circle cx="8" cy="8" r="5.75" /><path d="m6 6 4 4M10 6l-4 4" /></>, "CircleX");
export const Help = make(<><circle cx="8" cy="8" r="5.75" /><path d="M6.4 6.3a1.7 1.7 0 0 1 3.3.5c0 1.2-1.7 1.5-1.7 2.5" /><circle cx="8" cy="11.1" r=".6" fill="currentColor" stroke="none" /></>, "Help");
export const Sparkle = make(<path d="M8 2.25 9.35 6.65 13.75 8l-4.4 1.35L8 13.75 6.65 9.35 2.25 8l4.4-1.35z" />, "Sparkle");
export const Bolt = make(<path d="M8.75 2 3.75 9h4l-.5 5 5-7h-4z" />, "Bolt");
export const Refresh = make(<path d="M13 8a5 5 0 1 1-1.5-3.55M13 2.75V5h-2.25" />, "Refresh");
export const Undo = make(<path d="M5.5 5H10a3.25 3.25 0 0 1 0 6.5H6M5.5 5 7.75 2.75M5.5 5l2.25 2.25" />, "Undo");
export const Sun = make(<><circle cx="8" cy="8" r="2.75" /><path d="M8 1.75v1.5M8 12.75v1.5M1.75 8h1.5M12.75 8h1.5M3.6 3.6l1.05 1.05M11.35 11.35l1.05 1.05M3.6 12.4l1.05-1.05M11.35 4.65 12.4 3.6" /></>, "Sun");
export const Moon = make(<path d="M13 9.6A5.5 5.5 0 0 1 6.4 3a5.5 5.5 0 1 0 6.6 6.6z" />, "Moon");
export const Monitor = make(<><rect x="2" y="3" width="12" height="8" rx="1.5" /><path d="M6 13.5h4M8 11v2.5" /></>, "Monitor");
export const Terminal = make(<path d="m3.25 5 3 3-3 3M8.5 11h4.25" />, "Terminal");
export const Code = make(<path d="m5.5 4.5-3 3.5 3 3.5M10.5 4.5l3 3.5-3 3.5" />, "Code");
export const Command = make(<path d="M6 6V4.5A1.5 1.5 0 1 0 4.5 6H6zm0 0h4M6 6v4m4-4V4.5A1.5 1.5 0 1 1 11.5 6H10zm0 0v4m0 0h1.5A1.5 1.5 0 1 1 10 11.5V10zm0 0H6m0 0v1.5A1.5 1.5 0 1 1 4.5 10H6z" />, "Command");
export const CornerDownLeft = make(<path d="M12.75 3.5v4.75a1.5 1.5 0 0 1-1.5 1.5H3.5M6.25 7 3.5 9.75l2.75 2.75" />, "CornerDownLeft");
export const Hash = make(<path d="M5.75 2.75 4.75 13.25M11.25 2.75l-1 10.5M3 6h10.5M2.5 10H13" />, "Hash");
export const AtSign = make(<><circle cx="8" cy="8" r="2.5" /><path d="M10.5 8v1a1.75 1.75 0 0 0 3.5 0V8a6 6 0 1 0-2.4 4.8" /></>, "AtSign");
export const Tag = make(<><path d="M2.75 2.75h5l5.5 5.5-5 5-5.5-5.5z" /><circle cx="5.5" cy="5.5" r=".8" fill="currentColor" stroke="none" /></>, "Tag");
export const CreditCard = make(<><rect x="2" y="3.5" width="12" height="9" rx="1.5" /><path d="M2 6.5h12M4.5 10h2" /></>, "CreditCard");
export const Cart = make(<><path d="M1.75 2.75h1.5l1.5 7.5h7.25l1.5-5.5H4" /><circle cx="5.5" cy="12.75" r=".9" /><circle cx="11.25" cy="12.75" r=".9" /></>, "Cart");
export const Mail = make(<><rect x="2" y="3.5" width="12" height="9" rx="1.5" /><path d="m2.5 4.5 5.5 4.25 5.5-4.25" /></>, "Mail");
export const Message = make(<path d="M2.75 4.25c0-.8.7-1.5 1.5-1.5h7.5c.8 0 1.5.7 1.5 1.5v5.5c0 .8-.7 1.5-1.5 1.5H7.5L4.75 13.5v-2.25h-.5c-.8 0-1.5-.7-1.5-1.5z" />, "Message");
export const ThumbUp = make(<path d="M5 7.25v6H3a.75.75 0 0 1-.75-.75V8A.75.75 0 0 1 3 7.25zm0 0 2.5-4.5a1.4 1.4 0 0 1 1.9 1.3l-.4 2.2h3.3a1.25 1.25 0 0 1 1.2 1.6l-1.3 4.3a1.25 1.25 0 0 1-1.2.85H5" />, "ThumbUp");
export const ThumbDown = make(<path d="M11 8.75v-6h2a.75.75 0 0 1 .75.75V8a.75.75 0 0 1-.75.75zm0 0-2.5 4.5a1.4 1.4 0 0 1-1.9-1.3l.4-2.2H3.7a1.25 1.25 0 0 1-1.2-1.6l1.3-4.3a1.25 1.25 0 0 1 1.2-.85H11" />, "ThumbDown");
export const Maximize = make(<path d="M9.75 2.75h3.5v3.5M6.25 13.25h-3.5v-3.5M13.25 2.75 9.25 6.75M2.75 13.25l4-4" />, "Maximize");
export const Minimize = make(<path d="M13.25 6.25h-3.5v-3.5M2.75 9.75h3.5v3.5M9.75 6.25l3.5-3.5M6.25 9.75l-3.5 3.5" />, "Minimize");
export const ZoomIn = make(<><circle cx="7" cy="7" r="4.25" /><path d="m10.25 10.25 3 3M5 7h4M7 5v4" /></>, "ZoomIn");
export const ZoomOut = make(<><circle cx="7" cy="7" r="4.25" /><path d="m10.25 10.25 3 3M5 7h4" /></>, "ZoomOut");
export const Loader = make(<path d="M8 2.25a5.75 5.75 0 1 0 5.75 5.75" />, "Loader");
export const Dot = make(<circle cx="8" cy="8" r="2.5" fill="currentColor" stroke="none" />, "Dot");
