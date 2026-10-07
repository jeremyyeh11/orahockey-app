import type { Metadata, Viewport } from 'next'
import { IBM_Plex_Mono, Inter, Sora } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-inter',
  display: 'swap',
})

const sora = Sora({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-sora',
  display: 'swap',
})

const ligaMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-liga-mono',
  display: 'swap',
  preload: false,
})

export const metadata: Metadata = {
  // Pages set a short title ("Squad"); the template makes it "Squad · ORA Hockey"
  title: { default: 'ORA Hockey', template: '%s · ORA Hockey' },
  description: 'ORA Hockey — MHL1 Team Management',
  manifest: '/manifest.json',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0f172a',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`dark ${inter.variable} ${sora.variable} ${ligaMono.variable}`}>
      <body>{children}</body>
    </html>
  )
}
