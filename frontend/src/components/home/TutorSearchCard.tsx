import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'

import { EDUCATION_LEVELS, LEARNING_MODES, SUBJECTS } from '@/features/tutorRequest/tutorRequest.constants'
import { buildTutorRequestHref } from '@/lib/tutorRequestQuery'

const CONTROL_CLASSES =
  'w-full appearance-none rounded-lg border border-ink-200 bg-white py-2.5 pl-3.5 pr-9 text-[0.95rem] text-ink-900 shadow-sm transition-[border-color,box-shadow] hover:border-ink-300 focus:border-brand-600 focus:ring-2 focus:ring-brand-500 focus:ring-offset-1'

/** Chevron drawn as a background image so the control stays a plain select. */
const CHEVRON_CLASSES =
  "[background-image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='none' stroke='%235b6879' stroke-width='1.8' stroke-linecap='round'%3E%3Cpath d='M5 8l5 5 5-5'/%3E%3C/svg%3E\")] bg-[length:20px_20px] bg-[right_0.6rem_center] bg-no-repeat"

/**
 * Discovery panel at the top of the homepage.
 *
 * This is discovery UI, not a matching engine: it collects three preferences
 * and forwards them to the existing request form, which is where a tutor is
 * actually arranged.
 */
export function TutorSearchCard() {
  const navigate = useNavigate()
  const [subject, setSubject] = useState('')
  const [educationLevel, setEducationLevel] = useState('')
  const [learningMode, setLearningMode] = useState('')

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    navigate(
      buildTutorRequestHref({
        subject,
        educationLevel,
        learningMode,
      }),
    )
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-2xl border border-ink-200 bg-white p-5 shadow-[0_10px_40px_-18px_rgba(18,26,36,0.28)] sm:p-6"      aria-labelledby="tutor-search-heading"
    >
      <h2
        id="tutor-search-heading"
        className="text-lg font-semibold text-ink-900 sm:text-xl"
      >
        What do you want to learn?
      </h2>
      <p className="mt-1.5 text-sm text-ink-500">
        Choose what you can — we will help you find a tutor who fits.
      </p>

      <div className="mt-5 flex flex-col gap-4">
        <div>
          <label htmlFor="search-subject" className="mb-1.5 block text-sm font-medium text-ink-700">
            Subject
          </label>
          <select
            id="search-subject"
            name="subject"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            className={`${CONTROL_CLASSES} ${CHEVRON_CLASSES}`}
          >
            <option value="">Any subject</option>
            {SUBJECTS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="search-level" className="mb-1.5 block text-sm font-medium text-ink-700">
              Level
            </label>
            <select
              id="search-level"
              name="level"
              value={educationLevel}
              onChange={(event) => setEducationLevel(event.target.value)}
              className={`${CONTROL_CLASSES} ${CHEVRON_CLASSES}`}
            >
              <option value="">Any level</option>
              {EDUCATION_LEVELS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="search-mode"
              className="mb-1.5 block text-sm font-medium text-ink-700"
            >
              Learning mode
            </label>
            <select
              id="search-mode"
              name="mode"
              value={learningMode}
              onChange={(event) => setLearningMode(event.target.value)}
              className={`${CONTROL_CLASSES} ${CHEVRON_CLASSES}`}
            >
              <option value="">Online or in person</option>
              {LEARNING_MODES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          type="submit"
          data-tedor-cta
          className="group inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-5 py-3.5 text-base font-medium text-white shadow-sm transition-colors hover:bg-brand-700"
        >
          Find a Tutor
          <svg
            aria-hidden="true"
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="transition-transform duration-150 group-hover:translate-x-0.5"
          >
            <path d="M2 8h11" />
            <path d="M9 4l4 4-4 4" />
          </svg>
        </button>

        <p className="text-center text-xs text-ink-500">
          No account needed. Our team reviews every request.
        </p>
      </div>
    </form>
  )
}
