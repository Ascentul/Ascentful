#!/usr/bin/env node
/**
 * Find user by email and seed sample applications
 *
 * WARNING: This script logs PII (email, user ID) to console.
 * Intended for local development only - do not use in production environments.
 */

const path = require('path');

// Load .env.local
require('dotenv').config({ path: path.resolve(process.cwd(), '.env.local') });

const { ConvexHttpClient } = require('convex/browser');

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!CONVEX_URL) {
  console.error('Error: NEXT_PUBLIC_CONVEX_URL not found in environment');
  process.exit(1);
}
const client = new ConvexHttpClient(CONVEX_URL);

// Sample applications to seed
const sampleApplications = [
  { company: "Google", job_title: "Software Engineer", status: "saved" },
  { company: "Meta", job_title: "Frontend Developer", status: "saved" },
  { company: "Apple", job_title: "iOS Developer", status: "saved" },
  { company: "Netflix", job_title: "Senior Engineer", status: "saved" },
  { company: "Microsoft", job_title: "Full Stack Developer", status: "applied" },
  { company: "Amazon", job_title: "SDE II", status: "applied" },
  { company: "Stripe", job_title: "Backend Engineer", status: "applied" },
  { company: "Airbnb", job_title: "Software Engineer", status: "applied" },
  { company: "Uber", job_title: "Mobile Developer", status: "applied" },
  { company: "Spotify", job_title: "Data Engineer", status: "interview" },
  { company: "Twitter", job_title: "Backend Developer", status: "interview" },
  { company: "LinkedIn", job_title: "Software Engineer", status: "interview" },
  { company: "Salesforce", job_title: "Platform Engineer", status: "offer" },
];

async function findClerkUser(email) {
  if (!process.env.CLERK_SECRET_KEY) {
    throw new Error('CLERK_SECRET_KEY not found in environment');
  }

  const url = new URL('https://api.clerk.com/v1/users');
  url.searchParams.set('email_address[]', email);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  const res = await fetch(url.toString(), {
    signal: controller.signal,
    headers: {
      'Authorization': `Bearer ${process.env.CLERK_SECRET_KEY}`,
      'Accept': 'application/json',
    },
  }).finally(() => clearTimeout(timeout));

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(
      `Clerk API error: ${res.status} ${res.statusText}${body ? ` - ${body.slice(0, 500)}` : ''}`
    );
  }

  const data = await res.json();
  return Array.isArray(data) ? data[0] ?? null : (data.data?.[0] ?? null);
}

async function seedApplications(clerkId) {
  console.log(`\nSeeding ${sampleApplications.length} sample applications...\n`);

  const { api } = require('../convex/_generated/api');

  let failures = 0;
  // Note: This does not check for duplicates - running multiple times will create duplicate records
  // For idempotent seeding, consider querying existing applications before creating
  for (const app of sampleApplications) {
    try {
      await client.mutation(api.applications.createApplication, {
        clerkId,
        company: app.company,
        job_title: app.job_title,
        status: app.status,
        source: "Job Board",
        notes: `Sample application for ${app.company} - ${app.job_title}`,
      });
      console.log(`✅ Created: ${app.company} - ${app.job_title} (${app.status})`);
    } catch (error) {
      failures += 1;
      console.error(`❌ Failed to create ${app.company}: ${error.message}`);
    }
  }

  console.log("\n✨ Done seeding sample applications!");

  if (failures > 0) {
    console.error(`\n⚠️  ${failures} application(s) failed to seed`);
    process.exitCode = 1;
  }
}

async function main() {
  // Hard guard: prevent running in production/CI environments
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL || process.env.CI) {
    console.error('❌ Refusing to run seed script in production/CI environments.');
    console.error('This script logs PII and is intended for local development only.');
    process.exit(1);
  }

  const email = process.argv[2];
  if (!email) {
    console.error('Usage: node scripts/find-and-seed.js <email>');
    process.exit(1);
  }

  console.log(`Looking up user: ${email}`);
  const user = await findClerkUser(email);

  if (!user) {
    console.error('User not found in Clerk');
    process.exit(1);
  }

  console.log(`Found user: ${user.id}`);
  await seedApplications(user.id);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
