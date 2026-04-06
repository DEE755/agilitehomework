/**
 * Creates a default admin agent in the database.
 * Usage: npm run seed
 */
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { User } from '../models/User';

const envCandidates = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '../.env'),
];
for (const p of envCandidates) {
  if (fs.existsSync(p)) { dotenv.config({ path: p }); break; }
}

const EMAIL    = process.env.SEED_EMAIL    ?? 'admin@agilate.com';
const PASSWORD = process.env.SEED_PASSWORD ?? 'Admin1234!';
const NAME     = process.env.SEED_NAME     ?? 'Admin';

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI not set');

  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  const existing = await User.findOne({ email: EMAIL });
  if (existing) {
    console.log(`Agent already exists: ${EMAIL} (role: ${existing.role})`);
    await mongoose.disconnect();
    return;
  }

  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  await User.create({ name: NAME, email: EMAIL, passwordHash, role: 'admin' });

  console.log('\n✓ Admin agent created');
  console.log(`  Email:    ${EMAIL}`);
  console.log(`  Password: ${PASSWORD}`);
  console.log('\n⚠ Change the password after first login.\n');

  await mongoose.disconnect();
}

main().catch((err: Error) => {
  console.error(err.message);
  process.exit(1);
});
