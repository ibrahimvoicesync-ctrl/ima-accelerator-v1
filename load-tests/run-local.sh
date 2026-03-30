#!/usr/bin/env bash
# ============================================================================
# IMA Accelerator V1 — Local Load Test Runner
# ============================================================================
# Runs k6 load tests against local Supabase (Docker) via PostgREST directly.
# No Next.js dev server required — scenarios use service_role key matching
# production admin client behavior.
#
# Prerequisites:
#   - Docker Desktop running
#   - Supabase CLI installed (npx supabase --version)
#   - k6 installed ("/c/Program Files/k6/k6.exe" or k6 on PATH)
#   - Node.js with jsonwebtoken installed (npm install jsonwebtoken)
#
# Usage:
#   bash load-tests/run-local.sh [seed|tokens|test|all]
#
#   seed    — Start local Supabase, run seed SQL (5k students, ~500k rows)
#   tokens  — Generate JWT tokens + export student profile IDs
#   test    — Run all 3 k6 scenarios against PostgREST
#   all     — Run seed + tokens + test in sequence
#
# The script expects to be run from the project root directory.
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# k6 binary — check PATH first, fall back to Windows default install location
if command -v k6 &>/dev/null; then
  K6_BIN="k6"
elif [ -f "/c/Program Files/k6/k6.exe" ]; then
  K6_BIN="/c/Program Files/k6/k6.exe"
else
  echo -e "${RED}ERROR: k6 not found. Install from https://k6.io/docs/get-started/installation/${NC}"
  exit 1
fi

# Docker container name for local Supabase DB
DB_CONTAINER="supabase_db_ima-accelerator-v1"

# ============================================================================
# Helper functions
# ============================================================================

log()  { echo -e "${CYAN}[load-test]${NC} $1"; }
ok()   { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; }

get_supabase_env() {
  # Extract env vars from `supabase status -o env`
  npx supabase status -o env 2>/dev/null | grep "^$1=" | head -1 | sed 's/^[^=]*="//' | sed 's/"$//'
}

db_psql() {
  # Run psql inside the Supabase DB Docker container
  docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres "$@"
}

check_supabase_running() {
  if ! docker inspect "$DB_CONTAINER" &>/dev/null; then
    err "Local Supabase is not running"
    log "Starting local Supabase (this may take a minute on first run)..."
    npx supabase start
  fi
  ok "Local Supabase is running"
}

# ============================================================================
# Step: Seed
# ============================================================================
do_seed() {
  log "=== STEP 1: Seed local Supabase ==="

  check_supabase_running

  # Check if already seeded
  local student_count
  student_count=$(db_psql -t -A -c "SELECT count(*) FROM public.users WHERE role='student';" 2>/dev/null || echo "0")

  if [ "$student_count" = "5000" ]; then
    warn "Database already seeded with 5,000 students. Skipping seed."
    warn "To re-seed, run: docker exec -i $DB_CONTAINER psql -U postgres -d postgres -c \"TRUNCATE public.users CASCADE;\""
    return 0
  fi

  log "Seeding database with 5,000 students (~500k rows)..."
  log "This may take 1-3 minutes..."

  db_psql < load-tests/seed/00001_staging_seed.sql

  ok "Seed complete!"
}

# ============================================================================
# Step: Generate Tokens + Export Student Profile IDs
# ============================================================================
do_tokens() {
  log "=== STEP 2: Generate JWT tokens + student profiles ==="

  check_supabase_running

  local jwt_secret
  jwt_secret=$(get_supabase_env "JWT_SECRET")
  if [ -z "$jwt_secret" ]; then
    err "Could not get JWT secret from supabase status"
    exit 1
  fi
  ok "JWT secret obtained from local Supabase"

  log "Generating 5,000 student tokens + 1 owner token..."
  STAGING_JWT_SECRET="$jwt_secret" node load-tests/scripts/gen-tokens.js

  # Export student profile IDs (primary key + auth_id) for k6 write scenarios
  log "Exporting student profile IDs from database..."
  db_psql -t -A -c \
    "SELECT json_agg(json_build_object('id', id, 'auth_id', auth_id) ORDER BY auth_id) FROM public.users WHERE role = 'student'" \
    > load-tests/tokens/student_profiles.json

  local profile_count
  profile_count=$(node -e "console.log(JSON.parse(require('fs').readFileSync('load-tests/tokens/student_profiles.json','utf8')).length)")
  ok "Exported $profile_count student profiles to load-tests/tokens/student_profiles.json"

  # Get owner user ID (primary key)
  local owner_id
  owner_id=$(db_psql -t -A -c "SELECT id FROM public.users WHERE role = 'owner' LIMIT 1")
  echo "$owner_id" > load-tests/tokens/owner_user_id.txt
  ok "Owner user ID: $owner_id"

  ok "Tokens and profiles generated in load-tests/tokens/"
}

