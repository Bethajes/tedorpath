/**
 * Database seed script — reference data and demo tutor profiles.
 *
 * Usage:
 *   node prisma/seed.js                      # development: everything
 *   node prisma/seed.js --allow-production   # production: reference data only
 *
 * Guards:
 *   - Refuses to run in production (NODE_ENV=production), before touching the
 *     database at all, unless --allow-production is passed.
 *   - Even with --allow-production, the demo tutors are never created. Only the
 *     reference data is: the currencies, markets, education systems, subjects,
 *     countries, levels and learning goals that the request wizard and the tutor
 *     directory cannot work without.
 *   - Uses upsert so re-running is safe.
 *
 * WHY THE FLAG EXISTS
 *
 * `migrate deploy` creates the schema and nothing else — only the two `markets`
 * rows come from a migration. Every other reference table is written here, so a
 * fresh production database provisioned with migrations alone has an empty country
 * list, no subjects and no curricula: the wizard renders with nothing to ask and
 * the directory with nothing to filter.
 *
 * The production guard used to be unconditional, which left those two options —
 * run it and risk demo tutors in a live database, or ship a site with no reference
 * data at all. This is the middle one: an explicit acknowledgement provisions the
 * data the application requires, and the demo rows stay unreachable.
 *
 * Requirements: 1.2, 1.3, 13.1, 13.2, 13.3, 13.4
 */

import { toSlug } from '../src/lib/slug.js';
import {
  CURRENCIES,
  COUNTRIES,
  MARKETS,
  EDUCATION_LEVELS,
  EDUCATION_SYSTEMS,
  EXTRA_SUBJECTS,
  LEARNING_GOALS,
} from './onboardingConfigData.js';

// Checked before the client is even constructed: a production run must not
// reach the database, not merely decide not to write to it.
//
// Normalised rather than compared literally, so `Production` or a trailing
// space cannot slip past the one check standing between demo data and a real
// deployment. Deliberately broader than env.isProduction, which is not
// destructive.
const NODE_ENV = (process.env.NODE_ENV ?? '').trim().toLowerCase();

/**
 * The explicit acknowledgement that unlocks reference data in production.
 *
 * Read from argv rather than an environment variable, because it is a decision
 * about this one run and not a property of the deployment: a box that has it set
 * would quietly provision itself on every restart.
 */
const ALLOW_PRODUCTION = process.argv.slice(2).includes('--allow-production');

if (NODE_ENV === 'production' && !ALLOW_PRODUCTION) {
  console.warn(
    '⚠️  Seed script refused: NODE_ENV=production. Exiting without creating any records.\n' +
      '    A fresh production database needs its reference data (currencies, markets,\n' +
      '    education systems, subjects, countries, levels, learning goals) or the wizard\n' +
      '    and the directory have nothing to show. Run it once, deliberately:\n' +
      '\n' +
      '      NODE_ENV=production node prisma/seed.js --allow-production\n' +
      '\n' +
      '    That creates the reference data only — never the demo tutors.',
  );
  process.exit(0);
}

/** Demo tutors are development fixtures and are never written to production. */
const SEED_DEMO_TUTORS = NODE_ENV !== 'production';

// The shared client, not a bare `new PrismaClient()`: Prisma 7 connects through
// a driver adapter, so constructing one directly throws. Importing this also
// loads dotenv, so DATABASE_URL resolves the same way the app resolves it.
const { prisma, closePrisma } = await import('../src/lib/prisma.js');

/**
 * Subject seed data derived from the backend SUBJECTS constant.
 * Categories match the design document.
 */
