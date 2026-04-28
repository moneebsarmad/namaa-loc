'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../app/providers'
import MeritToast from './MeritToast'

interface MeritNotification {
  id: string
  studentName: string
  domain: string
  reason: string
  points: number
}

interface Domain {
  id: number
  display_name: string
}

export default function StudentNotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [linkedStudentId, setLinkedStudentId] = useState<string | null>(null)
  const [studentName, setStudentName] = useState<string>('')
  const [domains, setDomains] = useState<Domain[]>([])
  const [notifications, setNotifications] = useState<MeritNotification[]>([])
  const subscriptionRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  // Load linked student ID and domains
  useEffect(() => {
    if (!user?.id) {
      setLinkedStudentId(null)
      setStudentName('')
      return
    }

    const loadStudentData = async () => {
      // Get linked student ID from profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('linked_student_id')
        .eq('id', user.id)
        .maybeSingle()

      if (!profileData?.linked_student_id) {
        setLinkedStudentId(null)
        return
      }

      setLinkedStudentId(profileData.linked_student_id)

      // Get student name
      const { data: studentData } = await supabase
        .from('students')
        .select('student_name')
        .eq('student_id', profileData.linked_student_id)
        .maybeSingle()

      if (studentData?.student_name) {
        setStudentName(String(studentData.student_name))
      }

      // Load domains
      const { data: domainsData } = await supabase
        .from('merit_domains')
        .select('id, display_name')
        .eq('is_active', true)

      if (domainsData) {
        setDomains(domainsData.map(d => ({
          id: d.id,
          display_name: d.display_name || 'Achievement'
        })))
      }
    }

    loadStudentData()
  }, [user?.id])

  // Subscribe to merit_log inserts for this student
  useEffect(() => {
    if (!linkedStudentId) return

    // Clean up previous subscription
    if (subscriptionRef.current) {
      supabase.removeChannel(subscriptionRef.current)
    }

    const channel = supabase
      .channel(`student-merits-${linkedStudentId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'merit_log',
          filter: `student_id=eq.${linkedStudentId}`,
        },
        (payload) => {
          const newMerit = payload.new as Record<string, unknown>

          // Get domain name
          const domainId = newMerit.domain_id as number | null
          const domainName = domains.find(d => d.id === domainId)?.display_name || 'achievement'

          // Create notification
          const notification: MeritNotification = {
            id: `${Date.now()}-${Math.random()}`,
            studentName: studentName || 'Student',
            domain: domainName,
            reason: String(newMerit.subcategory || newMerit.r || 'Great work!'),
            points: Number(newMerit.points || 0),
          }

          setNotifications((prev) => [...prev, notification])
        }
      )
      .subscribe()

    subscriptionRef.current = channel

    return () => {
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current)
      }
    }
  }, [linkedStudentId, studentName, domains])

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }, [])

  return (
    <>
      {children}

      {/* Notification Stack */}
      <div className="fixed top-4 right-4 z-50 space-y-3">
        {notifications.map((notification, index) => (
          <div
            key={notification.id}
            style={{ transform: `translateY(${index * 8}px)` }}
          >
            <MeritToast
              studentName={notification.studentName}
              domain={notification.domain}
              reason={notification.reason}
              points={notification.points}
              onClose={() => removeNotification(notification.id)}
            />
          </div>
        ))}
      </div>
    </>
  )
}
