/**
 * Database seed script — Subject rows and demo tutor profiles.
 *
 * Usage:  node prisma/seed.js
 *
 * Guards:
 *   - Refuses to run in production (NODE_ENV=production), before touching the
 *     database at all.
 *   - Uses upsert so re-running is safe.
 *
 * Requirements: 1.2, 1.3, 13.1, 13.2, 13.3, 13.4
 */

import { toSlug } from '../src/lib/slug.js';

// Checked before the client is even constructed: a production run must not
// reach the database, not merely decide not to write to it.
//
// Normalised rather than compared literally, so `Production` or a trailing
// space cannot slip past the one check standing between demo data and a real
// deployment. Deliberately broader than env.isProduction, which is not
// destructive.
const NODE_ENV = (process.env.NODE_ENV ?? '').trim().toLowerCase();
if (NODE_ENV === 'production') {
  console.warn('⚠️  Seed script refused: NODE_ENV=production. Exiting without creating any records.');
  process.exit(0);
}

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
    hourlyRate: 25,
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
    hourlyRate: 40,
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
    hourlyRate: 15,
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
      // Not a profile column: it is resolved into the join rows below.
      subjects: _subjectNames,
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

    console.log(`   ✓ ${demo.displayName} <${demo.email}> — ${demo.subjects.join(', ')}`);
  }
}

async function main() {
  const subjectsByName = await seedSubjects();
  await seedDemoTutors(subjectsByName);
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
