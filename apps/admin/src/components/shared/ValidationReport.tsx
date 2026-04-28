'use client'

import { useState } from 'react'
import type { ValidationResult, RowValidationResult } from '@/types/wizard'

interface Props {
  result: ValidationResult
  onAcknowledgeWarnings?: () => void
  warningsAcknowledged?: boolean
}

const SEVERITY_STYLE: Record<string, string> = {
  valid: 'text-green-600',
  warning: 'text-yellow-600',
  error: 'text-red-600',
}

export function ValidationReport({ result, onAcknowledgeWarnings, warningsAcknowledged }: Props) {
  const [expanded, setExpanded] = useState(false)

  const nonValid = result.results.filter((r) => r.severity !== 'valid')
  const hasErrors = result.errorRows > 0
  const hasWarnings = result.warningRows > 0

  return (
    <div className="mt-4 rounded-xl border border-gray-200 overflow-hidden">
      {/* Summary bar */}
      <div className="flex items-center gap-6 px-4 py-3 bg-gray-50 text-sm font-medium border-b border-gray-200">
        <span className="text-gray-700">{result.totalRows} rows parsed</span>
        <span className="text-green-600">{result.validRows} valid</span>
        {hasWarnings && <span className="text-yellow-600">{result.warningRows} warnings</span>}
        {hasErrors && <span className="text-red-600">{result.errorRows} errors</span>}
        {nonValid.length > 0 && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="ml-auto text-xs text-gray-500 hover:text-gray-700 underline"
          >
            {expanded ? 'Hide details' : 'Show details'}
          </button>
        )}
      </div>

      {/* Row-level errors/warnings */}
      {expanded && nonValid.length > 0 && (
        <div className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
          {nonValid.map((r: RowValidationResult) => (
            <div key={r.rowIndex} className="px-4 py-2 text-sm">
              <span className={`font-medium ${SEVERITY_STYLE[r.severity]} mr-2`}>
                Row {r.rowIndex + 1}
              </span>
              {r.messages.map((msg, i) => (
                <span key={i} className="text-gray-600 mr-2">· {msg}</span>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Warning acknowledgement */}
      {hasWarnings && !hasErrors && onAcknowledgeWarnings && (
        <div className="px-4 py-3 bg-yellow-50 border-t border-yellow-100 flex items-center gap-3">
          <input
            type="checkbox"
            id="ack-warnings"
            checked={warningsAcknowledged}
            onChange={onAcknowledgeWarnings}
            className="accent-yellow-600"
          />
          <label htmlFor="ack-warnings" className="text-sm text-yellow-700">
            I acknowledge these warnings and want to proceed with import
          </label>
        </div>
      )}

      {hasErrors && (
        <div className="px-4 py-3 bg-red-50 border-t border-red-100 text-sm text-red-700">
          Fix all errors before proceeding. Re-upload a corrected CSV.
        </div>
      )}
    </div>
  )
}
