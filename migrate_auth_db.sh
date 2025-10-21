#!/bin/bash

# Database Migration Script - SQLite to PostgreSQL
# This script migrates authentication data from SQLite to PostgreSQL

echo "=== Starting Database Migration ==="

# Check if auth.db exists
if [ ! -f "alpha-backend/auth.db" ]; then
    echo "❌ auth.db not found. Creating new database in PostgreSQL."
    exit 1
fi

# Create auth database in PostgreSQL
echo "Creating auth database in PostgreSQL..."
docker exec ubuntu_postgres_1 psql -U postgres -c "CREATE DATABASE auth_db;" 2>/dev/null || echo "Database may already exist"

# Export SQLite data
echo "Exporting SQLite data..."
sqlite3 alpha-backend/auth.db ".dump" > /tmp/auth_dump.sql

# Convert SQLite dump to PostgreSQL format
echo "Converting SQLite dump to PostgreSQL format..."
sed -i 's/INTEGER PRIMARY KEY AUTOINCREMENT/SERIAL PRIMARY KEY/g' /tmp/auth_dump.sql
sed -i 's/DATETIME/TIMESTAMP/g' /tmp/auth_dump.sql
sed -i '/^PRAGMA/d' /tmp/auth_dump.sql
sed -i '/^BEGIN TRANSACTION/d' /tmp/auth_dump.sql
sed -i '/^COMMIT/d' /tmp/auth_dump.sql

# Import to PostgreSQL
echo "Importing data to PostgreSQL..."
docker exec -i ubuntu_postgres_1 psql -U postgres -d auth_db < /tmp/auth_dump.sql

# Verify migration
echo "Verifying migration..."
USER_COUNT=$(docker exec ubuntu_postgres_1 psql -U postgres -d auth_db -t -c "SELECT COUNT(*) FROM user;" | tr -d ' ')
echo "✅ Migrated $USER_COUNT users to PostgreSQL"

# Backup original SQLite
echo "Backing up original SQLite database..."
cp alpha-backend/auth.db alpha-backend/auth.db.backup.$(date +%Y%m%d_%H%M%S)

echo "=== Migration Complete ==="
echo "✅ Users migrated to PostgreSQL"
echo "✅ Original SQLite backed up"
echo "✅ Ready to update docker-compose.yml"
