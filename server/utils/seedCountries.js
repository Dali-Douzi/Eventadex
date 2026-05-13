require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const mongoose = require('mongoose');
const { Country } = require('../models');

const COUNTRIES = [
  // Western / Europe
  'United States',
  'United Kingdom',
  'Canada',
  'Australia',
  'Germany',
  'France',
  'Italy',
  'Spain',
  'Netherlands',
  'Belgium',
  'Switzerland',
  'Sweden',
  'Norway',
  'Denmark',
  'Portugal',
  // Middle East
  'United Arab Emirates',
  'Saudi Arabia',
  'Qatar',
  'Kuwait',
  'Bahrain',
  'Oman',
  'Jordan',
  'Lebanon',
  'Egypt',
  'Turkey',
  // Asia
  'India',
  'China',
  'Japan',
  'Singapore',
  'South Korea',
];

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('MongoDB connected');

  let added = 0, skipped = 0;

  for (const name of COUNTRIES) {
    const existing = await Country.findOne({ organizationId: null, name });
    if (existing) {
      console.log(`  skip  : ${name}`);
      skipped++;
    } else {
      await Country.create({ name, organizationId: null, status: 'available' });
      console.log(`  added : ${name}`);
      added++;
    }
  }

  console.log(`\nDone — ${added} added, ${skipped} already existed.`);
  await mongoose.disconnect();
}

seed().catch(err => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
