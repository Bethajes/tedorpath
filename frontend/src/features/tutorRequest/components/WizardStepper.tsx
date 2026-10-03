import { cn } from '@/lib/cn'

/**
 * Progress indicator for a multi-step form.
 *
 * Two renderings of one truth, because the same stepper has to work in a
 * 340px-wide phone and on a desktop:
 *
 *  - above `sm`, every step is a labelled dot, the current one widened and
 *    branded, completed ones tappable so going back is one click;
 *  - below it, the same information collapses to "Step 3 of 11" and a bar,
 *    because eleven labels do not fit and a truncated one is worse than none.
 *
 * The list is an `<ol>` with `aria-current="step"` on the active entry, which is
 * what a screen reader announces when the step changes, and the bar is marked up
 * as a progressbar with the same numbers so the two never disagree.
 */
export interface WizardStepperProps {
  steps: ReadonlyArray<{ id: string; label: string }>
  current: number
  /** The furthest step reached, so completed steps can be jumped back to. */
  furthest: number
  onStepClick: (index: number) => void
}

export function WizardStepper({ steps, current, furthest, onStepClick }: WizardStepperProps) {
  const currentStep = steps[current]
  const percent = Math.round(((current + 1) / steps.length) * 100)

  return (
    <nav aria-label="Request progress" className="mb-8">
      {/* Text + bar: the mobile rendering, and the only thing a small screen
          shows. `sm:hidden` rather than hidden at the other end, so the order
          in the DOM matches what is on screen. */}
      <div className="sm:hidden">
        <p className="mb-2 text-sm font-medium text-ink-700">
          Step {current + 1} of {steps.length}
          <span className="text-ink-500"> · {currentStep.label}</span>
        </p>
        <div
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={steps.length}
          aria-valuenow={current + 1}
          aria-valuetext={`Step ${current + 1} of ${steps.length}: ${currentStep.label}`}
          className="h-1.5 w-full overflow-hidden rounded-full bg-ink-200"
        >
          <div
            className="h-full rounded-full bg-brand-600 transition-[width] duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      {/* Labelled dots: the desktop rendering. */}
      <ol className="hidden items-center gap-2 sm:flex">
        {steps.map((step, index) => {
          const isCurrent = index === current
          const isDone = index < current
          const isReachable = index <= furthest

          return (
            <li key={step.id} className="flex flex-1 flex-col items-center gap-1.5">
              <button
                type="button"
                // Forward steps are not reachable until they have been passed,
                // so the control is disabled rather than silently inert.
                disabled={!isReachable}
                onClick={() => onStepClick(index)}
                aria-current={isCurrent ? 'step' : undefined}
                aria-label={`Step ${index + 1}: ${step.label}${isCurrent ? ' (current step)' : ''}${isDone ? ' (completed)' : ''}`}
                className={cn(
                  'w-full rounded-lg py-1 text-center transition-colors',
                  isReachable ? 'cursor-pointer' : 'cursor-not-allowed',
                  isCurrent ? 'text-brand-700' : 'text-ink-500',
                )}
              >
                <span
                  className={cn(
                    'mx-auto block h-2 rounded-full transition-all',
                    isCurrent
                      ? 'w-8 bg-brand-600'
                      : isDone
                        ? 'w-2 bg-brand-400'
                        : isReachable
                          ? 'w-2 bg-ink-300'
                          : 'w-2 bg-ink-200',
                  )}
                />
                <span className="mt-1.5 block truncate text-[0.7rem] font-medium">{step.label}</span>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}