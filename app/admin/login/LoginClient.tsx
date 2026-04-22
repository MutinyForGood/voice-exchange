'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/Button'

export function LoginClient() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/admin`,
        },
      })
      if (error) {
        setError(error.message)
      } else {
        setSent(true)
      }
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'We could not send the magic link.'
      )
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="max-w-sm text-center">
          <h1 className="mb-3 text-xl font-bold">Check your email</h1>
          <p className="text-sm text-zinc-500">
            We sent a magic link to <strong>{email}</strong>. Click it to sign in as
            admin.
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-2 text-2xl font-bold">Admin login</h1>
        <p className="mb-8 text-sm text-zinc-500">
          Enter your admin email to receive a magic link.
        </p>
        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@example.com"
            required
            className="rounded-lg border border-zinc-200 px-4 py-3 text-sm focus:ring-2 focus:ring-zinc-900 focus:outline-none"
          />
          <Button type="submit" disabled={loading} className="py-3">
            {loading ? 'Sending...' : 'Send magic link'}
          </Button>
        </form>
      </div>
    </main>
  )
}
