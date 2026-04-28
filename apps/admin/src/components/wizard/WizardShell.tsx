'use client'

import type { WizardState, StepStatus } from '@/types/wizard'

interface Step {
  number: number
  label: string
  skippable?: boolean
}

const STEPS: Step[] = [
  { number: 1, label: 'School Profile' },
  { number: 2, label: 'Auth Config' },
  { number: 3, label: 'Calendar' },
  { number: 4, label: 'Houses' },
  { number: 5, label: 'Domains' },
  { number: 6, label: 'Points Taxonomy', skippable: true },
  { number: 7, label: 'Staff' },
  { number: 8, label: 'Students' },
  { number: 9, label: 'Parents', skippable: true },
  { number: 10, label: 'Thresholds' },
  { number: 11, label: 'Review & Provision' },
]

interface Props {
  state: WizardState
  children: React.ReactNode
  onNavigate: (step: number) => void
}

function stepDotClass(stepNum: number, state: WizardState): string {
  const status: StepStatus = state.stepStatuses[stepNum] ?? 'not_started'
  const isCurrent = stepNum === state.currentStep

  if (isCurrent) return 'bg-forest text-white ring-2 ring-forest ring-offset-2'
  if (status === 'complete') return 'bg-green-500 text-white'
  if (status === 'error') return 'bg-red-500 text-white'
  const step = STEPS[stepNum - 1]
  if (step?.skippable) return 'bg-yellow-100 text-yellow-700 border border-yellow-300'
  return 'bg-gray-200 text-gray-400'
}

function canNavigateTo(stepNum: number, state: WizardState): boolean {
  // Can always go back to completed steps
  const status: StepStatus = state.stepStatuses[stepNum] ?? 'not_started'
  if (status === 'complete') return true
  // Can go to current step
  if (stepNum === state.currentStep) return true
  // Can go forward only if all prior required steps are complete
  for (let i = 1; i < stepNum; i++) {
    const s: StepStatus = state.stepStatuses[i] ?? 'not_started'
    if (s !== 'complete' && !STEPS[i - 1]?.skippable) return false
  }
  return true
}

export function WizardShell({ state, children, onNavigate }: Props) {
  return (
    <div>
      {/* Step progress bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 shadow-sm overflow-x-auto">
        <div className="flex items-center gap-1 min-w-max">
          {STEPS.map((step, i) => (
            <div key={step.number} className="flex items-center">
              <button
                type="button"
                disabled={!canNavigateTo(step.number, state)}
                onClick={() => onNavigate(step.number)}
                title={step.label}
                className={`w-8 h-8 rounded-full text-xs font-bold transition-all flex items-center justify-center
                  ${stepDotClass(step.number, state)}
                  disabled:cursor-not-allowed disabled:opacity-50`}
              >
                {state.stepStatuses[step.number] === 'complete' ? '✓' : step.number}
              </button>
              {i < STEPS.length - 1 && (
                <div className={`w-6 h-0.5 mx-0.5 ${
                  (state.stepStatuses[step.number] ?? 'not_started') === 'complete' ? 'bg-green-400' : 'bg-gray-200'
                }`} />
              )}
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Step {state.currentStep} of 11 — <strong className="text-gray-600">{STEPS[state.currentStep - 1]?.label}</strong>
          {STEPS[state.currentStep - 1]?.skippable && (
            <span className="ml-2 text-yellow-600">(skippable)</span>
          )}
        </p>
      </div>

      {/* Step content */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 min-h-[400px]">
        {children}
      </div>
    </div>
  )
}

export { STEPS }
