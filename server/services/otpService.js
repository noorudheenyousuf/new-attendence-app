const crypto = require('crypto');

/**
 * Generates a cryptographically secure 6-digit numeric OTP.
 */
function generateOtp() {
  const num = crypto.randomInt(100000, 1000000);
  return String(num);
}

/**
 * Masks a 10-digit phone number for safe display (e.g. ******3210).
 */
function maskPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length < 4) return '******';
  return `${'*'.repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`;
}

/**
 * Pluggable SMS OTP dispatcher.
 * Supports:
 *  - Fast2SMS (SMS_PROVIDER=fast2sms, SMS_API_KEY=...)
 *  - Twilio (SMS_PROVIDER=twilio, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER)
 *  - Dev/Fallback mode when no SMS provider credentials are configured in .env
 */
async function sendOtpSms(phoneNumber, otp, purpose = 'Password Reset') {
  const digits = String(phoneNumber || '').replace(/\D/g, '').slice(-10);
  const provider = (process.env.SMS_PROVIDER || '').trim().toLowerCase();
  const message = `Your REGISTERLY ${purpose} OTP is ${otp}. Valid for 5 minutes. Do not share this code.`;

  // 1. Fast2SMS (Popular in India)
  if ((provider === 'fast2sms' || (!provider && process.env.FAST2SMS_API_KEY)) && (process.env.SMS_API_KEY || process.env.FAST2SMS_API_KEY)) {
    const apiKey = (process.env.SMS_API_KEY || process.env.FAST2SMS_API_KEY).trim();
    try {
      const resp = await fetch('https://www.fast2sms.com/dev/bulkV2', {
        method: 'POST',
        headers: {
          authorization: apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          route: 'q',
          message,
          language: 'english',
          flash: 0,
          numbers: digits
        })
      });
      const data = await resp.json().catch(() => ({}));
      if (resp.ok && data.return !== false) {
        return { delivered: true, provider: 'fast2sms', maskedPhone: maskPhone(digits) };
      }
      console.warn('[OTP Fast2SMS Warning]', data);
    } catch (err) {
      console.error('[OTP Fast2SMS Error]', err.message);
    }
  }

  // 2. Twilio
  if (
    (provider === 'twilio' || (!provider && process.env.TWILIO_ACCOUNT_SID)) &&
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_FROM_NUMBER
  ) {
    try {
      const sid = process.env.TWILIO_ACCOUNT_SID.trim();
      const token = process.env.TWILIO_AUTH_TOKEN.trim();
      const from = process.env.TWILIO_FROM_NUMBER.trim();
      const to = digits.length === 10 ? `+91${digits}` : `+${digits}`;
      const params = new URLSearchParams({ To: to, From: from, Body: message });
      const auth = Buffer.from(`${sid}:${token}`).toString('base64');

      const resp = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
      });
      if (resp.ok) {
        return { delivered: true, provider: 'twilio', maskedPhone: maskPhone(digits) };
      }
      const errText = await resp.text().catch(() => '');
      console.warn('[OTP Twilio Warning]', errText);
    } catch (err) {
      console.error('[OTP Twilio Error]', err.message);
    }
  }

  // 3. Development / Unconfigured SMS Gateway Fallback
  console.log(`[OTP FALLBACK] Phone: ${digits} | Purpose: ${purpose} | OTP: ${otp}`);
  return {
    delivered: false,
    provider: 'fallback',
    maskedPhone: maskPhone(digits),
    devOtp: otp
  };
}

module.exports = {
  generateOtp,
  maskPhone,
  sendOtpSms
};
