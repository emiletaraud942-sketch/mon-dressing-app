import { useEffect, useState } from 'react'
import { getPhoto } from '../lib/photos'

export function PhotoThumb({ id, onClick }: { id: string; onClick?: () => void }) {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    let u: string | undefined
    getPhoto(id).then((b) => {
      if (b) setUrl((u = URL.createObjectURL(b)))
    })
    return () => {
      if (u) URL.revokeObjectURL(u)
    }
  }, [id])
  if (!url) return <div className="photo-thumb" />
  return <img className="photo-thumb" src={url} alt="" onClick={onClick} style={{ cursor: onClick ? 'pointer' : undefined }} />
}
