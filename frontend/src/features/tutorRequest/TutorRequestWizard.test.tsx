import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { TutorRequestWizard } from './TutorRequestWizard'
import type { OnboardingConfig } from './tutorRequest.config'

/**
 * The wizard, end to end, with only the two network calls stubbed.
 *
 * Behaviour rather than snapshots: what matters about an adaptive form is the
 * *consequences* of an answer — which currency appears, which subjects are
 * offered, whether a location is demanded, whether changing the country touches
 * the money — and each of those is asserted here directly.
 *
 * Queries go through roles and accessible names rather than text matching. That
 * is also the assertion: if a label stops being wired to its control, or a card
 * group stops being a real radio group, these tests stop finding things.
 */

const submitMock = vi.fn()
const configMock = vi.fn()

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return {
    ...actual,
    getJson: (path: string) => {
      if (path !== '/api/onboarding/config') {
        return Promise.reject(new Error(`unexpected GET ${path}`))
      }
      return configMock()
    },
    postJson: (path: string, body: unknown) => {
      if (path !== '/api/tutor-requests') {
        return Promise.reject(new Error(`unexpected POST ${path}`))
      }
      submitMock(body)
      return Promise.resolve({ id: 'request-1' })
    },
  }
})

/** A stable instance, so the wizard's prefill memo is not invalidated per render. */
const NO_SEARCH_PARAMS = new URLSearchParams('')

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return {
    ...actual,
    // The review step links out to the directory. A real router would need a
    // memory history per test for one link that is not what is under test.
    Link: ({ children }: { children?: React.ReactNode }) => <a href="/tutors">{children}</a>,
    useSearchParams: () => [NO_SEARCH_PARAMS, () => {}],
  }
})

const CONFIG: OnboardingConfig = {
  currencies: [
    { code: 'ETB', name: 'Ethiopian Birr', symbol: 'Br', decimals: 2 },
    { code: 'USD', name: 'US Dollar', symbol: '$', decimals: 2 },
  ],
  countries: [
    {
      code: 'ET',
      name: 'Ethiopia',
      currencyCode: 'ETB',
      timezone: 'Africa/Addis_Ababa',
      educationSystemCode: 'ETH',
    },
    {
      code: 'US',
      name: 'United States',
      currencyCode: 'USD',
      timezone: 'America/New_York',
      educationSystemCode: 'INT',
    },
  ],
  educationSystems: [
    {
      code: 'INT',
      name: 'International (general)',
      description: null,
      levels: [
        {
          code: 'int-high',
          name: 'High School',
          stage: 'Senior Secondary',
          aliases: ['Senior Secondary'],
          subjectIds: ['sub-english'],
        },
      ],
    },
    {
      code: 'ETH',
      name: 'Ethiopian education system',
      description: null,
      levels: [
        {
          code: 'eth-grade-9-10',
          name: 'Grades 9–10',
          stage: 'Senior Secondary',
          aliases: ['Grade 9'],
          subjectIds: ['sub-maths', 'sub-physics'],
        },
      ],
    },
  ],
  learningGoals: [
    { code: 'exam-preparation', name: 'Exam preparation', description: 'Before a big test.' },
    { code: 'other', name: 'Something else', description: null },
  ],
  subjects: [
    {
      id: 'sub-maths',
      name: 'Mathematics',
      slug: 'mathematics',
      category: 'School Subjects',
      description: null,
    },
    {
      id: 'sub-physics',
      name: 'Physics',
      slug: 'physics',
      category: 'School Subjects',
      description: null,
    },
    {
      id: 'sub-english',
      name: 'English',
      slug: 'english',
      category: 'School Subjects',
      description: null,
    },
    { id: 'sub-other', name: 'Other', slug: 'other', category: 'Other', description: null },
  ],
  timezones: ['Africa/Addis_Ababa', 'America/New_York'],
}

type User = ReturnType<typeof userEvent.setup>

