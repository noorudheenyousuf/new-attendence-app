// Case-insensitive helpers for MongoDB queries and string comparisons

function escapeRegex(text) {
  return String(text || '').replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

function caseInsensitiveRegex(text) {
  return new RegExp(`^${escapeRegex(String(text || '').trim())}$`, 'i');
}

function isClassEqual(a, b) {
  if (a === b) return true;
  return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
}

module.exports = {
  escapeRegex,
  caseInsensitiveRegex,
  isClassEqual
};
