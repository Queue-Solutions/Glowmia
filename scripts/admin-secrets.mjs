import { randomBytes, scryptSync } from 'node:crypto';

const password = process.argv[2];

if (!password) {
  console.error('Usage: npm run admin:secrets -- "your-strong-password"');
  process.exit(1);
}

const salt = randomBytes(16).toString('hex');
const derived = scryptSync(password, salt, 64).toString('hex');
const sessionSecret = randomBytes(32).toString('hex');

console.log(`ADMIN_PASSWORD_HASH=scrypt$${salt}$${derived}`);
console.log(`ADMIN_SESSION_SECRET=${sessionSecret}`);