/** Renders the wizard and waits for its reference data. */
async function renderWizard(onSubmitted = vi.fn()) {
  const user = userEvent.setup()
  render(<TutorRequestWizard onSubmitted={onSubmitted} />)
  await screen.findByRole('combobox', { name: /which country are you located in/i })
  return { user, onSubmitted }
}

const continueButton = () => screen.getByRole('button', { name: 'Continue' })
const backButton = () => screen.getByRole('button', { name: 'Back' })
const countrySelect = () => screen.getByRole('combobox', { name: /which country are you located in/i })

/**
 * Waits for the step currently on screen to have the given heading.
 *
 * Async on purpose: `Continue` runs an async validation before it changes step,
 * so a synchronous query here would run against the previous step's DOM.
 */
const stepHeading = (name: RegExp) => screen.findByRole('heading', { level: 2, name })

/* ------------------------------------------------------------------- steps */

/**
 * Picks a country by typing its name and choosing the option.
 *
 * Typing rather than selecting because the control is a searchable combobox, not a
 * `<select>`. The two are not interchangeable through the DOM, so a test using
 * `selectOptions` here would be exercising a control the wizard does not have.
 */
/**
 * Picks a country by typing its name and choosing the option.
 *
 * Typing rather than selecting because the control is a searchable combobox, not a
 * `<select>`; the two are not interchangeable through the DOM, so `selectOptions`
 * here would be exercising a control the wizard does not have.
 *
 * The click-then-type order is deliberate. Clicking first is what puts focus on the
 * box and lets its focus handler replace the box's contents with the currently
 * selected country, so the type that follows lands in an empty field instead of
 * after the existing answer — "EthiopiaUnited States" matches nothing, and the
 * option the test is looking for is not on the page. Clicking first also re-opens
 * the list, so a second country can be chosen at all.
 */
async function chooseCountry(user: User, country: 'Ethiopia' | 'United States') {
  const box = countrySelect()
  await user.click(box)
  await user.clear(box)
  await user.type(box, country)
  await user.click(screen.getByRole('option', { name: country }))
}

/**
 * Answers the country and the education level, and lands on the subjects step.
 *
 * The entry point for every journey through the wizard. Each helper below starts
 * from the step it was left on, so a test says which steps it is exercising and
 * the rest is setup.
 */
async function throughSubjects(
  user: User,
  options: { country?: 'Ethiopia' | 'United States'; level?: RegExp } = {},
) {
  await chooseCountry(user, options.country ?? 'Ethiopia')
  await user.click(continueButton())
  await user.click(await screen.findByRole('radio', { name: options.level ?? /grades 9–10/i }))
  await user.click(continueButton())
  await stepHeading(/which subjects/i)
}

/** Ticks subjects on the step `throughSubjects` lands on. */
async function chooseSubjects(user: User, names: readonly string[]) {
  for (const name of names) {
    await user.click(await screen.findByRole('checkbox', { name }))
  }
  await user.click(continueButton())
  await stepHeading(/hoping to achieve/i)
}

/** Answers the learning goal. */
async function chooseGoal(user: User, name: RegExp) {
  await user.click(await screen.findByRole('radio', { name }))
  await user.click(continueButton())
  await stepHeading(/how would you like to learn/i)
}

/** Answers the teaching mode. */
async function chooseMode(user: User, name: RegExp) {
  await user.click(await screen.findByRole('radio', { name }))
  await user.click(continueButton())
  await stepHeading(/where would you like to meet/i)
}

/** Answers everything up to and including the learning goal. */
async function throughGoal(
  user: User,
  options: { country?: 'Ethiopia' | 'United States'; level?: RegExp } = {},
) {
  await throughSubjects(user, options)
  await chooseSubjects(user, ['Mathematics', 'Physics'])
  await chooseGoal(user, /exam preparation/i)
}

/** Answers everything up to and including an online teaching mode. */
async function throughMode(
  user: User,
  options: { country?: 'Ethiopia' | 'United States'; level?: RegExp } = {},
) {
  await throughGoal(user, options)
  await chooseMode(user, /^online/i)
}

