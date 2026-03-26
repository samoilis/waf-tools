#!/bin/sh
set -e

echo "Running database migrations..."
npx prisma migrate deploy

echo "Initializing system settings..."
node -e "
const pg = require('pg');
(async () => {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  // Ensure system.installDate exists (only set on first run)
  await client.query(
    \"INSERT INTO \\\"Setting\\\" (id, key, value) VALUES (gen_random_uuid(), 'system.installDate', \\\$1) ON CONFLICT (key) DO NOTHING\",
    [new Date().toISOString().slice(0, 10)]
  );

  // If LICENSE_KEY env var is set, upsert it
  if (process.env.LICENSE_KEY) {
    await client.query(
      \"INSERT INTO \\\"Setting\\\" (id, key, value) VALUES (gen_random_uuid(), 'reg.licenseKey', \\\$1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value\",
      [process.env.LICENSE_KEY]
    );
    console.log('License key set from LICENSE_KEY environment variable');
  }

  await client.end();
})().catch(e => { console.error(e); process.exit(1); });
"

echo "Starting Next.js server..."
exec node server.js
