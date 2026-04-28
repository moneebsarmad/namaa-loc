import type { StepStatus } from '@/types/wizard'

const CONFIG: Record<StepStatus, { label: string; className: string }> = {
  not_started: { label: 'Not Started', className: 'bg-gray-100 text-gray-500' },
  complete: { label: 'Complete', className: 'bg-green-100 text-green-700' },
  error: { label: 'Error', className: 'bg-red-100 text-red-600' },
}

export function EntityStatusBadge({ status }: { status: StepStatus }) {
  const c = CONFIG[status]
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${c.className}`}>
      {c.label}
    </span>
  )
}
