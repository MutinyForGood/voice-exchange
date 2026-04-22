'use client'

import { useEffect, useState } from 'react'
import { Submission } from '@/types'
import { SubmissionCard } from './SubmissionCard'

type Tab = 'pending' | 'approved' | 'rejected'

export function AdminClient() {
  const [tab, setTab] = useState<Tab>('pending')
  const [submissions, setSubmissions] = useState<(Submission & { audioUrl: string })[]>(
    []
  )
  const [loading, setLoading] = useState(true)

  const load = async (status: Tab) => {
    setLoading(true)
    const res = await fetch(`/api/admin/submissions?status=${status}`)
    const data = await res.json()
    setSubmissions(data.submissions ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load(tab)
  }, [tab])

  const handleAction = async (
    id: string,
    action: 'approved' | 'rejected',
    notes?: string
  ) => {
    await fetch(`/api/submissions/${id}/moderate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, notes }),
    })
    load(tab)
  }

  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-6 text-2xl font-bold">Moderation queue</h1>

        <div className="mb-6 flex gap-2">
          {(['pending', 'approved', 'rejected'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-lg px-4 py-2 text-sm font-medium capitalize transition-colors ${
                tab === t
                  ? 'bg-zinc-900 text-white'
                  : 'bg-white text-zinc-600 hover:bg-zinc-100'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {loading && <p className="text-sm text-zinc-400">Loading...</p>}
        {!loading && submissions.length === 0 && (
          <p className="text-sm text-zinc-400">No {tab} submissions.</p>
        )}

        <div className="space-y-4">
          {submissions.map((s) => (
            <SubmissionCard key={s.id} submission={s} onAction={handleAction} />
          ))}
        </div>
      </div>
    </div>
  )
}
