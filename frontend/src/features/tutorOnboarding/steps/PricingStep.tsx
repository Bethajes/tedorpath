import type { UseFormReturn } from 'react-hook-form'
import { Field, Input, Textarea } from '@/components/ui'
import { FormSection, FullWidth } from '@/components/form/FormSection'
import { knownMarkets } from '@/features/tutors/market'
import type { OnboardingFormData } from '../tutorOnboarding.types'

interface PricingStepProps {
  form: UseFormReturn<OnboardingFormData>
}

/** The ceiling, stated in every hint so the fields read the same. */
const MAX_RATE = '9999.99'

/**
 * The rule, applied to every market.
 *
 * Shared by all of them so they can never drift apart: a limit that exists for one
 * market and not another would be an arbitrary difference between two numbers on
 * the same screen.
 *
 * Strictly positive. A zero rate is not a price — it would sort above every other
 * tutor and filter under every budget, advertising free lessons the tutor never
 * offered. A tutor who wants to offer something unusual cannot express it by
 * leaving a field blank either, because both rates are required; they set the real
 * price and the detail goes in their availability.
 */
function validateRate(value: string): true | string {
  const trimmed = value.trim()
  if (trimmed === '') return 'Please enter your rate for this market.'

  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed)) return 'An hourly rate must be a number.'
  if (parsed <= 0) return 'An hourly rate must be greater than zero.'
  if (parsed > 9999.99) return `An hourly rate must be ${MAX_RATE} or less.`
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    return 'An hourly rate can have at most two decimal places.'
  }
  return true
}

/**
 * The hint under one market's field.
 *
 * Generated per market rather than written once, because the sentence that matters
 * is the one about what the number is *not*: it is not converted from the other
 * field. That has to be said on the field where a tutor is most likely to assume
 * otherwise, and saying it on both is the point — "we do not convert" is a claim
 * about the pair.
 */
function rateHint(market: { name: string; currencyName: string }): string {
  return (
    `What one hour of your teaching costs a ${market.name.toLowerCase()} student, ` +
    `in ${market.currencyName}. Up to ${MAX_RATE}. This is your own price — we do ` +
    `not convert it from your other rate.`
  )
}

export function PricingStep({ form }: PricingStepProps) {
  const {
    register,
    formState: { errors },
  } = form

  const markets = knownMarkets()
  const rateErrors = errors.rates ?? {}

  return (
    <div className="space-y-6">
      <FormSection
        title="Pricing & Availability"
        description="Set your rate for each market, and let students know when you are available."
      >
        {/*
          One field per market, generated from the market registry, rather than one
          field per currency named in this file. A dropdown would look tidier and
          would be wrong: it invites a tutor to think the number is being converted,
          and then their dollar rate is really just a birr rate with a label on it.
          Two numbers, each the tutor's own, is the honest shape.
        */}
        {markets.map((market) => {
          const fieldName = `rates.${market.code}` as const
          const error = rateErrors[market.code]

          return (
            <Field
              key={market.code}
              id={fieldName}
              label={`Hourly rate for ${market.name} students (${market.code})`}
              required
              hint={rateHint(market)}
              error={error?.message as string | undefined}
            >
              {(fieldProps) => (
                <Input
                  {...register(fieldName, { validate: validateRate })}
                  {...fieldProps}
                  type="number"
                  // Advisory attributes, kept in step with `validateRate` below.
                  // `min` was 0 while zero was still allowed; left alone it would
                  // have offered a spinner a value the rules reject, and told a
                  // browser's own validation that 0 was fine.
                  min="0.01"
                  max={MAX_RATE}
                  step="0.01"
                  inputMode="decimal"
                  placeholder="e.g. 900"
                  invalid={Boolean(error)}
                />
              )}
            </Field>
          )
        })}

        <div className="sm:col-span-2">
          <p className="rounded-lg border border-ink-200 bg-ink-50 px-4 py-3 text-xs leading-relaxed text-ink-600">
            Both rates are required, and each one is yours to set. We never convert one into
            the other and we never work out one from the other — a student in Ethiopia is
            shown your birr rate, and a student anywhere else is shown your dollar rate. You
            can change either of them at any time.
          </p>
        </div>

        <Field
          id="languages"
          label="Languages"
          hint="Comma-separated list of languages you can teach in (e.g. English, French)."
          error={errors.languages?.message}
        >
          {(fieldProps) => (
            <Input
              {...register('languages', {
                maxLength: {
                  value: 200,
                  message: 'Languages must be 200 characters or fewer.',
                },
              })}
              {...fieldProps}
              placeholder="English, French"
              invalid={Boolean(errors.languages)}
            />
          )}
        </Field>

        <FullWidth>
          <Field
            id="availability"
            label="Availability"
            hint="Describe when you are typically available for sessions. (max 300 characters)"
            error={errors.availability?.message}
          >
            {(fieldProps) => (
              <Textarea
                {...register('availability', {
                  maxLength: {
                    value: 300,
                    message: 'Availability must be 300 characters or fewer.',
                  },
                })}
                {...fieldProps}
                rows={4}
                maxLength={300}
                placeholder="e.g. Weekday evenings (6–9 pm) and weekend mornings."
                invalid={Boolean(errors.availability)}
              />
            )}
          </Field>
        </FullWidth>
      </FormSection>
    </div>
  )
}