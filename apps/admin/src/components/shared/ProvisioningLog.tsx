'use client'

import type { ProvisioningStepResult } from '@/types/wizard'
import { useState } from 'react'

interface Props {
  steps: ProvisioningStepResult[]
  currentStep: string | null
  error: string | null
}

function StatusIcon({ status }: { status: ProvisioningStepResult['status'] | 'running' | null }) {
  if (status === 'running' || status === null) {
    return <span className="inline-block w-4 h-4 border-2 border-forest border-t-transparent rounded-full animate-spin" />
  }
  if (status === 'success') return <span className="text-green-500 font-bold">✓</span>
  if (status === 'skipped') return <span className="text-gray-400">—</span>
  if (status === 'partial') return <span className="text-yellow-500 font-bold">⚠</span>
  return <span className="text-red-500 font-bold">✗</span>
}

export function ProvisioningLog({ steps, currentStep, error }: Props) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 text-sm font-semibold text-gray-700">
        Provisioning Progress
      </div>

      <div className="divide-y divide-gray-100">
        {steps.map((step, i) => (
          <div key={step.entity}>
            <div
              className="flex items-center gap-3 px-4 py-3 text-sm cursor-pointer hover:bg-gray-50"
              onClick={() => setExpandedIndex(expandedIndex === i ? null : i)}
            >
              <StatusIcon status={step.status} />
              <span className="font-medium text-gray-700 flex-1">{step.entity}</span>
              <span className="text-gray-400 text-xs">{step.rowsSucceeded}/{step.rowsAttempted} rows</span>
              <span className="text-gray-300 text-xs">{new Date(step.timestamp).toLocaleTimeString()}</span>
              {step.errorDetail.length > 0 && (
                <span className="text-xs text-red-500">{step.rowsFailed} failed ▾</span>
              )}
            </div>

            {expandedIndex === i && step.errorDetail.length > 0 && (
              <div className="px-4 pb-3 bg-red-50">
                <p className="text-xs font-semibold text-red-600 mb-1">Errors:</p>
                <ul className="text-xs text-red-700 space-y-0.5">
                  {step.errorDetail.slice(0, 10).map((e, j) => (
                    <li key={j}>· {JSON.stringify(e)}</li>
                  ))}
                  {step.errorDetail.length > 10 && (
                    <li className="text-red-400">…and {step.errorDetail.length - 10} more</li>
                  )}
                </ul>
              </div>
            )}
          </div>
        ))}

        {currentStep && (
          <div className="flex items-center gap-3 px-4 py-3 text-sm">
            <StatusIcon status="running" />
            <span className="text-gray-600 italic">{currentStep}…</span>
          </div>
        )}
      </div>

      {error && (
        <div className="px-4 py-3 bg-red-50 border-t border-red-100 text-sm text-red-700">
          <strong>Error:</strong> {error}
        </div>
      )}
    </div>
  )
}
