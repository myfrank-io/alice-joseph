import type { Metadata, Viewport } from "next";
import { fraunces, manrope } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Alice & Joseph",
    template: "%s · Alice & Joseph",
  },
  description: "Notre fil, nos photos, nos musiques, notre carte et nos jeux. Rien qu'à nous.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icone.svg", apple: "/icone.svg" },
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "Alice & Joseph", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8f6f4" },
    { media: "(prefers-color-scheme: dark)", color: "#17151a" },
  ],
};

/** Applique le thème choisi avant le premier rendu, pour éviter le flash. */
const themeScript = `try{var t=localStorage.getItem("aj-theme");if(t==="dark"||t==="light"){document.documentElement.setAttribute("data-theme",t)}}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${fraunces.variable} ${manrope.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
