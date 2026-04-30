'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { AccessDenied, RequireSuperAdmin } from '@/components/PermissionGate'
import { useSessionStorageState } from '@/hooks/useSessionStorageState'
import { useAuth } from '@/hooks/usePermissions'

type UploadRecord = {
  upload_id: string
  file_name: string | null
  source_system: string | null
  created_at: string
  parsed_rows?: number | null
  stored_events?: number | null
  students_updated?: number | null
  error_count?: number | null
}

type UploadResponse = {
  upload_id?: string
  analyzed?: number
  stored_events?: number
  students_updated?: number
  errors?: { row: number; message: string }[]
  error?: string
}

const sampleCsv = `student_id,student_name,grade,section,event_type,event_date,event_time,staff_name,class_context,location,category,subcategory,severity,points,notes
f2a6b2e0-0000-0000-0000-000000000001,Ayah Ali,6,A,merit,2025-01-08,09:15,Maryam Khan,Homeroom,Classroom,Leadership,Helping peers,minor,5,Positive support
f2a6b2e0-0000-0000-0000-000000000002,Adam Bashar,7,B,demerit,2025-01-09,10:30,Sarah Malik,Math,Classroom,Conduct,Talking,moderate,2,Disruptive talking
`

export default function BehaviourIntelligencePage() {
  const { isSuperAdmin, loading: authLoading, profile } = useAuth()
  const currentSchoolId = profile?.school_id ?? null
  const [file, setFile] = useState<File | null>(null)
  const [sourceSystem, setSourceSystem] = useSessionStorageState('admin:behaviour:sourceSystem', 'Manual Upload')
  const [uploading, setUploading] = useState(false)
  const [uploadResponse, setUploadResponse] = useState<UploadResponse | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [recentUploads, setRecentUploads] = useState<UploadRecord[]>([])
  const [refreshingUploads, setRefreshingUploads] = useState(false)
  const [behaviourAvailable, setBehaviourAvailable] = useState(true)

  const sampleCsvHref = useMemo(() => {
    return `data:text/csv;charset=utf-8,${encodeURIComponent(sampleCsv)}`
  }, [])

  const loadUploads = async () => {
    if (!currentSchoolId) {
      setRecentUploads([])
      setBehaviourAvailable(false)
      return
    }
    setRefreshingUploads(true)
    const { data, error } = await supabase
      .from('behaviour_uploads')
      .select('upload_id,file_name,source_system,created_at,parsed_rows,stored_events,students_updated,error_count')
      .eq('school_id', currentSchoolId)
      .order('created_at', { ascending: false })
      .limit(6)
    if (error) {
      if (error.message?.includes('does not exist')) {
        setBehaviourAvailable(false)
      }
      setRecentUploads([])
    } else {
      setRecentUploads(data || [])
    }
    setRefreshingUploads(false)
  }

  useEffect(() => {
    if (authLoading || !isSuperAdmin) return
    loadUploads()
  }, [authLoading, currentSchoolId, isSuperAdmin])

  const handleUpload = async () => {
    setUploadError(null)
    setUploadResponse(null)

    if (!file) {
      setUploadError('Please choose a CSV or PDF file to upload.')
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('source_system', sourceSystem.trim() || 'Manual Upload')

      const response = await fetch('/api/behaviour/upload', {
        method: 'POST',
        body: formData,
      })
      const contentType = response.headers.get('content-type') || ''
      const rawBody = (await response.text()).trim()
      let data: UploadResponse
      if (contentType.includes('application/json') && rawBody) {
        try {
          data = JSON.parse(rawBody) as UploadResponse
        } catch (error) {
          data = { error: `Upload failed: ${String(error)}` }
        }
      } else {
        data = { error: rawBody }
      }

      if (!response.ok) {
        setUploadError(data.error || 'Upload failed. Please review the file and try again.')
      } else {
        setUploadResponse(data)
        setFile(null)
        await loadUploads()
      }
    } catch (error) {
      setUploadError((error as Error).message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <RequireSuperAdmin fallback={<AccessDenied message="Super-admin access required." />}>
      <div>
      <div className="mb-8">
        <p className="text-xs font-semibold tracking-[0.2em] text-[#B8860B] mb-2">Behaviour Intelligence</p>
        <h1
          className="text-3xl font-bold text-[#1a1a1a] mb-2"
          style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}
        >
          Behaviour Intelligence Console
        </h1>
        <p className="text-[#1a1a1a]/60 max-w-2xl">
          Upload merit and demerit logs, track ingestion status, and trigger insight recomputation. All logic is rules-based and
          stored in Supabase for transparent auditability and stable recomputation.
        </p>
      </div>

      {!behaviourAvailable && (
        <div className="mb-6 bg-[#B8860B]/10 border border-[#B8860B]/30 text-[#1a1a1a] px-5 py-4 rounded-xl">
          Behaviour Intelligence tables are not available in this demo database yet.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-6">
        <div className="regal-card rounded-2xl p-6">
          <h2 className="text-xl font-semibold text-[#1a1a1a] mb-2" style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}>
            Analyse Behaviour Data
          </h2>
          <p className="text-sm text-[#1a1a1a]/60 mb-6">
            Upload discipline reports to generate insights. The system stores normalized raw events so later recomputation,
            overlapping uploads, and audit review all use the same event history.
          </p>

          <div className="grid gap-5">
            <div className="border border-dashed border-[#B8860B]/40 rounded-2xl p-5 bg-white/60">
              <label className="text-xs tracking-[0.2em] text-[#1a1a1a]/50">Behaviour file</label>
              <div className="mt-3 flex flex-col gap-3">
                <input
                  type="file"
                  accept=".csv,.pdf"
                  disabled={!behaviourAvailable}
                  onChange={(event) => setFile(event.target.files?.[0] || null)}
                  className="text-sm text-[#1a1a1a]/70 file:mr-4 file:rounded-xl file:border-0 file:bg-[#B8860B] file:px-4 file:py-2 file:text-white file:shadow-sm hover:file:bg-[#b08a1f]"
                />
                <div className="text-xs text-[#1a1a1a]/50">
                  CSV and PDF reports are supported. PDFs are parsed from the Discipline Event Summary format.
                </div>
                <a
                  href={sampleCsvHref}
                  download="behaviour_events_sample.csv"
                  className="text-xs text-[#2D5016] font-semibold underline underline-offset-4"
                >
                  Download sample CSV
                </a>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-[#B8860B]/20">
              <label className="text-xs tracking-[0.2em] text-[#1a1a1a]/50">Source system</label>
              <input
                value={sourceSystem}
                onChange={(event) => setSourceSystem(event.target.value)}
                disabled={!behaviourAvailable}
                className="mt-2 w-full rounded-xl border border-[#1a1a1a]/10 px-3 py-2 text-sm"
                placeholder="Manual Upload"
              />
            </div>

            {uploadError && (
              <div className="rounded-xl border border-[#910000]/20 bg-[#fff5f5] px-4 py-3 text-sm text-[#910000]">
                {uploadError}
              </div>
            )}

            <button
              onClick={handleUpload}
              disabled={uploading || !behaviourAvailable}
              className="rounded-xl bg-gradient-to-r from-[#2D5016] to-[#1e3610] px-6 py-3 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-60"
            >
              {uploading ? 'Processing...' : 'Process Behaviour File'}
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div className="regal-card rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-[#1a1a1a] mb-4" style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}>
              Latest Analysis Result
            </h3>
            {!uploadResponse && <p className="text-sm text-[#1a1a1a]/50">No analyses yet.</p>}
            {uploadResponse && (
              <div className="space-y-3 text-sm">
                {uploadResponse.error && <p className="text-[#910000]">{uploadResponse.error}</p>}
                <div className="flex items-center justify-between">
                  <span className="text-[#1a1a1a]/60">Upload ID</span>
                  <span className="font-semibold text-[#1a1a1a]">{uploadResponse.upload_id || '—'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#1a1a1a]/60">Events analysed</span>
                  <span className="font-semibold text-[#1a1a1a]">{uploadResponse.analyzed ?? 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#1a1a1a]/60">Events stored</span>
                  <span className="font-semibold text-[#1a1a1a]">{uploadResponse.stored_events ?? 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#1a1a1a]/60">Students updated</span>
                  <span className="font-semibold text-[#1a1a1a]">{uploadResponse.students_updated ?? 0}</span>
                </div>
                {uploadResponse.errors && uploadResponse.errors.length > 0 && (
                  <div className="rounded-xl border border-[#B8860B]/20 bg-[#fffaf0] px-4 py-3 text-xs text-[#1a1a1a]/70">
                    <p className="font-semibold text-[#1a1a1a] mb-2">Row issues</p>
                    <ul className="space-y-1">
                      {uploadResponse.errors.slice(0, 4).map((item) => (
                        <li key={`${item.row}-${item.message}`}>Row {item.row}: {item.message}</li>
                      ))}
                      {uploadResponse.errors.length > 4 && <li>+{uploadResponse.errors.length - 4} more</li>}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="regal-card rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-[#1a1a1a]" style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}>
                Recent Uploads
              </h3>
              <button
                onClick={loadUploads}
                className="text-xs font-semibold text-[#2D5016] underline underline-offset-4"
                disabled={refreshingUploads}
              >
                {refreshingUploads ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
            {recentUploads.length === 0 ? (
              <p className="text-sm text-[#1a1a1a]/50">No uploads recorded yet.</p>
            ) : (
              <div className="space-y-3 text-sm">
                {recentUploads.map((upload) => (
                  <div key={upload.upload_id} className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-[#1a1a1a]">{upload.file_name || 'Manual upload'}</p>
                      <p className="text-xs text-[#1a1a1a]/50">
                        {upload.source_system || 'Unknown source'}
                      </p>
                      <p className="text-xs text-[#1a1a1a]/40 mt-1">
                        Parsed {upload.parsed_rows ?? 0} rows, stored {upload.stored_events ?? 0} events, updated {upload.students_updated ?? 0} students
                      </p>
                    </div>
                    <div className="text-right text-xs text-[#1a1a1a]/50">
                      {new Date(upload.created_at).toLocaleString()}
                      {(upload.error_count ?? 0) > 0 ? <div>{upload.error_count} row issues</div> : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      </div>
    </RequireSuperAdmin>
  )
}
