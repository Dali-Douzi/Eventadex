'use strict';

/**
 * Manages an in-memory MongoDB instance for tests.
 * Each test file gets its own MongoMemoryServer so suites are isolated.
 */

const { MongoMemoryReplSet } = require('mongodb-memory-server');
const mongoose = require('mongoose');

let mongod;

async function connect() {
  // Use low-cost bcrypt rounds for speed in tests
  process.env.NODE_ENV  = 'test';
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-not-for-production';

  // Replica set required for multi-document transactions
  mongod = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const uri = mongod.getUri();
  await mongoose.connect(uri);
}

async function disconnect() {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  if (mongod) await mongod.stop({ doCleanup: true });
}

async function clearCollections() {
  const collections = mongoose.connection.collections;
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({});
  }
}

module.exports = { connect, disconnect, clearCollections };
