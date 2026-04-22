'use client'

interface AudioPlayerProps {
  src: string
  label?: string
}

export function AudioPlayer({ src, label }: AudioPlayerProps) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
      {label && <p className="mb-2 text-xs text-zinc-500">{label}</p>}
      <audio
        controls
        preload="metadata"
        src={src}
        className="w-full"
      />
    </div>
  )
}