const SUBJECT_SEEDS = [
  { name: 'Mathematics',        category: 'School Subjects',       description: 'Arithmetic, algebra, calculus, statistics and more.' },
  { name: 'Physics',            category: 'School Subjects',       description: 'Mechanics, electromagnetism, thermodynamics and beyond.' },
  { name: 'Chemistry',          category: 'School Subjects',       description: 'Organic, inorganic, and physical chemistry.' },
  { name: 'Biology',            category: 'School Subjects',       description: 'Cell biology, genetics, ecology and human physiology.' },
  { name: 'English',            category: 'School Subjects',       description: 'Reading, writing, grammar and literature.' },
  { name: 'Programming',        category: 'Technology',            description: 'Software development, algorithms and data structures.' },
  { name: 'AI & Technology',    category: 'Technology',            description: 'Machine learning, AI tools and emerging technology.' },
  { name: 'University Course',  category: 'University & Exams',    description: 'Undergraduate and postgraduate coursework support.' },
  { name: 'Exam Preparation',   category: 'University & Exams',    description: 'IELTS, SAT, HSC, A-Levels and other high-stakes exams.' },
  { name: 'Other',              category: 'Other',                 description: 'Any subject not listed above.' },
  // Additions for the adaptive wizard. Appended rather than merged in, so the
  // ten above stay in the order the homepage catalogue and the legacy request
  // enum expect. See onboardingConfigData.js.
  ...EXTRA_SUBJECTS,
];

/**
 * Demo tutors (Requirements 13.1–13.3).
 *
 * Every displayName starts with "Demo" so a seeded row is impossible to mistake
 * for a real tutor, and every email is on the reserved .local TLD, which can
 * never resolve. The three cover different subjects, levels and teaching modes
 * on purpose, so the directory's filters have something to bite on in
 * development.
 *
 * `verificationStatus` is deliberately left at its default of UNVERIFIED.
 * Approving a profile is a moderation action, and seeding one as VERIFIED would
 * put unverified demo data into the state that means "Tedor checked this".
 */
const DEMO_TUTORS = [
  {
    email: 'demo1@dev.local',
    name: 'Demo Tutor 1',
    displayName: 'Demo Tutor 1',
    headline: 'Mathematics and physics, from high school to university entrance',
    bio: 'A demo profile used to exercise the tutor directory in development. Teaches algebra, calculus and mechanics with an exam-focused approach.',
    location: 'Addis Ababa',
    teachingMode: 'ONLINE',
    studentLevels: ['High School', 'University'],
    languages: ['English', 'Amharic'],
    // A rate per market, not one rate in two currencies. Demo Tutor 1 teaches
    // online from Addis Ababa and also takes international students, so both are
    // stated. There is no exchange rate anywhere in this codebase, so these two
    // numbers are simply what this tutor charges in each market.
    rates: { ETB: 900, USD: 12 },
    availability: 'Weekday evenings and Saturday mornings.',
    experience: 'Demo data: 8 years of classroom teaching.',
    education: 'Demo data: BSc in Mathematics.',
    profileStatus: 'APPROVED',
    subjects: ['Mathematics', 'Physics'],
  },
  {
    email: 'demo2@dev.local',
    name: 'Demo Tutor 2',
    displayName: 'Demo Tutor 2',
    headline: 'Programming, algorithms and introductory AI',
    bio: 'A demo profile used to exercise the tutor directory in development. Covers programming fundamentals through to machine-learning basics.',
    location: 'Addis Ababa',
    teachingMode: 'BOTH',
    studentLevels: ['University', 'Adult Learning'],
    languages: ['English'],
    rates: { ETB: 1500, USD: 20 },
    availability: 'Flexible; weekends preferred.',
    experience: 'Demo data: software engineer with a side tutoring practice.',
    education: 'Demo data: MSc in Computer Science.',
    profileStatus: 'APPROVED',
    subjects: ['Programming', 'AI & Technology'],
  },
  {
    email: 'demo3@dev.local',
    name: 'Demo Tutor 3',
    displayName: 'Demo Tutor 3',
    headline: 'English language and university exam preparation',
    bio: 'A demo profile used to exercise the tutor directory in development. Focuses on reading, writing and the exams Ethiopian students sit.',
    location: 'Remote',
    teachingMode: 'IN_PERSON',
    studentLevels: ['Primary School', 'High School'],
    languages: ['English', 'Amharic', 'Afaan Oromo'],
    // Local market only, which is the point of having two columns: a tutor who
    // teaches in person in Addis has no international rate to quote.
    rates: { ETB: 500 },
    availability: 'Monday to Thursday, afternoons.',
    experience: 'Demo data: 5 years teaching ESL and exam prep.',
    education: 'Demo data: BA in English Literature.',
    profileStatus: 'APPROVED',
    subjects: ['English', 'Exam Preparation'],
  },
];

