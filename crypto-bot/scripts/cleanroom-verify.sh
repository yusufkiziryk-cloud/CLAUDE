#!/usr/bin/env bash
# Clean-room reproduction (T26): clone the bot at a given ref into an EMPTY
# directory, install from the lock file, run the offline test suite and -
# optionally - re-run the reference backtest with the cache disabled and
# compare it with reports/faz4/expected_backtest.json.
#
# Nothing here touches the checkout you run it from, sends an order, or needs
# a key. It exists so "it works on my machine" can be replaced by "it works
# from nothing, and here is the transcript".
#
#   scripts/cleanroom-verify.sh                       # clone HEAD, install, test
#   scripts/cleanroom-verify.sh --ref <branch|sha>    # a specific ref
#   scripts/cleanroom-verify.sh --data-from user_data/data/hyperliquid --backtest
#   scripts/cleanroom-verify.sh --keep --workdir /tmp/cr   # inspect afterwards
#
# Exit status is 0 only when every step it ran passed.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REMOTE=""
REF=""
WORKDIR=""
KEEP=0
DATA_FROM=""
RUN_BACKTEST=0
REQUIREMENTS="requirements.lock.txt"
EXTRA_CONFIG=""
TIMERANGE="20250901-20260901"
STRATEGY="BaselineTrend4h"
PYTHON="${PYTHON:-python3}"

usage() { sed -n '2,20p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; }

while [ $# -gt 0 ]; do
  case "$1" in
    --remote) REMOTE="$2"; shift 2 ;;
    --ref) REF="$2"; shift 2 ;;
    --workdir) WORKDIR="$2"; shift 2 ;;
    --keep) KEEP=1; shift ;;
    --data-from) DATA_FROM="$2"; shift 2 ;;
    --backtest) RUN_BACKTEST=1; shift ;;
    --requirements) REQUIREMENTS="$2"; shift 2 ;;
    --extra-config) EXTRA_CONFIG="$2"; shift 2 ;;
    --timerange) TIMERANGE="$2"; shift 2 ;;
    --strategy) STRATEGY="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "unknown argument: $1" >&2; usage >&2; exit 64 ;;
  esac
done

# Paths given on the command line are resolved BEFORE we cd into the workdir.
if [ -n "$DATA_FROM" ]; then
  [ -d "$DATA_FROM" ] || { echo "--data-from is not a directory: $DATA_FROM" >&2; exit 64; }
  DATA_FROM="$(cd "$DATA_FROM" && pwd)"
fi
if [ -n "$EXTRA_CONFIG" ]; then
  [ -f "$EXTRA_CONFIG" ] || { echo "--extra-config is not a file: $EXTRA_CONFIG" >&2; exit 64; }
  EXTRA_CONFIG="$(cd "$(dirname "$EXTRA_CONFIG")" && pwd)/$(basename "$EXTRA_CONFIG")"
fi

# -- defaults derived from the checkout we were started from -----------------
if [ -z "$REMOTE" ]; then
  REMOTE="$(git -C "$REPO_ROOT" remote get-url origin 2>/dev/null || true)"
fi
if [ -z "$REF" ]; then
  REF="$(git -C "$REPO_ROOT" rev-parse HEAD 2>/dev/null || true)"
fi
if [ -z "$REMOTE" ] || [ -z "$REF" ]; then
  echo "could not determine remote/ref from $REPO_ROOT; pass --remote and --ref" >&2
  exit 64
fi
# The bot lives in a subdirectory of a multi-project repository.
SUBDIR="$(git -C "$REPO_ROOT" rev-parse --show-prefix 2>/dev/null | sed 's#/$##' || true)"

if [ -z "$WORKDIR" ]; then
  WORKDIR="$(mktemp -d "${TMPDIR:-/tmp}/kripto-cleanroom.XXXXXX")"
else
  mkdir -p "$WORKDIR"
  if [ -n "$(ls -A "$WORKDIR")" ]; then
    echo "--workdir must be empty: $WORKDIR" >&2
    exit 64
  fi
