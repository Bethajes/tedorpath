import { fireEvent, render, screen } from '@testing-library/react'
import userEvent, { type UserEvent } from '@testing-library/user-event'
import { useForm } from 'react-hook-form'
import { afterEach, describe, expect, it } from 'vitest'

import { __setMarketsForTest } from '@/features/tutors/market'

import { EMPTY_FORM_DATA, type OnboardingFormData } from '../tutorOnboarding.types'

import { PricingStep } from './PricingStep'

/**
 * The pricing step.
 *
 * Two things are worth protecting here, and both are about what the tutor is asked.
 *
 * The first is that every offered market gets a field. The step used to name ETB
 * and USD in its own source, so a market added to the platform was invisible on the
 * one screen where a tutor sets prices — the tutor would never know they could sell
 * into it.
 *
 * The second is that a rate must be greater than zero. Zero used to be accepted on
 * the theory that a free first lesson is a stated price. It is not: a zero rate
 * sorts above every other tutor, filters under every budget and reads as free
 * lessons. Declining a market is how you offer something unusual.
 */

/**
 * Wraps the step in the form context it is written against, plus a submit button.
 *
 * The button matters. The wizard's `useForm` uses react-hook-form's default mode,
 * which validates on submit, so a message a tutor sees is one that appeared after
 * they pressed Next. A harness that validated on every keystroke would be testing
 * a form nobody ships.
 */
function Harness({ defaultValues }: { defaultValues?: Partial<OnboardingFormData> }) {
  const form = useForm<OnboardingFormData>({
    defaultValues: { ...EMPTY_FORM_DATA, ...defaultValues },
  })

  return (
    /*
     * Mirrors the page: `noValidate` on the form, and a Next button that calls
     * `trigger()` rather than a submit.
     *
     * Both details matter. Without `noValidate` the browser's own constraint
     * validation stops the submit on `max`, `min` and `step` before the rules in
     * this file ever run, so the tutor gets a native bubble instead of the message
     * written for them. And `trigger()` rather than `handleSubmit` is what the page
     * actually calls, so the harness fails if validation stops running on Next.
     */
    <form noValidate onSubmit={(event) => event.preventDefault()}>
      <PricingStep form={form} />
      <button type="button" onClick={() => void form.trigger()}>
        Next
      </button>
    </form>
  )
}

function renderStep(defaultValues?: Partial<OnboardingFormData>) {
  return render(<Harness defaultValues={defaultValues} />)
}

/**
 * Sets a number field's value.
 *
 * `user.type` does not build a value the way a browser does for `type="number"`:
 * it has no numeric model, so keystrokes like a leading minus or a third decimal
 * never reach the input. Typing them anyway would test the test harness rather than
 * the rule, so the value is set directly.
 */
function typeRate(user: UserEvent, field: HTMLElement, value: string) {
  fireEvent.change(field, { target: { value } })
  return user.click(screen.getByRole('button', { name: 'Next' }))
}

afterEach(() => {
  __setMarketsForTest(null)
})

describe('which markets are asked for', () => {
  it('asks for a rate in every market the platform sells in', () => {
    renderStep()

    expect(screen.getByLabelText(/Ethiopia students \(ETB\)/)).toBeInTheDocument()
    expect(screen.getByLabelText(/International students \(USD\)/)).toBeInTheDocument()
  })

  it('asks for a rate in a market added after this screen was written', () => {
    // The reason the fields are generated. Previously ETB and USD were named here,
    // so a third market was a row in the database and nothing else.
    __setMarketsForTest([
      { code: 'ETB', name: 'Ethiopia', currencyName: 'Ethiopian Birr', symbol: 'Br', decimals: 2, isDefault: false },
      { code: 'USD', name: 'International', currencyName: 'US Dollar', symbol: '$', decimals: 2, isDefault: true },
      { code: 'EUR', name: 'Europe', currencyName: 'Euro', symbol: '€', decimals: 2, isDefault: false },
    ])

    renderStep()

    expect(screen.getByLabelText(/Europe students \(EUR\)/)).toBeInTheDocument()
  })

  it('shows the rate a tutor already set', () => {
    renderStep({ rates: { ETB: '900', USD: '12' } })

    expect(screen.getByLabelText(/Ethiopia students \(ETB\)/)).toHaveValue(900)
    expect(screen.getByLabelText(/International students \(USD\)/)).toHaveValue(12)
  })

  it('says on every field that the price is the tutor\'s own', () => {
    renderStep()

    // The sentence that prevents the misunderstanding the whole design exists to
    // avoid: a tutor who thinks the second field is converted will set it to
    // whatever looks right, and that number becomes real.
    const hints = screen.getAllByText(/we do not convert it from your other rate/i)
    expect(hints).toHaveLength(2)
  })
})

describe('what counts as a rate', () => {
  it('rejects a rate of zero', async () => {
    const user = userEvent.setup()
    renderStep()

    const field = screen.getByLabelText(/Ethiopia students \(ETB\)/)
    await user.clear(field)
    await user.type(field, '0')
    await user.click(screen.getByRole('button', { name: 'Next' }))

    expect(await screen.findByText('An hourly rate must be greater than zero.')).toBeInTheDocument()
  })

  it('rejects a negative rate', async () => {
    const user = userEvent.setup()
    renderStep()

    await typeRate(user, screen.getByLabelText(/Ethiopia students \(ETB\)/), '-5')

    expect(await screen.findByText('An hourly rate must be greater than zero.')).toBeInTheDocument()
  })

  it('rejects more than two decimal places', async () => {
    const user = userEvent.setup()
    renderStep()

    await typeRate(user, screen.getByLabelText(/Ethiopia students \(ETB\)/), '900.123')

    expect(
      await screen.findByText('An hourly rate can have at most two decimal places.'),
    ).toBeInTheDocument()
  })

  it('rejects a rate above the ceiling', async () => {
    const user = userEvent.setup()
    renderStep()

    await typeRate(user, screen.getByLabelText(/Ethiopia students \(ETB\)/), '10000')

    expect(await screen.findByText(/9999\.99 or less/)).toBeInTheDocument()
  })

  it('accepts a positive rate', async () => {
    const user = userEvent.setup()
    renderStep()

    const field = screen.getByLabelText(/Ethiopia students \(ETB\)/)
    await user.type(field, '900')
    await user.click(screen.getByRole('button', { name: 'Next' }))

    expect(screen.queryByText(/An hourly rate/)).toBeNull()
  })

  it('accepts every market being left blank', async () => {
    // Serving one market and declining the others is normal, so it must not be an
    // error here. The completeness rule — at least one price — is checked at
    // submit, where the tutor can be told what is missing.
    const user = userEvent.setup()
    renderStep()

    await user.click(screen.getByRole('button', { name: 'Next' }))

    expect(screen.queryByText(/An hourly rate/)).toBeNull()
  })
})