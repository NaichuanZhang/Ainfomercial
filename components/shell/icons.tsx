import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 20, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

/** Twitch-style 20px glyph set (own drawings, no trademarks). */
export const Icon = {
  Search: (p: IconProps) => (
    <Svg {...p}>
      <path
        fillRule="evenodd"
        d="M13.192 14.606a7 7 0 1 1 1.414-1.414l3.101 3.1-1.414 1.415-3.1-3.1zM14 9A5 5 0 1 1 4 9a5 5 0 0 1 10 0z"
      />
    </Svg>
  ),
  Heart: ({ filled, ...p }: IconProps & { filled?: boolean }) => (
    <Svg {...p}>
      {filled ? (
        <path d="M9.171 4.171A4 4 0 0 0 6.343 3H6a4 4 0 0 0-4 4v.343a4 4 0 0 0 1.172 2.829L10 17l6.828-6.828A4 4 0 0 0 18 7.343V7a4 4 0 0 0-4-4h-.343a4 4 0 0 0-2.829 1.172L10 5l-.829-.829z" />
      ) : (
        <path
          fillRule="evenodd"
          d="M9.171 4.171A4 4 0 0 0 6.343 3H6a4 4 0 0 0-4 4v.343a4 4 0 0 0 1.172 2.829L10 17l6.828-6.828A4 4 0 0 0 18 7.343V7a4 4 0 0 0-4-4h-.343a4 4 0 0 0-2.829 1.172L10 5l-.829-.829zm.829 10l5.414-5.414A2 2 0 0 0 16 7.343V7a2 2 0 0 0-2-2h-.343a2 2 0 0 0-1.414.586L10 7.828 7.757 5.586A2 2 0 0 0 6.343 5H6a2 2 0 0 0-2 2v.343a2 2 0 0 0 .586 1.414L10 14.172z"
        />
      )}
    </Svg>
  ),
  Star: (p: IconProps) => (
    <Svg {...p}>
      <path d="M11.456 2.832L13.646 7.5l4.9.708a1 1 0 0 1 .554 1.706l-3.56 3.47.84 4.9a1 1 0 0 1-1.45 1.054L10 16.982l-4.93 2.356a1 1 0 0 1-1.45-1.054l.84-4.9-3.56-3.47a1 1 0 0 1 .554-1.706l4.9-.708 2.19-4.668a1 1 0 0 1 1.812 0z" />
    </Svg>
  ),
  Person: (p: IconProps) => (
    <Svg {...p}>
      <path
        fillRule="evenodd"
        d="M5 7a5 5 0 1 1 10 0A5 5 0 0 1 5 7zm8 0a3 3 0 1 0-6 0 3 3 0 0 0 6 0zM3 17a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v1H3v-1z"
      />
    </Svg>
  ),
  People: (p: IconProps) => (
    <Svg {...p}>
      <path
        fillRule="evenodd"
        d="M7 2a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM5 6a2 2 0 1 1 4 0 2 2 0 0 1-4 0zm7.5-3.5a3 3 0 1 1 0 6 3 3 0 0 1 0-6zM2 18v-3a3 3 0 0 1 3-3h4a3 3 0 0 1 3 3v3H2zm10.5-6h1.5a3 3 0 0 1 3 3v3h-3v-3a5 5 0 0 0-1.5-3z"
      />
    </Svg>
  ),
  Bell: (p: IconProps) => (
    <Svg {...p}>
      <path
        fillRule="evenodd"
        d="M10 2a5 5 0 0 0-5 5v3.5L3 14v1h14v-1l-2-3.5V7a5 5 0 0 0-5-5zm-3 5a3 3 0 1 1 6 0v4l1.2 2H5.8L7 11V7zm1 10a2 2 0 1 0 4 0H8z"
      />
    </Svg>
  ),
  Inbox: (p: IconProps) => (
    <Svg {...p}>
      <path
        fillRule="evenodd"
        d="M7.828 13L10 15.172 12.172 13H15V5H5v8h2.828zM3 3h14v12h-4l-3 3-3-3H3V3z"
      />
    </Svg>
  ),
  Gear: (p: IconProps) => (
    <Svg {...p}>
      <path
        fillRule="evenodd"
        d="M10 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm-4 2a4 4 0 1 1 8 0 4 4 0 0 1-8 0z"
      />
      <path
        fillRule="evenodd"
        d="M8.5 2h3l.5 2.2c.4.16.79.36 1.15.6l2.1-.75 1.5 2.6-1.6 1.45c.05.44.05.88 0 1.3l1.6 1.45-1.5 2.6-2.1-.75c-.36.24-.75.44-1.15.6L11.5 18h-3l-.5-2.2a5.9 5.9 0 0 1-1.15-.6l-2.1.75-1.5-2.6 1.6-1.45a6.1 6.1 0 0 1 0-1.3L3.25 6.65l1.5-2.6 2.1.75c.36-.24.75-.44 1.15-.6L8.5 2zm1.6 2l-.35 1.55-.6.18a4 4 0 0 0-1.6.86l-.48.4L5.6 6.46l-.4.7 1.15 1.04-.1.63a4.1 4.1 0 0 0 0 1.34l.1.63L5.2 11.84l.4.7 1.47-.53.48.4c.47.4 1.02.7 1.6.86l.6.18.35 1.55h.8l.35-1.55.6-.18a4 4 0 0 0 1.6-.86l.48-.4 1.47.53.4-.7-1.15-1.04.1-.63a4.1 4.1 0 0 0 0-1.34l-.1-.63 1.15-1.04-.4-.7-1.47.53-.48-.4a4 4 0 0 0-1.6-.86l-.6-.18L10.9 4h-.8z"
      />
    </Svg>
  ),
  Smile: (p: IconProps) => (
    <Svg {...p}>
      <path
        fillRule="evenodd"
        d="M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM4 10a6 6 0 1 1 12 0 6 6 0 0 1-12 0zm3-2a1 1 0 1 1 2 0 1 1 0 0 1-2 0zm4 0a1 1 0 1 1 2 0 1 1 0 0 1-2 0zm-4.6 4.2a4 4 0 0 0 7.2 0l-1.8-.9a2 2 0 0 1-3.6 0l-1.8.9z"
      />
    </Svg>
  ),
  Gem: (p: IconProps) => (
    <Svg {...p}>
      <path d="M5 3h10l3 5-8 10-8-10 3-5zm1.1 2L4.5 7.5H7l1-2.5H6.1zm4.3 0L9.3 7.5h1.4L9.6 5h.8zm3.5 0h-1.9l1 2.5h2.5L13.9 5zM7.1 9.5H5.3L9 14l-1.9-4.5zm2.2 0l.7 3.6.7-3.6H9.3zm3.6 0L11 14l3.7-4.5h-1.8z" />
    </Svg>
  ),
  Coin: (p: IconProps) => (
    <Svg {...p}>
      <path
        fillRule="evenodd"
        d="M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM4 10a6 6 0 1 1 12 0 6 6 0 0 1-12 0zm5-3h2v1h1.5v2H9.5v1H12v1.5h-1v1H9v-1H7.5v-2h2.5v-1H8V7.5h1V7z"
      />
    </Svg>
  ),
  Check: (p: IconProps) => (
    <Svg {...p}>
      <path d="M4 10.5l1.5-1.5 2.5 2.5 6.5-6.5L16 6.5 8 14.5z" />
    </Svg>
  ),
  Verified: (p: IconProps) => (
    <Svg {...p}>
      <path
        fillRule="evenodd"
        d="M10 1.5l2.1 1.8 2.75-.35 1 2.6 2.4 1.4-.6 2.7 1.15 2.5-2.15 1.75-.4 2.75-2.75.4L11.75 19.5 10 17.7l-1.75 1.8L6.5 17.05l-2.75-.4-.4-2.75L1.2 12.15l1.15-2.5-.6-2.7 2.4-1.4 1-2.6 2.75.35L10 1.5zm-1 12l5.5-5.5L13 6.5l-4 4-2-2L5.5 10 9 13.5z"
      />
    </Svg>
  ),
  Collapse: ({ flipped, ...p }: IconProps & { flipped?: boolean }) => (
    <Svg {...p} style={flipped ? { transform: "scaleX(-1)" } : undefined}>
      <path
        fillRule="evenodd"
        d="M16 16V4h2v12h-2zM6 9l2.5-2.5L7.086 5.086 2.172 10l4.914 4.914L8.5 13.5 6 11h6V9H6z"
      />
    </Svg>
  ),
  ChevronDown: (p: IconProps) => (
    <Svg {...p}>
      <path d="M10 13.5L4.5 8 5.914 6.586 10 10.672l4.086-4.086L15.5 8z" />
    </Svg>
  ),
  Play: (p: IconProps) => (
    <Svg {...p}>
      <path d="M5 3l12 7-12 7z" />
    </Svg>
  ),
  Speaker: ({ muted, ...p }: IconProps & { muted?: boolean }) => (
    <Svg {...p}>
      <path d="M2 7h3l4-3.5v13L5 13H2z" />
      {muted ? (
        <path d="M12.5 7.5l1.4-1.4 4.6 4.6-1.4 1.4-1.7-1.7-1.7 1.7-1.4-1.4 1.7-1.7-1.7-1.7 1.4-1.4 1.7 1.7z" />
      ) : (
        <>
          <path d="M12 6.7A4 4 0 0 1 12 13.3V11.5a2 2 0 0 0 0-3V6.7z" />
          <path d="M14 3.8A7 7 0 0 1 14 16.2v-2a5 5 0 0 0 0-8.4v-2z" />
        </>
      )}
    </Svg>
  ),
  Mic: ({ muted, ...p }: IconProps & { muted?: boolean }) => (
    <Svg {...p}>
      <path d="M7 5a3 3 0 0 1 6 0v4a3 3 0 0 1-6 0V5zm-2 4a5 5 0 0 0 4 4.9V16H7v2h6v-2h-2v-2.1A5 5 0 0 0 15 9h-2a3 3 0 0 1-6 0H5z" />
      {muted && <path d="M3 3.4L4.4 2l13 13-1.4 1.4z" />}
    </Svg>
  ),
  Video: (p: IconProps) => (
    <Svg {...p}>
      <path
        fillRule="evenodd"
        d="M2 5h11v3.2l4-2.2v8l-4-2.2V15H2V5zm2 2v6h7V7H4z"
      />
    </Svg>
  ),
  Pin: (p: IconProps) => (
    <Svg {...p}>
      <path d="M12 2l6 6-2.5.5-2.5 2.5.5 4.5L11 13l-4.5 4.5L5 16l4.5-4.5L7 9l4.5-.5L14 6z" />
    </Svg>
  ),
  Live: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="10" cy="10" r="4" />
    </Svg>
  ),
  Menu: (p: IconProps) => (
    <Svg {...p}>
      <path d="M3 5h14v2H3zm0 4h14v2H3zm0 4h14v2H3z" />
    </Svg>
  ),
  More: (p: IconProps) => (
    <Svg {...p}>
      <path d="M10 18a2 2 0 1 1 0-4 2 2 0 0 1 0 4zm0-6a2 2 0 1 1 0-4 2 2 0 0 1 0 4zm0-6a2 2 0 1 1 0-4 2 2 0 0 1 0 4z" />
    </Svg>
  ),
  Share: (p: IconProps) => (
    <Svg {...p}>
      <path d="M10 2l4.5 4.5L13 8l-2-2v7H9V6L7 8 5.5 6.5 10 2zM4 11h2v5h8v-5h2v7H4v-7z" />
    </Svg>
  ),
  Crown: (p: IconProps) => (
    <Svg {...p}>
      <path d="M3 6l4 3 3-5 3 5 4-3-1.5 9h-11z" />
    </Svg>
  ),
  Tv: (p: IconProps) => (
    <Svg {...p}>
      <path
        fillRule="evenodd"
        d="M2 4h16v10H11v1.5h3V17H6v-1.5h3V14H2V4zm2 2v6h12V6H4z"
      />
    </Svg>
  ),
  Bolt: (p: IconProps) => (
    <Svg {...p}>
      <path d="M11 2L4 11h5l-1 7 7-9h-5z" />
    </Svg>
  ),
};
