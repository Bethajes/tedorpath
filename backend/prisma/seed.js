/**
 * Database seed script — Subject rows.
 *
 * Usage:  node prisma/seed.js
 *
 * Guards:
 *   - Refuses to run in production (NODE_ENV=production).
 *   - Uses upsert so re-running is safe.
 *
 * Requirements: 1.2, 1.3, 13.1
 */

import { PrismaClient } from '@prisma/client';
import { toSlug } from '../src/lib/slug.js';

if (process.env.NODE_ENV === 'production') {
  console.warn('⚠️  Seed script refused: NODE_ENV=production. Exiting without creating any records.');
  process.exit(0);
}

const prisma = new PrismaClient();

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

async function main() {
  console.log('🌱  Seeding subjects…');

  for (const { name, category, description } of SUBJECT_SEEDS) {
    const slug = toSlug(name);
    await prisma.subject.upsert({
      where: { slug },
      update: { name, category, description },
      create: { name, slug, category, description },
    });
    console.log(`   ✓ ${name} (${slug})`);
  }

  console.log('✅  Seeding complete.');
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
