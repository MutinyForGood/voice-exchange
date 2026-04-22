import Link from 'next/link'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <h1 className="mb-3 text-4xl font-bold tracking-tight">Voice Exchange</h1>
      <p className="mb-10 max-w-sm text-lg text-zinc-500">
        Share your perspective. Hear from someone who sees things differently.
        Anonymous. Unfiltered. Real.
      </p>
      <div className="flex w-full max-w-xs flex-col gap-3">
        <Link
          href="/submit/survey"
          className="w-full rounded-lg bg-zinc-900 px-6 py-3 text-center text-sm font-medium text-white transition-colors hover:bg-zinc-700"
        >
          Share your voice
        </Link>
        <Link
          href="/listen"
          className="w-full rounded-lg bg-zinc-100 px-6 py-3 text-center text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-200"
        >
          Hear someone else
        </Link>
      </div>
    </main>
  )
}