async function seedSubjects() {
  console.log('🌱  Seeding subjects…');

  const bySlug = new Map();
  for (const { name, category, description } of SUBJECT_SEEDS) {
    const slug = toSlug(name);
    const subject = await prisma.subject.upsert({
      where: { slug },
      update: { name, category, description },
      create: { name, slug, category, description },
    });
    bySlug.set(name, subject);
    console.log(`   ✓ ${name} (${slug})`);
  }

  return bySlug;
}

/**
 * Currencies.
 *
 * Upserted on the ISO code, which is the primary key. `sortOrder` follows the
 * array order, which is "the ones Tedor Tutors prices in first, then
 * everything else alphabetically-ish" — an editorial choice, not a fact about
 * money, so it lives in the seed rather than in code.
 */
async function seedCurrencies() {
  console.log('💱  Seeding currencies…');

  for (const [index, currency] of CURRENCIES.entries()) {
    await prisma.currency.upsert({
      where: { code: currency.code },
      update: {
        name: currency.name,
        symbol: currency.symbol,
        decimals: currency.decimals,
        sortOrder: index,
      },
      create: { ...currency, sortOrder: index },
    });
  }

  console.log(`   ✓ ${CURRENCIES.length} currencies`);
}

/**
 * Education systems.
 *
 * Upserted on code. `isDefault` is forced off for every non-default system on
 * each run so re-seeding cannot leave two systems both claiming to be the
 * fallback for a country that has no configuration of its own.
 */
async function seedEducationSystems() {
  console.log('🎓  Seeding education systems…');

  const byCode = new Map();
  for (const system of EDUCATION_SYSTEMS) {
    const row = await prisma.educationSystem.upsert({
      where: { code: system.code },
      update: {
        name: system.name,
        description: system.description,
        isDefault: system.isDefault,
      },
      create: system,
    });
    byCode.set(system.code, row);
  }

  // Exactly one default. Clearing the column on everything else first means this
  // converges no matter what order rows were inserted in previously.
  const defaultCodes = EDUCATION_SYSTEMS.filter((system) => system.isDefault).map((s) => s.code);
  await prisma.educationSystem.updateMany({
    where: { code: { notIn: defaultCodes } },
    data: { isDefault: false },
  });

  console.log(`   ✓ ${EDUCATION_SYSTEMS.length} education systems`);
}

/**
 * Countries.
 *
 * The default education system is applied here rather than being stored per
 * country, so adding a country to the array is the whole job: it inherits the
 * generic international levels until someone decides it needs its own.
 */
async function seedCountries(systemIdsByCode) {
  console.log('🌍  Seeding countries…');

  const defaultSystem = EDUCATION_SYSTEMS.find((system) => system.isDefault) ?? EDUCATION_SYSTEMS[0];
  const fallbackSystemId = systemIdsByCode.get(defaultSystem.code);
  if (!fallbackSystemId) {
    throw new Error(`Default education system "${defaultSystem.code}" was not seeded.`);
  }

  for (const [index, country] of COUNTRIES.entries()) {
    // Unknown system code in the data file is a mistake worth failing on rather
    // than a country that silently gets the wrong curriculum at runtime.
    const educationSystemId = country.educationSystemCode
      ? systemIdsByCode.get(country.educationSystemCode)
      : undefined;
    if (country.educationSystemCode && !educationSystemId) {
      throw new Error(
        `Country ${country.code} references unknown education system "${country.educationSystemCode}".`,
      );
    }

    const data = {
      name: country.name,
      currencyCode: country.currencyCode,
      timezone: country.timezone,
      educationSystemId: educationSystemId ?? fallbackSystemId,
      sortOrder: index,
    };

    await prisma.country.upsert({ where: { code: country.code }, update: data, create: { code: country.code, ...data } });
  }

  console.log(`   ✓ ${COUNTRIES.length} countries`);
}

