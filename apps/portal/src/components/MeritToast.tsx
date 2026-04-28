'use client'

import { useEffect, useState } from 'react'

interface MeritToastProps {
  studentName: string
  domain: string
  reason: string
  points: number
  onClose: () => void
}

export default function MeritToast({ studentName, domain, reason, points, onClose }: MeritToastProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isLeaving, setIsLeaving] = useState(false)

  useEffect(() => {
    // Trigger enter animation
    const showTimer = setTimeout(() => setIsVisible(true), 50)

    // Auto-dismiss after 6 seconds
    const dismissTimer = setTimeout(() => {
      setIsLeaving(true)
      setTimeout(onClose, 300)
    }, 6000)

    return () => {
      clearTimeout(showTimer)
      clearTimeout(dismissTimer)
    }
  }, [onClose])

  const handleClose = () => {
    setIsLeaving(true)
    setTimeout(onClose, 300)
  }

  const firstName = studentName.split(' ')[0] || studentName

  return (
    <div
      className={`fixed top-4 right-4 z-50 max-w-sm w-full transition-all duration-300 ${
        isVisible && !isLeaving
          ? 'opacity-100 translate-x-0'
          : 'opacity-0 translate-x-8'
      }`}
    >
      <div className="bg-white rounded-2xl shadow-xl border border-[#2D5016]/20 overflow-hidden">
        {/* Green accent bar */}
        <div className="h-1 bg-gradient-to-r from-[#2D5016] to-[#B8860B]" />

        <div className="p-4">
          <div className="flex items-start gap-4">
            {/* Hexagon Icon */}
            <div className="w-12 h-12 rounded-xl bg-[#2D5016]/10 flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-[#2D5016]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L3 7v10l9 5 9-5V7l-9-5zm0 2.18l6 3.33v6.98l-6 3.33-6-3.33V7.51l6-3.33z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </div>

            <div className="flex-1 min-w-0">
              <p className="font-semibold text-[#1a1a1a] text-lg leading-tight">
                Great {domain.toLowerCase()} adab, {firstName}!
              </p>
              <p className="text-sm text-[#1a1a1a]/60 mt-1 line-clamp-2">
                {reason}
              </p>
            </div>

            {/* Close button */}
            <button
              onClick={handleClose}
              className="text-[#1a1a1a]/30 hover:text-[#1a1a1a]/60 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Points Badge */}
          <div className="mt-3 flex justify-center">
            <div className="inline-flex items-center gap-2 bg-[#B8860B]/10 px-4 py-2 rounded-full">
              <svg className="w-5 h-5 text-[#B8860B]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L9.19 8.63L2 9.24l5.46 4.73L5.82 21L12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2z" />
              </svg>
              <span className="font-bold text-[#B8860B]">+{points} Points</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
