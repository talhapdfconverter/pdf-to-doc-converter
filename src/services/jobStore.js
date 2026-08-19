/**
 * services/jobStore.js
 *
 * A simple, dependency-free job store backed by a single JSON file on disk,
 * with an in-memory cache for fast reads. This is intentionally lightweight
 * for a first production version.
 *
 * PRODUCTION LIMITATIONS OF THIS FILE-BASED STORE:
 * 1. It only works correctly with a SINGLE backend process/instance. If you
 *    scale the backend horizontally (multiple servers or multiple container
 *    replicas behind a load balancer), each instance would have its own
 *    jobs.json file and would not see jobs created by the others. Status
 *    and download requests could hit a different instance than the one that
 *    ran the conversion and fail.
 * 2. Every read/write touches disk, which does not scale to high request
 *    volume.
 * 3. There is no locking between concurrent writes beyond a simple in-process
 *    mutex, so it is not safe to run multiple Node processes against the
 *    same data directory.
 *
 * UPGRADE PATH (Redis): Replace the four functions this module exports
 * (getJob, saveJob, deleteJob, listJobs) with equivalent Redis calls, e.g.:
 *   - saveJob(job)   -> redisClient.set(`job:${job.id}`, JSON.stringify(job), { EX: ttlSeconds })
 *   - getJob(id)      -> JSON.parse(await redisClient.get(`job:${id}`))
 *   - deleteJob(id)   -> redisClient.del(`job:${id}`)
 *   - listJobs()      -> use a Redis SET of job IDs (SADD on create, SMEMBERS to list)
 * Redis's built-in key expiry (the EX option) also elegantly replaces the
 * manual cleanupService.js sweep for job *records* (temp files on disk still
 * need their own cleanup either way). Everything else in the codebase only
 * calls the four functions below, so swapping the implementation does not
 * require touching routes or services.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'jobs.json');

let cache = null;
let writeQueue = Promise.resolve();

function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({}), 'utf8');
  }
}

function loadCache() {
  if (cache !== null) return cache;
  ensureStore();
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    cache = JSON.parse(raw || '{}');
  } catch (err) {
    cache = {};
  }
  return cache;
}

function persist() {
  writeQueue = writeQueue.then(
    () =>
      new Promise((resolve, reject) => {
        fs.writeFile(DATA_FILE, JSON.stringify(cache, null, 2), 'utf8', (err) => {
          if (err) return reject(err);
          resolve();
        });
      })
  );
  return writeQueue;
}

function saveJob(job) {
  const store = loadCache();
  store[job.id] = job;
  return persist();
}

function getJob(jobId) {
  const store = loadCache();
  return store[jobId] || null;
}

function deleteJob(jobId) {
  const store = loadCache();
  delete store[jobId];
  return persist();
}

function listJobs() {
  const store = loadCache();
  return Object.values(store);
}

module.exports = { saveJob, getJob, deleteJob, listJobs };
