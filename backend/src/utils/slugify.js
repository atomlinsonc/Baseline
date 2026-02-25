/**
 * Convert a title string to a URL-safe slug.
 * Appends today's date to ensure uniqueness across yearly cycles.
 */
function slugify(title, date) {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60);
  return date ? `${base}-${date}` : base;
}

module.exports = { slugify };
