import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'AI Ghostwriter — Your Book, Your Voice',
  description:
    'An AI-powered ghostwriting service that interviews you over 10–20 hours, ' +
    'discovers your stories, and produces a complete draft manuscript in your voice.',
  metadataBase: new URL('https://aighostwriter.org'),
  openGraph: {
    title: 'AI Ghostwriter — Your Book, Your Voice',
    description: 'Turn your expertise into a book through guided AI interviews.',
    url: 'https://aighostwriter.org',
    siteName: 'AIGhostwriter.org',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="min-h-screen bg-ink-950 text-parchment-100 antialiased">
        {children}
      </body>
    </html>
  )
}
