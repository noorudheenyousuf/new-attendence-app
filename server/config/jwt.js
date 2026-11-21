const FALLBACK_DEV_SECRET = 'registerly_super_secure_jwt_secret_key_2026';

let warnedMissingSecret = false;

function getJwtSecret() {
  const secret = (process.env.JWT_SECRET || '').trim();
  if (secret) return secret;

  if (!warnedMissingSecret) {
    warnedMissingSecret = true;
    console.warn(
      '[SECURITY WARNING] JWT_SECRET is not set in environment variables. ' +
      'Using development fallback secret. Set a strong random JWT_SECRET in .env before deploying to production!'
    );
  }
  return FALLBACK_DEV_SECRET;
}

module.exports = { getJwtSecret };