# ============================================================================
# Step: Run k6 Tests
# ============================================================================
do_test() {
  log "=== STEP 3: Run k6 load tests (PostgREST direct) ==="

  check_supabase_running

  # Verify required files exist
  if [ ! -f load-tests/tokens/student_profiles.json ]; then
    err "student_profiles.json not found. Run: bash load-tests/run-local.sh tokens"
    exit 1
  fi

  # Get local Supabase credentials
  local api_url anon_key service_role_key owner_user_id
  api_url=$(get_supabase_env "API_URL")
  anon_key=$(get_supabase_env "ANON_KEY")
  service_role_key=$(get_supabase_env "SERVICE_ROLE_KEY")

  if [ -z "$api_url" ] || [ -z "$anon_key" ] || [ -z "$service_role_key" ]; then
    err "Could not get Supabase credentials from supabase status"
    exit 1
  fi

  if [ -f load-tests/tokens/owner_user_id.txt ]; then
    owner_user_id=$(cat load-tests/tokens/owner_user_id.txt)
  else
    owner_user_id=$(db_psql -t -A -c "SELECT id FROM public.users WHERE role = 'owner' LIMIT 1")
  fi

  ok "Supabase API URL: $api_url"
  ok "Owner user ID: $owner_user_id"

  # Create results directory
  mkdir -p load-tests/results

  local exit_code=0

  # --- Scenario 1: Write Spike ---
  log ""
  log "--- Scenario 1/3: Write Spike (500 VUs, 8 min) ---"
  log "Simulates 11 PM student submission burst via PostgREST"
  "$K6_BIN" run \
    -e SUPABASE_URL="$api_url" \
    -e SUPABASE_ANON_KEY="$anon_key" \
    -e SERVICE_ROLE_KEY="$service_role_key" \
    --summary-export load-tests/results/write-spike.json \
    load-tests/scenarios/write-spike.js \
    2>&1 | tee load-tests/results/write-spike.log || exit_code=$?

  if [ $exit_code -ne 0 ]; then
    warn "write-spike exited with code $exit_code (threshold breach or errors)"
  fi
  ok "Write spike complete — results in load-tests/results/write-spike.log"

  # --- Scenario 2: Read Mix ---
  log ""
  log "--- Scenario 2/3: Read Mix (100 VUs, 7 min) ---"
  log "Simulates owner dashboard browsing (PostgREST RPCs)"
  "$K6_BIN" run \
    -e SUPABASE_URL="$api_url" \
    -e SUPABASE_ANON_KEY="$anon_key" \
    -e SERVICE_ROLE_KEY="$service_role_key" \
    -e OWNER_USER_ID="$owner_user_id" \
    --summary-export load-tests/results/read-mix.json \
    load-tests/scenarios/read-mix.js \
    2>&1 | tee load-tests/results/read-mix.log || exit_code=$?

  if [ $exit_code -ne 0 ]; then
    warn "read-mix exited with code $exit_code (threshold breach or errors)"
  fi
  ok "Read mix complete — results in load-tests/results/read-mix.log"

  # --- Scenario 3: Combined ---
  log ""
  log "--- Scenario 3/3: Combined (300 write + 50 read VUs, 8 min) ---"
  log "Simulates simultaneous read + write traffic"
  "$K6_BIN" run \
    -e SUPABASE_URL="$api_url" \
    -e SUPABASE_ANON_KEY="$anon_key" \
    -e SERVICE_ROLE_KEY="$service_role_key" \
    -e OWNER_USER_ID="$owner_user_id" \
    --summary-export load-tests/results/combined.json \
    load-tests/scenarios/combined.js \
    2>&1 | tee load-tests/results/combined.log || exit_code=$?

  if [ $exit_code -ne 0 ]; then
    warn "combined exited with code $exit_code (threshold breach or errors)"
  fi
  ok "Combined complete — results in load-tests/results/combined.log"

  # --- Post-test: Capture DB stats ---
  log ""
  log "--- Post-test: Capturing database stats ---"

  {
    echo "=== Connection Stats ==="
    db_psql -c "SELECT count(*) AS active_connections FROM pg_stat_activity WHERE state = 'active';"
    db_psql -c "SELECT setting::int AS max_connections FROM pg_settings WHERE name = 'max_connections';"

    echo ""
    echo "=== Rate Limit Log ==="
    db_psql -c "SELECT count(*) AS total_rate_limits FROM rate_limit_log;" 2>/dev/null || echo "(rate_limit_log table not found)"

    echo ""
    echo "=== Table Row Counts ==="
    db_psql -c "SELECT 'daily_reports' AS tbl, count(*) FROM daily_reports UNION ALL SELECT 'work_sessions', count(*) FROM work_sessions UNION ALL SELECT 'users', count(*) FROM users;"
  } 2>&1 | tee load-tests/results/db-stats.log

  ok "DB stats saved to load-tests/results/db-stats.log"

  log ""
  log "=== All scenarios complete ==="
  log "Results saved to load-tests/results/"

  return $exit_code
}

# ============================================================================
# Main
# ============================================================================
case "${1:-all}" in
  seed)
    do_seed
    ;;
  tokens)
    do_tokens
    ;;
  test)
    do_test
    ;;
  all)
    do_seed
    do_tokens
    do_test
    ;;
  *)
    echo "Usage: bash load-tests/run-local.sh [seed|tokens|test|all]"
    echo ""
    echo "  seed    — Start local Supabase, run seed SQL"
    echo "  tokens  — Generate JWT tokens + export student profile IDs"
    echo "  test    — Run all 3 k6 scenarios (PostgREST direct, no Next.js needed)"
    echo "  all     — Run seed + tokens + test in sequence"
    exit 1
    ;;
esac
