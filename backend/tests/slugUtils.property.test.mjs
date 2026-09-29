/**
 * Property-based tests for the slug derivation utility.
 *
 * **Feature: tutor-marketplace, Property 11: Subject slug derivation is URL-safe for any input name**
 * **Validates: Requirements 1.2**
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { toSlug } from '../src/lib/slug.js';

// Regex that a valid slug must satisfy:
//   - only lowercase letters, digits, and hyphens
//   - does not start or end with a hyphen
const SLUG_RE = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/;

/** The exact subject names that the seed script will insert. */
const SEEDED_SUBJECT_NAMES = [
  'Mathematics',
  'Physics',
  'Chemistry',
  'Biology',
  'English',
  'Programming',
  'AI & Technology',
  'University Course',
  'Exam Preparation',
  'Other',
];

describe('toSlug — Property 11: slug derivation is URL-safe for any input name', () => {
  /**
   * For any non-empty, non-blank string input the slug must:
   *   1. Contain only lowercase letters, digits, and hyphens
   *   2. Not start or end with a hyphen
   *   3. Be non-empty
   */
  it('produces a URL-safe slug for any non-blank string', () => {
    fc.assert(
      fc.property(
        // Generate strings that contain at least one alphanumeric character
        // (i.e. names that are not purely special characters / whitespace).
        fc.string({ minLength: 1 }).filter((s) => /[a-zA-Z0-9]/.test(s)),
        (name) => {
          const slug = toSlug(name);

          // Must be non-empty
          assert.ok(slug.length > 0, `slug for "${name}" must be non-empty`);

          // Must match the URL-safe pattern
          assert.match(
            slug,
            SLUG_RE,
            `slug "${slug}" (from "${name}") must only contain lowercase letters, digits, and hyphens, and must not start/end with a hyphen`,
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Deterministic examples from the design document seeded slugs.
   */
  it('produces the expected slugs for all seeded subject names', () => {
    const cases = [
      ['Mathematics', 'mathematics'],
      ['Physics', 'physics'],
      ['Chemistry', 'chemistry'],
      ['Biology', 'biology'],
      ['English', 'english'],
      ['Programming', 'programming'],
      ['AI & Technology', 'ai-technology'],
      ['University Course', 'university-course'],
      ['Exam Preparation', 'exam-preparation'],
      ['Other', 'other'],
    ];

    for (const [name, expected] of cases) {
      assert.equal(toSlug(name), expected, `toSlug("${name}") should equal "${expected}"`);
    }
  });

  /**
   * Verifies that toSlug produces a unique slug for every seeded subject name,
   * so that the Subject table's unique constraint on `slug` will never be
   * violated during seeding.
   *
   * **Feature: tutor-marketplace, Property 11: Subject slug derivation is URL-safe for any input name**
   * **Validates: Requirements 1.2**
   */
  it('produces unique slugs for all seeded subject names', () => {
    const slugs = SEEDED_SUBJECT_NAMES.map(toSlug);
    const unique = new Set(slugs);
    assert.equal(
      unique.size,
      slugs.length,
      `Expected ${slugs.length} unique slugs but got ${unique.size}. Slugs: ${slugs.join(', ')}`,
    );
  });
});
