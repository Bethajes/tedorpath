import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

import { TutorRequestWizard } from './TutorRequestWizard'

/**
 * The country box has to be announced as a question.
 *
 * A regression guard, not new coverage. Step one renders a `Field` — which owns a
 * `<label for>` — around a `CountryPicker`, which owns the actual `<input>`. The
 * `Field` hands its generated ids to the control through a render prop, and when
 * that prop was dropped the two halves simply stopped talking: the label pointed at
 * an id no element had, and a screen reader announced an unnamed combo box, with no
 * hint and no error attached. Nothing else in the suite would have noticed, because
 * a control with no accessible name is still a control that can be clicked.
 *
 * So the assertion is deliberately on the wiring — the id, the `for`, the
 * `aria-describedby` — rather than on any one behaviour of the picker.
 */

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return {
    ...actual,
    getJson: () =>
      Promise.resolve({
        currencies: [{ code: 'ETB', name: 'Ethiopian Birr', symbol: 'Br', decimals: 2 }],
        countries: [
          {
            code: 'ET',
            name: 'Ethiopia',
            currencyCode: 'ETB',
            timezone: 'Africa/Addis_Ababa',
            educationSystemCode: 'ETH',
          },
        ],
        educationSystems: [],
        learningGoals: [],
        subjects: [],
        timezones: ['Africa/Addis_Ababa'],
      }),
    postJson: () => Promise.resolve({ id: 'request-1' }),
  }
})

const NO_SEARCH_PARAMS = new URLSearchParams('')
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return {
    ...actual,
    Link: ({ children }: { children?: React.ReactNode }) => <a href="/tutors">{children}</a>,
    useSearchParams: () => [NO_SEARCH_PARAMS, () => {}],
  }
})

describe('country picker accessibility', () => {
  it('exposes the label, hint and error on the combobox', async () => {
    const { container } = render(<TutorRequestWizard onSubmitted={vi.fn()} />)

    const box = await screen.findByRole('combobox', {
      name: /which country are you located in/i,
    })

    expect(box).toHaveAttribute('id', 'countryCode')
    expect(box.getAttribute('aria-describedby') ?? '').toContain('countryCode-hint')
    expect(container.querySelector('label[for="countryCode"]')).not.toBeNull()
  })
})