/**
 * Education levels and the subjects suggested for each.
 *
 * The join rows are replaced wholesale rather than upserted: the suggestion set
 * is authored as a whole, so removing a subject from the data file has to
 * actually remove it rather than leave a stale suggestion behind.
 */
async function seedEducationLevels(systemIdsByCode, subjectsByName) {
  console.log('📚  Seeding education levels…');

  const levelsByCode = new Map();
  const bySystem = new Map();
  EDUCATION_LEVELS.forEach((level, index) => {
    if (!bySystem.has(level.system)) bySystem.set(level.system, []);
    bySystem.get(level.system).push({ level, index });
  });

  for (const [systemCode, entries] of bySystem) {
    const educationSystemId = systemIdsByCode.get(systemCode);
    if (!educationSystemId) {
      throw new Error(`Education level references unknown education system "${systemCode}".`);
    }

    // Ordering is per system, so each system's list starts again at 0 rather
    // than continuing the global index.
    for (const [position, { level, index }] of entries.entries()) {
      const data = {
        name: level.name,
        stage: level.stage,
        aliases: level.aliases ?? [],
        sortOrder: position,
        educationSystemId,
      };

      const row = await prisma.educationLevel.upsert({
        where: { code: level.code },
        update: data,
        create: { code: level.code, ...data },
      });
      levelsByCode.set(level.code, row);

      const subjectIds = [];
      for (const subjectName of level.subjects) {
        const subject = subjectsByName.get(subjectName);
        if (!subject) {
          throw new Error(
            `Education level "${level.code}" (seed index ${index}) references unknown subject "${subjectName}".`,
          );
        }
        subjectIds.push(subject.id);
      }

      await prisma.educationLevelSubject.deleteMany({
        where: { educationLevelId: row.id },
      });
      if (subjectIds.length > 0) {
        await prisma.educationLevelSubject.createMany({
          data: subjectIds.map((subjectId) => ({ educationLevelId: row.id, subjectId })),
          skipDuplicates: true,
        });
      }
    }
  }

  console.log(`   ✓ ${EDUCATION_LEVELS.length} education levels`);
}

async function seedLearningGoals() {
  console.log('🎯  Seeding learning goals…');

  for (const [index, goal] of LEARNING_GOALS.entries()) {
    const data = {
      name: goal.name,
      description: goal.description,
      sortOrder: index,
    };
    await prisma.learningGoal.upsert({
      where: { code: goal.code },
      update: data,
      create: { code: goal.code, ...data },
    });
  }

  console.log(`   ✓ ${LEARNING_GOALS.length} learning goals`);
}

