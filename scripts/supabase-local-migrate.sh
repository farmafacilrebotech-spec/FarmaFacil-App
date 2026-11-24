#!/usr/bin/env bash
# Apply supabase/migrations/*.sql in version order to a local Postgres URL.
# Excludes one_shots. No remote resets.
set -euo pipefail
DB_URL="${1:?usage: $0 postgresql://...}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MIG="$ROOT/supabase/migrations"
FILES="$(python3 - <<PY
import re
from pathlib import Path
files=[]
for f in Path(r"$MIG").glob("*.sql"):
    m=re.match(r"^(\d+)", f.name)
    if not m: continue
    files.append((int(m.group(1)), f.name))
for _, name in sorted(files):
    print(name)
PY
)"
COUNT=$(printf '%s\n' "$FILES" | grep -c . || true)
echo "Applying $COUNT migrations to local DB…"
while IFS= read -r f; do
  [ -z "$f" ] && continue
  echo "→ $f"
  psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$MIG/$f" >/tmp/ff_mig_last.log 2>&1 \
    || { echo "FAIL $f"; tail -40 /tmp/ff_mig_last.log; exit 1; }
done <<< "$FILES"
echo "OK all migrations"
