/**
 * Derives a URL-safe slug from a subject name.
 *
 * Rules:
 *  - Lowercase the entire string
 *  - Replace any run of non-alphanumeric characters with a single hyphen
 *  - Strip leading/trailing hyphens
 *
 * Examples:
 *   toSlug("Mathematics")      → "mathematics"
 *   toSlug("AI & Technology")  → "ai-technology"
 *   toSlug("Exam Preparation") → "exam-preparation"
 */
export function toSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
