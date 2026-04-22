'use client'

import { useRef, useState } from 'react'
import { Button } from './Button'

interface AudioPlayerProps {
  src: string
  label?: string
}

export function AudioPlayer({ src, label }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)

  const toggle = () => {
    if (!audioRef.current) return
    if (playing) {
      audioRef.current.pause()
    } else {
      audioRef.current.play()
    }
    setPlaying(!playing)
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
      <Button variant="ghost" onClick={toggle} className="h-8 w-8 p-0">
        {playing ? '⏸' : '▶'}
      </Button>
      <div className="flex-1">
        {label && <p className="mb-1 text-xs text-zinc-500">{label}</p>}
        <div className="h-1 overflow-hidden rounded-full bg-zinc-200">
          <div className="h-full rounded-full bg-zinc-900" style={{ width: `${progress}%` }} />
        </div>
      </div>
      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={() => {
          if (!audioRef.current) return
          setProgress((audioRef.current.currentTime / audioRef.current.duration) * 100)
        }}
        onEnded={() => setPlaying(false)}
      />
    </div>
  )
}