async function seedDemoTutors(subjectsByName) {
  console.log('👤  Seeding demo tutor profiles…');

  for (const demo of DEMO_TUTORS) {
    // Upsert on the unique email: re-running must not fail on a duplicate, and
    // must not leave a second account behind.
    const user = await prisma.user.upsert({
      where: { email: demo.email },
      update: { name: demo.name },
      create: { email: demo.email, name: demo.name },
    });

    const subjectIds = demo.subjects.map((name) => {
      const subject = subjectsByName.get(name);
      if (!subject) throw new Error(`Demo tutor ${demo.displayName} references unknown subject "${name}".`);
      return subject.id;
    });

    const {
      // Not a profile column: both are resolved into join rows below.
      subjects: _subjectNames,
      rates: _rates,
      // The user is linked by id, not stored on the profile.
      email: _email,
      name: _name,
      ...profileFields
    } = demo;

    // Upsert on the unique userId so a re-run updates the demo profile in place
    // instead of hitting the one-profile-per-user constraint.
    const profile = await prisma.tutorProfile.upsert({
      where: { userId: user.id },
      update: profileFields,
      create: { ...profileFields, userId: user.id },
    });

    // The join table has no upsert, and a tutor editing their subject list
    // replaces it wholesale — so mirror that here to keep re-runs idempotent.
    await prisma.tutorProfileSubject.deleteMany({ where: { tutorProfileId: profile.id } });
    if (subjectIds.length > 0) {
      await prisma.tutorProfileSubject.createMany({
        data: subjectIds.map((subjectId) => ({ tutorProfileId: profile.id, subjectId })),
      });
    }

    await seedDemoRates(profile.id, _rates)

    const rates = Object.entries(_rates)
      .map(([code, amount]) => `${amount} ${code}`)
      .join(' · ')
    console.log(`   ✓ ${demo.displayName} <${demo.email}> — ${demo.subjects.join(', ')}${rates ? ` — ${rates}` : ''}`);
  }
}

/**
 * The markets tutors price in.
 *
 * Idempotent and additive: an upsert per row, and rows the operator added that
 * this file does not know about are left alone. Re-seeding must never narrow a
 * deployment's markets back to the two this file happens to list.
 */
async function seedMarkets() {
  console.log('💱  Seeding markets…');

  for (const market of MARKETS) {
    await prisma.market.upsert({
      where: { code: market.code },
      update: {
        name: market.name,
        currencyName: market.currencyName,
        symbol: market.symbol,
        decimals: market.decimals,
        isDefault: market.isDefault,
        sortOrder: market.sortOrder,
      },
      create: market,
    });
  }

  // Exactly one default, converged rather than assumed: clear the flag everywhere
  // this file does not claim, so a re-run cannot leave two defaults fighting.
  const claimed = MARKETS.filter((market) => market.isDefault).map((market) => market.code)
  await prisma.market.updateMany({
    where: { code: { notIn: claimed } },
    data: { isDefault: false },
  });

  console.log(`   ✓ ${MARKETS.length} markets`);
}

/**
 * Replaces a demo tutor's rate rows with the ones the seed declares.
 *
 * Wholesale rather than an upsert, because the declared set is authoritative for
 * these rows: dropping `USD` from a demo tutor has to actually remove it rather
 * than leave a stale price behind.
 */
async function seedDemoRates(profileId, rates) {
  await prisma.tutorProfileRate.deleteMany({ where: { tutorProfileId: profileId } })

  const rows = Object.entries(rates)
    .filter(([, amount]) => typeof amount === 'number' && amount > 0)
    .map(([marketCode, amount]) => ({ tutorProfileId: profileId, marketCode, amount }))

  if (rows.length > 0) await prisma.tutorProfileRate.createMany({ data: rows })
}

async function main() {
  // Order matters: every foreign key below is created by the call above it.
  await seedCurrencies();
  // Markets reference `currencies` by code, so they follow it.
  await seedMarkets();
  await seedEducationSystems();

  const subjectsByName = await seedSubjects();

  const systems = await prisma.educationSystem.findMany({
    select: { id: true, code: true },
  });
  const systemIdsByCode = new Map(systems.map((system) => [system.code, system.id]));

  await seedCountries(systemIdsByCode);
  await seedEducationLevels(systemIdsByCode, subjectsByName);
  await seedLearningGoals();

  if (SEED_DEMO_TUTORS) {
    await seedDemoTutors(subjectsByName);
  } else {
    console.log('ℹ️  Reference data seeded. Demo tutors skipped: not a development environment.');
  }

  console.log('✅  Seeding complete.');
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exitCode = 1;
  })
  // Closes the pg pool as well as the client; without this the adapter keeps
  // the event loop alive and the process hangs instead of exiting.
  .finally(closePrisma);
