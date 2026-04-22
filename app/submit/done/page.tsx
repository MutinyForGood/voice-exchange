import Link from 'next/link'

export default function DonePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <div className="mb-4 text-4xl">🎙</div>
      <h1 className="mb-3 text-2xl font-bold">Voice note submitted</h1>
      <p className="mb-8 max-w-xs text-sm text-zinc-500">
        Your recording is in review. Once approved it will be shared anonymously with
        listeners.
      </p>
      <Link
        href="/listen"
        className="text-sm text-zinc-500 underline underline-offset-4 hover:text-zinc-900"
      >
        Hear someone else in the meantime
      </Link>
    </main>
  )
}
