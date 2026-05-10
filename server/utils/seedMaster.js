require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const { MasterUser } = require('../models');

async function seedMaster() {
  const { MONGO_URI, MASTER_EMAIL, MASTER_PASSWORD, MASTER_NAME } = process.env;

  if (!MASTER_EMAIL || !MASTER_PASSWORD) {
    console.error('Error: MASTER_EMAIL and MASTER_PASSWORD must be set in .env');
    process.exit(1);
  }

  await mongoose.connect(MONGO_URI);
  console.log('MongoDB connected');

  const existing = await MasterUser.findOne({ email: MASTER_EMAIL.toLowerCase() });
  if (existing) {
    console.log(`Master user already exists: ${existing.email}`);
    await mongoose.disconnect();
    return;
  }

  const hashed = await bcrypt.hash(MASTER_PASSWORD, 10);
  await MasterUser.create({
    name:     MASTER_NAME || 'Platform Master',
    email:    MASTER_EMAIL.toLowerCase(),
    password: hashed,
  });

  console.log(`Master user created: ${MASTER_EMAIL}`);
  await mongoose.disconnect();
}

seedMaster().catch(err => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
