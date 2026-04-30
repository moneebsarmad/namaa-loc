import type { User } from '@supabase/supabase-js'

import { createSupabaseServiceRoleClient } from '@namaa-loc/db/server'

export type AuditActor = {
  id: string | null
  email?: string | null
  role?: string | null
}

export type AuditRecord = {
  schoolId: string
  actor: AuditActor | User | null
  action: string
  targetType?: string | null
  targetId?: string | null
  metadata?: Record<string, unknown> | null
  request?: Request | null
}

function toActor(actor: AuditActor | User | null): AuditActor {
  if (!actor) return { id: null }
  if ('email' in actor || 'role' in actor) {
    const candidate = actor as Partial<AuditActor>
    return {
      id: candidate.id ?? null,
      email: candidate.email ?? null,
      role: candidate.role ?? null,
    }
  }
  const supabaseUser = actor as User
  return {
    id: supabaseUser.id ?? null,
    email: supabaseUser.email ?? null,
  }
}

function extractClientIp(request: Request | null | undefined): string | null {
  if (!request) return null
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first) return first
  }
  return request.headers.get('x-real-ip')
}

export async function writeAuditLog(record: AuditRecord): Promise<void> {
  const actor = toActor(record.actor ?? null)

  try {
    const supabaseAdmin = createSupabaseServiceRoleClient()
    const { error } = await supabaseAdmin.from('audit_log').insert({
      school_id: record.schoolId,
      actor_user_id: actor.id,
      actor_email: actor.email ?? null,
      actor_role: actor.role ?? null,
      action: record.action,
      target_type: record.targetType ?? null,
      target_id: record.targetId ?? null,
      metadata: record.metadata ?? null,
      ip: extractClientIp(record.request),
      user_agent: record.request?.headers.get('user-agent') ?? null,
    })

    if (error) {
      console.error('[audit] failed to write audit entry:', error.message, {
        action: record.action,
      })
    }
  } catch (error) {
    console.error('[audit] unexpected error writing audit entry:', error)
  }
}
