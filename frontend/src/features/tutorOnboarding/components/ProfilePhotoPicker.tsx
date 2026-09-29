/**
 * ProfilePhotoPicker
 *
 * Lets a tutor choose a photo from their own device instead of pasting a link
 * to one hosted elsewhere. The file is uploaded as soon as it is chosen, so
 * the URL is already on the profile by the time the wizard moves on.
 *
 * Client-side checks (size, declared type) are a courtesy that saves a
 * pointless round trip. The server re-checks the real bytes and is the only
 * thing that decides what is actually stored.
 */

import { useId, useRef, useState } from 'react'

import { Button } from '@/components/ui'
import { resolveImageUrl } from '@/lib/api'

/** Mirrors the server limit so an oversized file is caught before uploading. */
const MAX_BYTES = 5 * 1024 * 1024

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** Inline SVG, matching the icon style used elsewhere in the app. */
function Icon({ path, className }: { path: string; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path d={path} />
    </svg>
  )
}

const UPLOAD_ICON =
  'M9.25 13.25a.75.75 0 0 1-.75-.75V4.5a.75.75 0 0 1 1.5 0v8a.75.75 0 0 1-.75.75Zm-2.72-2.72a.75.75 0 0 1 0 1.06l2.25 2.25a.75.75 0 0 0 1.06 0l2.25-2.25a.75.75 0 1 1 1.06 1.06l-2.78 2.78a1.75 1.75 0 0 1-2.47 0L5.53 11.59a.75.75 0 0 1 0-1.06ZM4 15.75a.75.75 0 0 1 .75.75v1.25h10.5v-1.25a.75.75 0 0 1 1.5 0v1.5a1.25 1.25 0 0 1-1.25 1.25H4.75A1.25 1.25 0 0 1 3.5 18.25v-1.5a.75.75 0 0 1 .75-.75Z'

const TRASH_ICON =
  'M8.5 4.5A1.5 1.5 0 0 1 10 3h1a1.5 1.5 0 0 1 1.5 1.5V5h3.25a.75.75 0 0 1 0 1.5H16v8.75a1.75 1.75 0 0 1-1.75 1.75H6.75A1.75 1.75 0 0 1 5 15.25V6.5H4.25a.75.75 0 0 1 0-1.5H8.5V4.5ZM9.5 5h2V4.5a.25.25 0 0 0-.25-.25h-1a.25.25 0 0 0-.25.25V5Zm-3 1.5v8.75c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25V6.5h-8Z'

const ERROR_ICON =
  'M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-11.25a.75.75 0 0 0-1.5 0v3.5a.75.75 0 0 0 1.5 0v-3.5Zm-.75 6a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z'

const SPINNER_ICON =
  'M10 3.5a6.5 6.5 0 1 0 6.5 6.5h-1.5A5 5 0 1 1 10 5V3.5Z'

export interface ProfilePhotoPickerProps {
  /** Currently stored photo path, or null/empty when there is none. */
  value: string | null
  /**
   * Called with the stored path after a successful upload, or with `null` when
   * the photo is removed. The parent writes this onto the form.
   */
  onChange: (url: string | null) => void
  /** Performs the upload; injected so the component stays free of API details. */
  onUpload: (file: File) => Promise<{ profilePhotoUrl: string }>
  /** Removes the stored photo. */
  onDelete: () => Promise<unknown>
  disabled?: boolean
}

export function ProfilePhotoPicker({
  value,
  onChange,
  onUpload,
  onDelete,
  disabled = false,
}: ProfilePhotoPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const errorId = useId()

  const resolved = resolveImageUrl(value)

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    // Reset immediately so choosing the same file twice still fires a change.
    event.target.value = ''
    if (!file) return

    setError(null)

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError('Please choose a JPEG, PNG, WebP or GIF image.')
      return
    }
    if (file.size > MAX_BYTES) {
      setError(`That image is ${formatBytes(file.size)}. Please choose one under 5 MB.`)
      return
    }

    setUploading(true)
    try {
      const result = await onUpload(file)
      onChange(result.profilePhotoUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That photo could not be uploaded.')
    } finally {
      setUploading(false)
    }
  }

  async function handleRemove() {
    setError(null)
    setRemoving(true)
    try {
      await onDelete()
      onChange(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That photo could not be removed.')
    } finally {
      setRemoving(false)
    }
  }

  const busy = uploading || removing

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-4">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-ink-200 bg-ink-100">
          {resolved ? (
            <img
              src={resolved}
              alt="Your profile photo preview"
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="text-xs text-ink-500">No photo</span>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-2">
          <input
            ref={inputRef}
            id="profile-photo-input"
            type="file"
            accept={ACCEPTED_TYPES.join(',')}
            onChange={handleFileChange}
            disabled={disabled || busy}
            className="sr-only"
            aria-describedby={error ? errorId : undefined}
            aria-invalid={error ? true : undefined}
          />

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => inputRef.current?.click()}
              disabled={disabled || busy}
            >
              {uploading ? (
                <>
                  <Icon path={SPINNER_ICON} className="h-4 w-4 animate-spin" />
                  Uploading&hellip;
                </>
              ) : (
                <>
                  <Icon path={UPLOAD_ICON} className="h-4 w-4" />
                  {resolved ? 'Choose a different photo' : 'Upload a photo'}
                </>
              )}
            </Button>

            {resolved && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleRemove}
                disabled={disabled || busy}
              >
                {removing ? (
                  <>
                    <Icon path={SPINNER_ICON} className="h-4 w-4 animate-spin" />
                    Removing&hellip;
                  </>
                ) : (
                  <>
                    <Icon path={TRASH_ICON} className="h-4 w-4" />
                    Remove
                  </>
                )}
              </Button>
            )}
          </div>

          <p className="text-xs text-ink-500">
            JPEG, PNG, WebP or GIF, up to 5 MB. Optional — we&rsquo;ll show your
            initials if you skip it.
          </p>
        </div>
      </div>

      {error && (
        <p
          id={errorId}
          role="alert"
          className="flex items-start gap-1.5 text-xs font-medium text-red-600"
        >
          <Icon path={ERROR_ICON} className="mt-px h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  )
}