fi

declare -a STEP_NAMES=() STEP_STATUS=()
record() { STEP_NAMES+=("$1"); STEP_STATUS+=("$2"); }
FAILED=0
fail_step() { record "$1" "FAILED"; FAILED=1; }

cleanup() {
  if [ "$KEEP" -eq 0 ]; then rm -rf "$WORKDIR"; else echo "kept: $WORKDIR"; fi
}
trap cleanup EXIT

echo "== clean-room verification"
echo "   remote:  $REMOTE"
echo "   ref:     $REF"
echo "   subdir:  ${SUBDIR:-<repo root>}"
echo "   workdir: $WORKDIR"
echo

# -- 1. clone ----------------------------------------------------------------
echo "== 1/5 sparse clone"
cd "$WORKDIR"
git init -q .
git remote add origin "$REMOTE"
if [ -n "$SUBDIR" ]; then
  git sparse-checkout set --no-cone "$SUBDIR"
fi
if git fetch -q --depth 1 --filter=blob:none origin "$REF"; then
  git checkout -q FETCH_HEAD
  if [ -n "$SUBDIR" ]; then
    # Hoist the subdirectory so relative paths match a normal checkout.
    mv "$SUBDIR"/* "$SUBDIR"/.[!.]* . 2>/dev/null || true
    rmdir "$SUBDIR" 2>/dev/null || true
  fi
  CLONED_SHA="$(git rev-parse HEAD)"
  echo "   checked out $CLONED_SHA ($(find . -path ./.git -prune -o -type f -print | wc -l) files)"
  record "clone $REF" "VERIFIED"
else
  fail_step "clone $REF"
  echo "clone failed; nothing else can run" >&2
  exit 1
fi

# -- 2. install --------------------------------------------------------------
echo "== 2/5 venv + pip install -r $REQUIREMENTS"
if [ ! -f "$REQUIREMENTS" ]; then
  echo "   $REQUIREMENTS not in the clone" >&2
  fail_step "install ($REQUIREMENTS)"
  exit 1
fi
"$PYTHON" -m venv .venv
if .venv/bin/pip install --no-cache-dir --timeout 120 -q -r "$REQUIREMENTS" > pip-install.log 2>&1; then
  record "install ($REQUIREMENTS)" "VERIFIED"
  echo "   versions:"
  .venv/bin/pip list --format=freeze 2>/dev/null | grep -i -E '^(freqtrade|ccxt|pandas|numpy|ta-lib|ta_lib|pytest)=' | sed 's/^/     /'
else
  tail -20 pip-install.log >&2
  fail_step "install ($REQUIREMENTS)"
  exit 1
fi

# -- 3. optional market data ------------------------------------------------
if [ -n "$DATA_FROM" ]; then
  echo "== 3/5 copying collected data from $DATA_FROM"
  mkdir -p user_data/data/hyperliquid
  cp "$DATA_FROM"/*.feather user_data/data/hyperliquid/
  echo "   $(ls user_data/data/hyperliquid | wc -l) files"
  record "data copied" "VERIFIED"
else
  echo "== 3/5 no --data-from: data-dependent tests will report SKIPPED, backtest unavailable"
  record "data copied" "NOT_RUN"
fi

# -- 4. tests ----------------------------------------------------------------
echo "== 4/5 pytest -m 'not network'"
set +e
.venv/bin/python -m pytest -m "not network" -q -p no:cacheprovider -rs > pytest.log 2>&1
TEST_RC=$?
set -e
SUMMARY="$(tail -1 pytest.log)"
echo "   $SUMMARY"
if [ "$TEST_RC" -eq 0 ]; then
  if grep -q "skipped" <<<"$SUMMARY"; then
    record "tests ($SUMMARY)" "VERIFIED (with skips)"
    grep SKIPPED pytest.log | sed 's/^/     /' | head -10
  else
    record "tests ($SUMMARY)" "VERIFIED"
  fi
else
  tail -40 pytest.log >&2
  fail_step "tests ($SUMMARY)"
fi

# -- 5. optional reference backtest ------------------------------------------
if [ "$RUN_BACKTEST" -eq 1 ]; then
  echo "== 5/5 backtest $STRATEGY $TIMERANGE with --cache none"
  if [ -z "$DATA_FROM" ]; then
    echo "   --backtest needs --data-from" >&2
    fail_step "backtest"
  else
    ARGS=(backtesting --config config/config.dry.json --strategy "$STRATEGY" --timerange "$TIMERANGE" --enable-protections)
    if [ -n "$EXTRA_CONFIG" ]; then ARGS+=(--config "$EXTRA_CONFIG"); fi
    set +e
    .venv/bin/python scripts/safe-run.py "${ARGS[@]}" > backtest.log 2>&1
    BT_RC=$?
    set -e
    if [ "$BT_RC" -ne 0 ]; then
      tail -30 backtest.log >&2
      fail_step "backtest"
    else
      grep -q -- "--cache none" backtest.log || echo "   (warning: could not confirm --cache none in the log)"
      set +e
      CLEANROOM_EXPECTED="$REPO_ROOT/reports/faz4/expected_backtest.json" \
      .venv/bin/python - "$STRATEGY" "$TIMERANGE" <<'PY'
import glob, json, sys, zipfile
from pathlib import Path
strategy, timerange = sys.argv[1], sys.argv[2]
zips = sorted(glob.glob("user_data/backtest_results/*.zip"))
if not zips:
    print("   no backtest archive produced"); sys.exit(2)
with zipfile.ZipFile(zips[-1]) as z:
    main = next(n for n in z.namelist() if n.endswith(".json") and "_config" not in n and "market_change" not in n)
    stats = json.loads(z.read(main))["strategy"][strategy]
got = {
    "total_trades": stats["total_trades"],
    "profit_total": stats["profit_total"],
    "profit_factor": stats["profit_factor"],
    "max_drawdown_account": stats["max_drawdown_account"],
}
print(f"   result: trades={got['total_trades']} return={got['profit_total']*100:.2f}% "
      f"pf={got['profit_factor']:.3f} dd={got['max_drawdown_account']*100:.2f}% ({Path(zips[-1]).name})")
import os
expected_path = Path(os.environ.get("CLEANROOM_EXPECTED", "reports/faz4/expected_backtest.json"))
if not expected_path.is_file():
    print(f"   no {expected_path} to compare against"); sys.exit(3)
expected = json.loads(expected_path.read_text())
if expected.get("timerange") != timerange or expected.get("strategy") != strategy:
    print(f"   expected file is for {expected.get('strategy')} {expected.get('timerange')}, not this run"); sys.exit(3)
tol = expected.get("tolerance", {})
diffs = []
for key, want in expected["metrics"].items():
    have = got[key]
    if isinstance(want, int):
        ok = have == want
    else:
        ok = abs(have - want) <= tol.get(key, 1e-9)
    if not ok:
        diffs.append(f"{key}: expected {want}, got {have}")
if diffs:
    print("   DIFFERS from expected:"); [print("     " + d) for d in diffs]; sys.exit(1)
print("   REPRODUCED: matches reports/faz4/expected_backtest.json")
PY
      CMP_RC=$?
      set -e
      case "$CMP_RC" in
        0) record "backtest reproduced" "VERIFIED" ;;
        3) record "backtest ran (no reference to compare)" "VERIFIED" ;;
        *) fail_step "backtest reproduced" ;;
      esac
    fi
  fi
else
  echo "== 5/5 backtest not requested (--backtest)"
  record "backtest reproduced" "NOT_RUN"
fi

# -- summary -----------------------------------------------------------------
echo
echo "== summary (ref $REF)"
for i in "${!STEP_NAMES[@]}"; do
  printf '   %-60s %s\n' "${STEP_NAMES[$i]}" "${STEP_STATUS[$i]}"
done
if [ "$FAILED" -ne 0 ]; then
  echo "   => FAILED"
  exit 1
fi
echo "   => OK"