/** Clicks Continue and waits for the step it should arrive at. */
async function advanceTo(user: User, heading: RegExp) {
  await user.click(continueButton())
  await stepHeading(heading)
}

/** Answers the location step and lands on the availability step. */
async function throughAvailability(user: User) {
  await advanceTo(user, /when are you free/i)
}

/** Answers the availability step and lands on the budget step. */
async function throughBudget(user: User) {
  await throughAvailability(user)
  await advanceTo(user, /what budget/i)
}

/** Fills the budget step and moves on. */
async function setBudget(user: User, budget: { amount?: string; currency?: string }) {
  const amount = await screen.findByRole('textbox', { name: 'Amount' })
  if (budget.amount) await user.type(amount, budget.amount)

  if (budget.currency) {
    await user.selectOptions(screen.getByRole('combobox', { name: /^Currency/ }), budget.currency)
  }

  await user.click(continueButton())
  await stepHeading(/tell us a little more/i)
}

const reviewSummary = () => screen.getByRole('region', { name: /request summary/i })

beforeEach(() => {
  submitMock.mockReset()
  configMock.mockReset()
  configMock.mockResolvedValue(CONFIG)
})

// ---------------------------------------------------------------------------
// Loading and failure
// ---------------------------------------------------------------------------

describe('loading and failure states', () => {
  it('says it is loading rather than showing an empty form', async () => {
    configMock.mockReturnValue(new Promise(() => {}))
    render(<TutorRequestWizard onSubmitted={vi.fn()} />)

    expect(await screen.findByRole('status')).toHaveTextContent(/loading/i)
    expect(screen.queryByRole('combobox', { name: /which country are you located in/i })).not.toBeInTheDocument()
  })

  it('offers a retry when the configuration cannot be loaded', async () => {
    // The wizard has no option lists of its own, so a failure is fatal: it must
    // not render a form whose every dropdown is empty and whose every answer the
    // server would reject.
    configMock.mockRejectedValue(new Error('boom'))
    const user = userEvent.setup()
    render(<TutorRequestWizard onSubmitted={vi.fn()} />)

    expect(
      await screen.findByRole('heading', { name: /could not load the request form/i }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: /which country are you located in/i })).not.toBeInTheDocument()

    configMock.mockResolvedValue(CONFIG)
    await user.click(screen.getByRole('button', { name: /try again/i }))

    expect(await screen.findByRole('combobox', { name: /which country are you located in/i })).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Step 1 — country
// ---------------------------------------------------------------------------

describe('step one — country', () => {
  it('will not advance without a country', async () => {
    const { user } = await renderWizard()

    // Cleared rather than left at the Ethiopia default, so this still tests the
    // "no answer" path. It used to be the only way to be on this step with the
    // field empty; now the step opens with Ethiopia preselected, and the check that
    // a blank field is refused needs to be asked for explicitly.
    await user.click(countrySelect())
    await user.clear(countrySelect())

    await user.click(continueButton())

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /choose the country you are based in/i,
    )
    expect(countrySelect()).toHaveAttribute('aria-invalid', 'true')
    await expect(stepHeading(/where are you based/i)).resolves.toBeInTheDocument()
  })

  it('opens with Ethiopia preselected, because that is where most people are', async () => {
    // A required field, first on the form, and empty, is a dead step for the
    // overwhelming majority of people who open it. Ethiopia is the site\'s home
    // market and the default, so it is the answer almost everybody wants.
    //
    // Preselected, not assumed: the step still asks, still names what is preselected,
    // and still explains the consequence. The next test covers that.
    const { user } = await renderWizard()

    expect(countrySelect()).toHaveValue('Ethiopia')
    expect(screen.getByText(/preselected: ethiopia/i)).toBeInTheDocument()

    // And it can be answered straight through, with no interaction on the country
    // step at all. The point of preselecting: a parent in Addis who knows the answer
    // should be two clicks from the third step, not four.
    await user.click(continueButton())
    await expect(stepHeading(/what level are you studying at/i)).resolves.toBeInTheDocument()
  })

  it('says which of a tutor\'s prices the country will show', async () => {
    // The consequence of the answer, stated before the request is sent rather than
    // discovered afterwards. Ethiopia is the local market, so it is the birr price;
    // everywhere else is the international one.
    const { user } = await renderWizard()

    expect(screen.getByText(/ethiopian rates, in birr/i)).toBeInTheDocument()

    await chooseCountry(user, 'United States')
    expect(screen.getByText(/international rates, in dollars/i)).toBeInTheDocument()
  })

  it('names the currency the country will use, before it is chosen', async () => {
    const { user } = await renderWizard()

    await chooseCountry(user, 'Ethiopia')

    expect(
      await screen.findByText(/we will use ethiopian birr \(etb\)/i),
    ).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// The country drives the curriculum
// ---------------------------------------------------------------------------

describe('the country decides what is offered next', () => {
  it('offers Ethiopian grades to Ethiopia and generic levels to the US', async () => {
    const { user } = await renderWizard()

    await chooseCountry(user, 'Ethiopia')
    await user.click(continueButton())

    expect(await screen.findByRole('radio', { name: /grades 9–10/i })).toBeInTheDocument()
    expect(screen.queryByRole('radio', { name: /^high school/i })).not.toBeInTheDocument()

    await user.click(backButton())
    await chooseCountry(user, 'United States')
    await user.click(continueButton())

    expect(await screen.findByRole('radio', { name: /^high school/i })).toBeInTheDocument()
    expect(screen.queryByRole('radio', { name: /grades 9–10/i })).not.toBeInTheDocument()
  })

  it('drops a level from another curriculum when the country changes', async () => {
    const { user } = await renderWizard()

    await chooseCountry(user, 'Ethiopia')
    await user.click(continueButton())
    await user.click(await screen.findByRole('radio', { name: /grades 9–10/i }))
    await user.click(continueButton())
    expect(
      await screen.findByRole('region', { name: /commonly taught at grades 9–10/i }),
    ).toBeInTheDocument()

    // Switching country must not leave a selection pointing at a level that is
    // no longer offered anywhere on the step.
    await screen.getByRole('button', { name: /step 1: country/i }).click()
    await chooseCountry(user, 'United States')
    await user.click(continueButton())

    expect(await screen.findByRole('radio', { name: /^high school/i })).not.toBeChecked()
  })
})

// ---------------------------------------------------------------------------
// Step 2 — education level, and the suggestions it drives
// ---------------------------------------------------------------------------

describe('step two — the education level', () => {
  it('will not advance without one', async () => {
    const { user } = await renderWizard()

    await chooseCountry(user, 'Ethiopia')
    await user.click(continueButton())
    await user.click(await screen.findByRole('button', { name: 'Continue' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /choose your education level/i,
    )
  })

  it('suggests the subjects that level covers, and keeps the rest available', async () => {
    const { user } = await renderWizard()
    await throughSubjects(user)

    const suggested = await screen.findByRole('region', {
      name: /commonly taught at grades 9–10/i,
    })
    expect(within(suggested).getByRole('checkbox', { name: 'Mathematics' })).toBeInTheDocument()
    expect(within(suggested).getByRole('checkbox', { name: 'Physics' })).toBeInTheDocument()

    // English is not linked to that level, but it is still reachable — a
    // suggestion is a starting point, never a limit.
    expect(screen.getByRole('checkbox', { name: 'English' })).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Step 3 — subjects
// ---------------------------------------------------------------------------

describe('step three — subjects', () => {
  it('requires at least one', async () => {
    const { user } = await renderWizard()
    await throughSubjects(user)

    await user.click(await screen.findByRole('button', { name: 'Continue' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/at least one subject/i)
  })

  it('accepts several at once and says how many', async () => {
    const { user } = await renderWizard()
    await throughSubjects(user)

    await user.click(await screen.findByRole('checkbox', { name: 'Mathematics' }))
    await user.click(screen.getByRole('checkbox', { name: 'Physics' }))

    expect(await screen.findByText(/2 subjects selected/i)).toBeInTheDocument()
  })

  it('asks what "Other" means, and insists on an answer', async () => {
    const { user } = await renderWizard()
    await throughSubjects(user)

    await user.click(await screen.findByRole('checkbox', { name: 'Other' }))
    const other = await screen.findByRole('textbox', { name: /what subject do you mean/i })

    await user.click(continueButton())
    expect(await screen.findByRole('alert')).toHaveTextContent(
      /tell us which subject you mean/i,
    )
    expect(other).toHaveAttribute('aria-invalid', 'true')

    await user.type(other, 'Environmental Economics')
    await user.click(continueButton())

    await stepHeading(/hoping to achieve/i)
  })
})

// ---------------------------------------------------------------------------
// Step 4 — learning goal
// ---------------------------------------------------------------------------

describe('step four — the learning goal', () => {
  it('requires wording behind "Something else"', async () => {
    const { user } = await renderWizard()
    await throughSubjects(user)
    await chooseSubjects(user, ['Mathematics'])

    await user.click(await screen.findByRole('radio', { name: /something else/i }))
    await user.click(continueButton())

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /tell us what you are hoping to achieve/i,
    )
  })
})

// ---------------------------------------------------------------------------
// Step 6 — location depends on the teaching mode
// ---------------------------------------------------------------------------

describe('step six — location is required exactly when it is needed', () => {
  it('demands a location for in-person lessons', async () => {
    const { user } = await renderWizard()
    await throughGoal(user)
    await chooseMode(user, /^in person/i)

    await user.click(continueButton())

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /city or area you would like lessons in/i,
    )
  })

  it('demands one for "either" too, since a tutor could turn up in a room', async () => {
    const { user } = await renderWizard()
    await throughGoal(user)
    await chooseMode(user, /either is fine/i)

    await user.click(continueButton())

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /city or area you would like lessons in/i,
    )
  })

  it('does not demand one for online lessons', async () => {
    const { user } = await renderWizard()
    await throughMode(user)

    await user.click(continueButton())

    await stepHeading(/when are you free/i)
  })
})

// ---------------------------------------------------------------------------
// Step 7 — availability
// ---------------------------------------------------------------------------

describe('step seven — availability uses the timezone that was chosen', () => {
  it('prefills the country timezone and still lets the client change it', async () => {
    const { user } = await renderWizard()
    await throughMode(user)
    await throughAvailability(user)

    const timezone = await screen.findByRole('combobox', {
      name: /timezone for scheduling/i,
    })
    expect(timezone).toHaveValue('Africa/Addis_Ababa')

    await user.clear(timezone)
    await user.type(timezone, 'Europe/Dublin')
    expect(timezone).toHaveValue('Europe/Dublin')
  })

  it('accepts days and a complete time range', async () => {
    const { user } = await renderWizard()
    await throughMode(user)
    await user.click(continueButton())

    await user.click(await screen.findByRole('button', { name: /^Monday$/i }))
    await user.click(screen.getByRole('button', { name: 'Add a time range' }))
    await user.type(screen.getByLabelText('From'), '16:00')
    await user.type(screen.getByLabelText('Until'), '18:00')
    await user.click(continueButton())

    await stepHeading(/what budget/i)
  })

  it('rejects a window that ends before it starts', async () => {
    const { user } = await renderWizard()
    await throughMode(user)
    await user.click(continueButton())

    await user.click(await screen.findByRole('button', { name: 'Add a time range' }))
    await user.type(screen.getByLabelText('From'), '18:00')
    await user.type(screen.getByLabelText('Until'), '16:00')
    await user.click(continueButton())

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /end must be later than the start/i,
    )
  })
})

// ---------------------------------------------------------------------------
// Step 8 — the budget
// ---------------------------------------------------------------------------

describe('step eight — the budget is never converted and never assumed', () => {
  it('shows the country currency next to the amount', async () => {
    const { user } = await renderWizard()
    await throughMode(user)
    await throughBudget(user)

    expect(screen.getByRole('combobox', { name: /^Currency/ })).toHaveValue('ETB')
    expect(screen.getByText(/Ethiopia uses ETB/i)).toBeInTheDocument()
  })

  it('gives an international client their own currency, not birr', async () => {
    const { user } = await renderWizard()
    await throughMode(user, { country: 'United States', level: /^high school/i })
    await throughBudget(user)

    expect(screen.getByRole('combobox', { name: /^Currency/ })).toHaveValue('USD')
    expect(screen.getByText(/United States uses USD/i)).toBeInTheDocument()
  })

  it('never converts an amount when the country changes underneath it', async () => {
    const { user } = await renderWizard()
    await throughMode(user)
    await throughBudget(user)
    await user.type(await screen.findByRole('textbox', { name: 'Amount' }), '450')

    // Switching country must leave the number exactly as typed. Rescaling it
    // would apply an exchange rate nobody agreed to. The currency also stays put,
    // because the client had not deliberately chosen it — the form only filled it
    // in as a default, and changing their country is not consent to change what
    // their money is measured in.
    await user.click(screen.getByRole('button', { name: /step 1: country/i }))
    await chooseCountry(user, 'United States')
    await user.click(screen.getByRole('button', { name: /step 8: budget/i }))

    expect(await screen.findByRole('textbox', { name: 'Amount' })).toHaveValue('450')
    expect(screen.getByRole('combobox', { name: /^Currency/ })).toHaveValue('ETB')
    expect(screen.getByText(/we have not converted your amount/i)).toBeInTheDocument()
  })

  it('says plainly that the currency does not match the country', async () => {
    const { user } = await renderWizard()
    await throughMode(user)
    await throughBudget(user)

    await user.type(await screen.findByRole('textbox', { name: 'Amount' }), '450')
    await user.selectOptions(screen.getByRole('combobox', { name: /^Currency/ }), 'USD')

    expect(await screen.findByText(/we have not converted your amount/i)).toBeInTheDocument()
    expect(screen.getByText(/still 450 USD/i)).toBeInTheDocument()
  })

  it('refuses an amount with no currency beside it', async () => {
    const { user } = await renderWizard()
    await throughMode(user)
    await throughBudget(user)

    await user.type(await screen.findByRole('textbox', { name: 'Amount' }), '450')
    await user.selectOptions(screen.getByRole('combobox', { name: /^Currency/ }), '')
    await user.click(continueButton())

    expect(await screen.findByRole('alert')).toHaveTextContent(/currency this budget is in/i)
  })

  it('accepts no budget at all', async () => {
    const { user } = await renderWizard()
    await throughMode(user)
    await throughBudget(user)

    await setBudget(user, {})
  })
})

// ---------------------------------------------------------------------------
// Steps 9 and 10 — the description and the contact details
// ---------------------------------------------------------------------------

describe('the description', () => {
  it('requires something substantive', async () => {
    const { user } = await renderWizard()
    await throughMode(user)
    await throughBudget(user)
    await setBudget(user, {})

    await user.click(continueButton())

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /tell us a little more . at least 10 characters/i,
    )
  })
})

describe('the contact details', () => {
  it('requires a name and a phone number', async () => {
    const { user } = await renderWizard()
    await throughMode(user)
    await throughBudget(user)
    await setBudget(user, {})
    await user.type(
      await screen.findByRole('textbox', { name: /what do you need help with/i }),
      'I am struggling with quadratic equations before my exam.',
    )
    await user.click(continueButton())

    await user.click(await screen.findByRole('button', { name: 'Continue' }))

    expect(await screen.findAllByRole('alert')).not.toHaveLength(0)
    await expect(stepHeading(/how can we reach you/i)).resolves.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Step 11 — review and submit
// ---------------------------------------------------------------------------

describe('the review and the request', () => {
  /** Fills the description and the contact details, landing on the review. */
  async function complete(
    user: User,
    options: {
      budget?: { amount?: string; currency?: string }
      availability?: boolean
    } = {},
  ) {
    await throughMode(user)
    await throughAvailability(user)

    if (options.availability) {
      await user.click(await screen.findByRole('button', { name: /^Monday$/i }))
      await user.click(screen.getByRole('button', { name: /^Wednesday$/i }))
      await user.click(screen.getByRole('button', { name: 'Add a time range' }))
      await user.type(screen.getByLabelText('From'), '16:00')
      await user.type(screen.getByLabelText('Until'), '18:00')
    }

    await advanceTo(user, /what budget/i)
    await setBudget(user, options.budget ?? {})

    await user.type(
      await screen.findByRole('textbox', { name: /what do you need help with/i }),
      'I am struggling with quadratic equations before my exam.',
    )
    await user.click(continueButton())

    await user.type(await screen.findByRole('textbox', { name: 'Full name' }), 'Bethel Berihun')
    await user.type(screen.getByRole('textbox', { name: 'Phone number' }), '0912345678')
    await user.click(continueButton())

    await stepHeading(/check your request/i)
  }

  it('summarises the answers with the currency and the timezone attached', async () => {
    const { user } = await renderWizard()
    await complete(user, { budget: { amount: '450', currency: 'ETB' } })

    const summary = reviewSummary()
    expect(within(summary).getByText('Ethiopia')).toBeInTheDocument()
    expect(within(summary).getByText('450.00 ETB')).toBeInTheDocument()
    // Both the country row and the availability row name the timezone, which is
    // the point: the currency and the times are the client's, not ours.
    expect(within(summary).getAllByText(/in Africa\/Addis_Ababa/i).length).toBe(2)
    expect(within(summary).getByText(/we do not convert currencies/i)).toBeInTheDocument()
    expect(within(summary).getByText('Grades 9–10')).toBeInTheDocument()
    expect(within(summary).getByText('Mathematics and Physics')).toBeInTheDocument()
    expect(within(summary).getByText('Bethel Berihun')).toBeInTheDocument()
  })

  it('says "not answered" rather than filling in a plausible value', async () => {
    const { user } = await renderWizard()
    await complete(user)

    expect(within(reviewSummary()).getAllByText(/not answered/i).length).toBeGreaterThan(0)
  })

  it('sends the amount and the currency as two fields', async () => {
    const { user, onSubmitted } = await renderWizard()
    await complete(user, { budget: { amount: '450', currency: 'ETB' }, availability: true })

    await user.click(screen.getByRole('button', { name: /send tutor request/i }))
    await waitFor(() => expect(submitMock).toHaveBeenCalledTimes(1))

    expect(submitMock.mock.calls[0][0]).toEqual({
      fullName: 'Bethel Berihun',
      phone: '0912345678',
      learningMode: 'Online',
      helpDescription: 'I am struggling with quadratic equations before my exam.',
      countryCode: 'ET',
      timezone: 'Africa/Addis_Ababa',
      educationLevelCode: 'eth-grade-9-10',
      subjectIds: ['sub-maths', 'sub-physics'],
      learningGoal: 'exam-preparation',
      preferredDayNames: ['Monday', 'Wednesday'],
      preferredTimeRanges: ['16:00–18:00'],
      budgetAmount: 450,
      budgetCurrency: 'ETB',
    })
    expect(onSubmitted).toHaveBeenCalled()
  })

  it('sends no budget at all when none was given', async () => {
    const { user } = await renderWizard()
    await complete(user)

    await user.click(screen.getByRole('button', { name: /send tutor request/i }))
    await waitFor(() => expect(submitMock).toHaveBeenCalledTimes(1))

    const payload = submitMock.mock.calls[0][0]
    expect(payload).not.toHaveProperty('budgetAmount')
    expect(payload).not.toHaveProperty('budgetCurrency')
  })

  it('omits unanswered optional fields rather than sending them blank', async () => {
    const { user } = await renderWizard()
    await complete(user)

    await user.click(screen.getByRole('button', { name: /send tutor request/i }))
    await waitFor(() => expect(submitMock).toHaveBeenCalledTimes(1))

    const payload = submitMock.mock.calls[0][0]
    for (const key of [
      'email',
      'telegram',
      'additionalInfo',
      'tutorProfileId',
      'preferredLocation',
      'preferredDayNames',
      'preferredTimeRanges',
    ]) {
      expect(payload).not.toHaveProperty(key)
    }
  })

  it('takes the client back to the step that needs changing', async () => {
    const { user } = await renderWizard()
    await complete(user)

    await within(reviewSummary()).getByRole('button', { name: /edit subjects/i }).click()

    await stepHeading(/which subjects/i)
  })

  it('opens the step that needs changing when the request cannot be sent', async () => {
    const { user } = await renderWizard()

    // Reach the review with everything filled in except the phone number, by
    // using the stepper to jump straight past the contact step.
    await throughMode(user)
    await advanceTo(user, /when are you free/i)
    await advanceTo(user, /what budget/i)
    await setBudget(user, {})
    await user.type(
      await screen.findByRole('textbox', { name: /what do you need help with/i }),
      'I am struggling with quadratic equations before my exam.',
    )
    await advanceTo(user, /how can we reach you/i)
    await user.type(await screen.findByRole('textbox', { name: 'Full name' }), 'Bethel Berihun')
    await user.type(
      await screen.findByRole('textbox', { name: 'Phone number' }),
      '0912345678',
    )
    await user.click(continueButton())
    await stepHeading(/check your request/i)

    // Clear the phone number behind the review screen's back, then try to send.
    await screen.getByRole('button', { name: /step 10: your details/i }).click()
    await user.clear(await screen.findByRole('textbox', { name: 'Phone number' }))
    await screen.getByRole('button', { name: /step 11: review/i }).click()
    await stepHeading(/check your request/i)

    await user.click(screen.getByRole('button', { name: /send tutor request/i }))

    // Nothing on the review screen is editable, so a silent failure here would
    // look like a broken button. The step that owns the problem is opened instead.
    await stepHeading(/how can we reach you/i)
    expect(await screen.findByRole('alert')).toHaveTextContent(
      /phone number we can reach you on/i,
    )
    expect(submitMock).not.toHaveBeenCalled()
  })

  it('keeps the answers and says so when the server rejects the request', async () => {
    const { user } = await renderWizard()
    await complete(user)

    submitMock.mockImplementationOnce(() => {
      throw new TypeError('network down')
    })

    await user.click(screen.getByRole('button', { name: /send tutor request/i }))
    expect(await screen.findByText(/couldn't submit your request/i)).toBeInTheDocument()

    // Still on the review step, with everything the client typed.
    await stepHeading(/check your request/i)
    expect(within(reviewSummary()).getByText('Bethel Berihun')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// The stepper
// ---------------------------------------------------------------------------

describe('the stepper', () => {
  it('shows the position and only allows a completed step to be revisited', async () => {
    const { user } = await renderWizard()

    // The label appears twice on purpose: once in the visible bar and once in the
    // live region, so the position is announced as well as shown.
    await screen.findByRole('progressbar')
    expect(screen.getAllByText(/step 1 of 11/i).length).toBe(2)
    expect(screen.getByRole('button', { name: /step 2: education level/i })).toBeDisabled()

    await chooseCountry(user, 'Ethiopia')
    await user.click(continueButton())

    await waitFor(() => expect(screen.getAllByText(/step 2 of 11/i).length).toBe(2))
    expect(screen.getByRole('button', { name: /step 3: subjects/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /step 1: country/i })).toBeEnabled()
  })

  it('announces the step for a screen reader', async () => {
    const { user } = await renderWizard()

    await chooseCountry(user, 'Ethiopia')
    await user.click(continueButton())

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: /step 2 of 11: what level are you studying at/i,
      }),
    ).toBeInTheDocument()
  })

  it('reports progress to assistive technology as well', async () => {
    await renderWizard()

    const bar = await screen.findByRole('progressbar')
    expect(bar).toHaveAttribute('aria-valuenow', '1')
    expect(bar).toHaveAttribute('aria-valuemax', '11')
    expect(bar).toHaveAttribute('aria-valuetext', 'Step 1 of 11: Country')
  })
})