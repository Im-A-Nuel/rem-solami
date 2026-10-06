import type { Metadata, Viewport } from "next";
import { Hanken_Grotesk, IBM_Plex_Mono, Sora } from "next/font/google";
import "./globals.css";

// Display: Sora, a wide geometric sans. Used thin so headlines read like the reference's light, spaced
// lettering instead of editorial serif; one word per headline steps up in weight for emphasis.
const display = Sora({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const sans = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-sans",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Rem",
  description:
    "Non-custodial emergency brake for AI agent wallets on Solana. Lands a pre-signed revoke the moment a policy breaks.",
};

export const viewport: Viewport = {
  themeColor: "#05080d",
  colorScheme: "dark",
};

// Decides before first paint which motion mode runs, so reveals never flash visible and then hide.
// on = pinned scenes, lite = scenes flow normally and reveal on entry, off = reduced motion.
const motionProbe = `(function(){try{var m=window.matchMedia;var d=document.documentElement;if(!m('(prefers-reduced-motion: no-preference)').matches){d.dataset.motion='off'}else if(m('(min-width: 768px) and (min-height: 620px)').matches){d.dataset.motion='on'}else{d.dataset.motion='lite'}}catch(e){document.documentElement.dataset.motion='off'}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${sans.variable} ${mono.variable}`}
      data-motion="off"
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: motionProbe }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
