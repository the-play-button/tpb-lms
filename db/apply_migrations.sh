#!/bin/bash
# Apply database migrations to LMS D1 database
# Usage: ./apply_migrations.sh [--remote|--local]

set -e

ENV=${1:-"--remote"}

echo "🔄 Applying LMS Database Migrations ($ENV)..."
echo ""

MIGRATIONS_DIR="db/migrations"

if [ ! -d "$MIGRATIONS_DIR" ]; then
    echo "❌ Migrations directory not found: $MIGRATIONS_DIR"
    exit 1
fi

# Find all .sql migration files and sort them
MIGRATIONS=$(ls "$MIGRATIONS_DIR"/*.sql 2>/dev/null | sort)

if [ -z "$MIGRATIONS" ]; then
    echo "ℹ️  No migrations found"
    exit 0
fi

for MIGRATION in $MIGRATIONS; do
    FILENAME=$(basename "$MIGRATION")
    echo "📝 Applying: $FILENAME"
    
    if [ "$ENV" = "--remote" ]; then
        npx wrangler d1 execute tpb-lms --remote --file="$MIGRATION"
    else
        npx wrangler d1 execute tpb-lms --local --file="$MIGRATION"
    fi
    
    echo "✅ Applied: $FILENAME"
    echo ""
done

echo "🎉 All migrations applied successfully!"

