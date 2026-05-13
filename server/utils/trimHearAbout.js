require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const mongoose = require('mongoose');
const { HearAbout } = require('../models');

const KEEP = new Set([
  'Social Media',
  'Word of Mouth / Friend or Colleague',
  'Google / Search Engine',
  'Email Newsletter',
  'Website',
  'Online Advertisement',
  'Conference or Previous Event',
  'Other',
]);

async function trim() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('MongoDB connected');

  // 1. Banish everything not in the keep list
  const all = await HearAbout.find({ organizationId: null });
  for (const item of all) {
    if (!KEEP.has(item.name)) {
      await HearAbout.deleteOne({ _id: item._id });
      console.log(`  removed : ${item.name}`);
    }
  }

  // 2. Upsert the kept entries (ensure they exist and are available)
  for (const name of KEEP) {
    const result = await HearAbout.findOneAndUpdate(
      { organizationId: null, name },
      { name, organizationId: null, status: 'available' },
      { upsert: true, new: true }
    );
    console.log(`  kept    : ${result.name}`);
  }

  console.log('\nDone.');
  await mongoose.disconnect();
}

trim().catch(err => {
  console.error('Failed:', err.message);
  process.exit(1);
});
