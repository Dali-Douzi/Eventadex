require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const mongoose = require('mongoose');
const { HearAbout } = require('../models');

const ENTRIES = [
  'Word of Mouth / Friend or Colleague',
  'LinkedIn',
  'Facebook',
  'Instagram',
  'Twitter / X',
  'YouTube',
  'TikTok',
  'WhatsApp',
  'Google / Search Engine',
  'Email Newsletter',
  'Website',
  'News Article / Press Release',
  'Online Advertisement',
  'Flyer / Poster / Print',
  'Radio',
  'Television',
  'Podcast',
  'Conference or Previous Event',
  'Ambassador or Influencer',
  'Other',
];

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('MongoDB connected');

  let added = 0, skipped = 0;

  for (const name of ENTRIES) {
    const existing = await HearAbout.findOne({ organizationId: null, name });
    if (existing) {
      console.log(`  skip  : ${name}`);
      skipped++;
    } else {
      await HearAbout.create({ name, organizationId: null, status: 'available' });
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
