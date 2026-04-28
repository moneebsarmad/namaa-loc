import type { Metadata } from 'next'
import './globals.css'
import { Toaster } from 'sonner'

export const metadata: Metadata = {
  // <!-- TODO Phase 3: read from school_settings -->
  title: '{{PROGRAM_NAME}} — {{SCHOOL_NAME}}',
  // <!-- TODO Phase 3: read from school_settings -->
  description: 'Internal tool for provisioning {{PROGRAM_NAME}} school databases.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-soft-gray font-sans antialiased">
        <nav className="bg-forest text-white px-6 py-3 flex items-center gap-3 shadow-md">
          {/* <!-- TODO Phase 3: read from school_settings --> */}
          <span className="text-lg font-bold tracking-wide">{'{{PROGRAM_NAME}}'}</span>
          <span className="text-white/40">|</span>
          {/* <!-- TODO Phase 3: read from school_settings --> */}
          <span className="text-white/80 text-sm">{'{{SCHOOL_NAME}}'}</span>
          <span className="ml-auto text-xs text-white/40 bg-white/10 px-2 py-0.5 rounded-full">Internal Tool — v1.0</span>
        </nav>
        <main className="max-w-5xl mx-auto px-4 py-8">
          {children}
        </main>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  )
}
