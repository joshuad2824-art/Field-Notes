import { useEffect, useState } from 'react'
import { IMAGE_RE, type Page } from '../lib/model'
import { imageUrl } from '../lib/images'

// A presentation of the existing first image only. No record, file, or image
// bytes are created or changed by rendering a thumbnail.
export function DeskThumbnail({ page, kind = 'project' }: { page: Page; kind?: 'project' | 'plan' | 'equipment' }) {
  const match = page.body.match(new RegExp(IMAGE_RE.source))
  const id = match?.[2]
  const [picture, setPicture] = useState<{ id: string; url: string } | null>(null)
  useEffect(() => {
    let active = true
    if (id) void imageUrl(id).then((url) => { if (active) setPicture(url ? { id, url } : null) }).catch(() => { if (active) setPicture(null) })
    return () => { active = false }
  }, [id])
  return id && picture?.id === id ? <div className={`desk-thumbnail desk-thumbnail-${kind}`}><img src={picture.url} alt={match?.[1] || 'Image from the source page'} /></div> : null
}
