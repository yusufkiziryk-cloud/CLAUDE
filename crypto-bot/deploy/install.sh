#!/usr/bin/env bash
# One-shot, idempotent bootstrap for a fresh Debian/Ubuntu host (gate D1+D2+D6).
#
# What it does, in order, printing VERIFIED / FAILED / SKIPPED for each step:
#
#   0. preflight    distro, architecture, python3 >= 3.11, git
#   1. apt          python3 python3-venv git            (skip: --skip-apt)
#   2. user + dirs  system user, TARGET, /etc/kripto     (skip: --skip-user)
#   3. clone        sparse partial clone of crypto-bot at --ref into TARGET
#                   (an existing clone is updated to --ref, never deleted)
#   4. venv + pip   from requirements.lock.txt
#   5. tests        pytest -m "not network" - must pass
#   6. data         scripts/collect-data.py             (only with --collect-data)
#   7. systemd      install units + timers, daemon-reload (skip: --skip-systemd)
#                   enable --now: watchdog, backup.timer, weekly-report.timer,
#                   and the dry-run bot itself only with --start
#
# What it does NOT do, on purpose: it never writes a key, never creates a live
# configuration (none exists in the repository), never buys or signs up for
# anything, and never runs the drills in deploy/README.md for you - D2/D3/D6
# drills are yours to perform and to witness.
#
#   sudo deploy/install.sh --ref <branch-or-sha> [--start] [--collect-data]
#   deploy/install.sh --skip-apt --skip-user --skip-systemd \
#        --target ~/kripto-test --user "$(id -un)"          # unprivileged trial
#
# Re-running is safe: every step checks before it acts.

set -euo pipefail

REMOTE="https://github.com/yusufkiziryk-cloud/CLAUDE.git"
REF=""
SUBDIR="crypto-bot"
TARGET="/opt/kripto-bot"
SVC_USER="kripto"
SKIP_APT=0
SKIP_USER=0
SKIP_SYSTEMD=0
COLLECT_DATA=0
START_BOT=0
DEADMAN_URL_FILE="/etc/kripto/deadman.url"
REQUIREMENTS="requirements.lock.txt"

usage() { sed -n '2,28p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; }

while [ $# -gt 0 ]; do
  case "$1" in
    --remote) REMOTE="$2"; shift 2 ;;
    --ref) REF="$2"; shift 2 ;;
    --target) TARGET="$2"; shift 2 ;;
    --user) SVC_USER="$2"; shift 2 ;;
    --skip-apt) SKIP_APT=1; shift ;;
    --skip-user) SKIP_USER=1; shift ;;
    --skip-systemd) SKIP_SYSTEMD=1; shift ;;
    --collect-data) COLLECT_DATA=1; shift ;;
    --start) START_BOT=1; shift ;;
    --deadman-url-file) DEADMAN_URL_FILE="$2"; shift 2 ;;
    --requirements) REQUIREMENTS="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "unknown argument: $1" >&2; usage >&2; exit 64 ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -z "$REF" ]; then
  # Inside a checkout: use its branch. Otherwise the caller must say.
  REF="$(git -C "$SCRIPT_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
  if [ -z "$REF" ] || [ "$REF" = "HEAD" ]; then
    REF="$(git -C "$SCRIPT_DIR" rev-parse HEAD 2>/dev/null || true)"
  fi
fi
if [ -z "$REF" ]; then
  echo "pass --ref <branch-or-sha>: not running inside a checkout" >&2
  exit 64
fi

declare -a STEP_NAMES=() STEP_STATUS=()
FAILED=0
record() { STEP_NAMES+=("$1"); STEP_STATUS+=("$2"); printf '   -> %s\n' "$2"; }
fail() { record "$1" "FAILED: $2"; FAILED=1; }
die() { echo "!! $*" >&2; exit 1; }

as_user() {
  # Run a command as the service user, from TARGET.
  if [ "$(id -un)" = "$SVC_USER" ]; then
    (cd "$TARGET" && "$@")
  else
    sudo -u "$SVC_USER" -H bash -c 'cd "$1" && shift && exec "$@"' _ "$TARGET" "$@"
  fi
}

echo "== kripto bot bootstrap"
echo "   remote: $REMOTE"
echo "   ref:    $REF"
echo "   target: $TARGET   user: $SVC_USER"
echo

# -- 0. preflight ------------------------------------------------------------
echo "== 0 preflight"
if [ -r /etc/os-release ]; then
  . /etc/os-release
  case "${ID:-} ${ID_LIKE:-}" in
    *debian*|*ubuntu*) echo "   distro: ${PRETTY_NAME:-$ID}" ;;
    *) echo "   distro: ${PRETTY_NAME:-unknown} - not Debian/Ubuntu; apt step will be skipped, package names are yours"; SKIP_APT=1 ;;
  esac
fi
ARCH="$(uname -m)"
if [ "$ARCH" != "x86_64" ]; then
  echo "   arch: $ARCH - the TA-Lib wheel was verified on x86_64 only; if pip fails you need build-essential and a source build"
else
  echo "   arch: $ARCH"
fi
if [ "$SKIP_APT" -eq 0 ] && [ "$(id -u)" -ne 0 ]; then
  die "apt and user creation need root: run with sudo, or pass --skip-apt --skip-user --skip-systemd for an unprivileged trial"
fi
record "preflight" "VERIFIED"

# -- 1. apt ------------------------------------------------------------------
echo "== 1 apt"
if [ "$SKIP_APT" -eq 1 ]; then
  record "apt" "SKIPPED"
else
  if apt-get update -qq && apt-get install -y -qq python3 python3-venv git >/dev/null; then
    record "apt python3 python3-venv git" "VERIFIED"
  else
    fail "apt" "apt-get failed"
    exit 1
  fi
fi
command -v git >/dev/null || die "git is not installed"
command -v python3 >/dev/null || die "python3 is not installed"
PYV="$(python3 -c 'import sys; print("%d.%d" % sys.version_info[:2])')"
python3 -c 'import sys; sys.exit(0 if sys.version_info >= (3, 11) else 1)' \
  || die "python3 $PYV is too old; 3.11+ is required (freqtrade 2026.8)"
echo "   python3 $PYV"

# -- 2. user + dirs ----------------------------------------------------------
echo "== 2 user + directories"
if [ "$SKIP_USER" -eq 1 ]; then
  mkdir -p "$TARGET"
  record "user $SVC_USER" "SKIPPED (using $(id -un))"
else
  if id "$SVC_USER" >/dev/null 2>&1; then
    echo "   user $SVC_USER exists"
  else
    adduser --system --group --home "$TARGET" --shell /usr/sbin/nologin "$SVC_USER" >/dev/null
    echo "   created system user $SVC_USER"
  fi
  mkdir -p "$TARGET" /etc/kripto
  chown "$SVC_USER:$SVC_USER" "$TARGET"
  chmod 750 /etc/kripto
  chown "$SVC_USER:$SVC_USER" /etc/kripto
  record "user $SVC_USER + $TARGET + /etc/kripto" "VERIFIED"
fi

# -- 3. clone ----------------------------------------------------------------
echo "== 3 clone $SUBDIR at $REF"
if [ -d "$TARGET/.git" ]; then
  echo "   existing clone; updating to $REF (nothing is deleted)"
  if as_user git fetch -q --depth 1 --filter=blob:none origin "$REF" \
     && as_user git checkout -q FETCH_HEAD; then
    # Re-hoist in case the sparse checkout re-created the subdirectory.
    as_user bash -c "if [ -d $SUBDIR ]; then mv $SUBDIR/* $SUBDIR/.[!.]* . 2>/dev/null; rmdir $SUBDIR 2>/dev/null; fi; true"
    record "update clone to $REF" "VERIFIED ($(as_user git rev-parse --short HEAD))"
  else
    fail "update clone" "git fetch/checkout failed"
    exit 1
  fi
else
  if [ -n "$(ls -A "$TARGET" 2>/dev/null)" ]; then
    die "$TARGET is not empty and not a git clone; refusing to overwrite"
  fi
  if as_user git init -q . \
     && as_user git remote add origin "$REMOTE" \
     && as_user git sparse-checkout set --no-cone "$SUBDIR" \
     && as_user git fetch -q --depth 1 --filter=blob:none origin "$REF" \
     && as_user git checkout -q FETCH_HEAD; then
    as_user bash -c "mv $SUBDIR/* $SUBDIR/.[!.]* . 2>/dev/null; rmdir $SUBDIR; true"
    record "sparse clone at $REF" "VERIFIED ($(as_user git rev-parse --short HEAD), $(find "$TARGET" -path "$TARGET/.git" -prune -o -type f -print | wc -l) files)"
  else
    fail "sparse clone" "git failed"
    exit 1
  fi
fi
[ -f "$TARGET/scripts/safe-run.py" ] || die "clone does not look like the bot: $TARGET/scripts/safe-run.py missing"

# -- 4. venv + pip -----------------------------------------------------------
echo "== 4 venv + pip install -r $REQUIREMENTS"
[ -f "$TARGET/$REQUIREMENTS" ] || die "$REQUIREMENTS not found in the clone"
if [ ! -x "$TARGET/.venv/bin/python" ]; then
  as_user python3 -m venv .venv
fi
if as_user .venv/bin/pip install --no-cache-dir --timeout 120 -q -r "$REQUIREMENTS" > "$TARGET/.install-pip.log" 2>&1; then
  VERSIONS="$(as_user .venv/bin/pip list --format=freeze 2>/dev/null | grep -i -E '^(freqtrade|ccxt|pandas|ta-lib|ta_lib|pytest)=' | tr '\n' ' ')"
  record "pip install" "VERIFIED ($VERSIONS)"
else
  tail -20 "$TARGET/.install-pip.log" >&2
  fail "pip install" "see $TARGET/.install-pip.log"
  exit 1
fi

# -- 5. tests ----------------------------------------------------------------
echo "== 5 pytest -m 'not network'"
set +e
as_user .venv/bin/python -m pytest -m "not network" -q -p no:cacheprovider > "$TARGET/.install-pytest.log" 2>&1
TEST_RC=$?
set -e
SUMMARY="$(tail -1 "$TARGET/.install-pytest.log")"
if [ "$TEST_RC" -eq 0 ]; then
  record "tests: $SUMMARY" "VERIFIED"
else
  tail -30 "$TARGET/.install-pytest.log" >&2
  fail "tests: $SUMMARY" "see $TARGET/.install-pytest.log"
  echo "!! tests failed; not installing services on top of a failing build" >&2
  exit 1
fi

# -- 6. data -----------------------------------------------------------------
echo "== 6 market data"
if [ "$COLLECT_DATA" -eq 1 ]; then
  if as_user .venv/bin/python scripts/collect-data.py > "$TARGET/.install-collect.log" 2>&1; then
    record "collect-data" "VERIFIED ($(ls "$TARGET/user_data/data/hyperliquid" 2>/dev/null | wc -l) files)"
  else
    tail -20 "$TARGET/.install-collect.log" >&2
    fail "collect-data" "see $TARGET/.install-collect.log (public endpoints; needs outbound HTTPS)"
  fi
else
  record "collect-data" "SKIPPED (--collect-data to run; the dry-run bot fetches its own recent candles)"
fi

# -- 7. systemd --------------------------------------------------------------
echo "== 7 systemd"
if [ "$SKIP_SYSTEMD" -eq 1 ]; then
  record "systemd units" "SKIPPED"
elif ! command -v systemctl >/dev/null; then
  record "systemd units" "SKIPPED (no systemctl on this host)"
else
  for unit in "$TARGET"/deploy/*.service "$TARGET"/deploy/*.timer; do
    name="$(basename "$unit")"
    # Units are written for /opt/kripto-bot and user kripto; rewrite if not.
    sed -e "s#/opt/kripto-bot#$TARGET#g" \
        -e "s#^User=kripto\$#User=$SVC_USER#" \
        -e "s#^Group=kripto\$#Group=$SVC_USER#" \
        "$unit" > "/etc/systemd/system/$name"
  done
  systemctl daemon-reload
  if command -v systemd-analyze >/dev/null; then
    if systemd-analyze verify /etc/systemd/system/kripto-*.service /etc/systemd/system/kripto-*.timer 2>&1 | grep -v '^$' | sed 's/^/   /'; then :; fi
  fi
  record "units installed + daemon-reload" "VERIFIED"

  systemctl enable --now kripto-backup.timer kripto-weekly-report.timer >/dev/null 2>&1 \
    && record "timers (backup 03:30 UTC, weekly report Mon 06:00 UTC)" "VERIFIED" \
    || fail "timers" "systemctl enable failed"

  if [ "$START_BOT" -eq 1 ]; then
    if systemctl enable --now kripto-bot.service kripto-watchdog.service >/dev/null 2>&1; then
      sleep 5
      if systemctl is-active --quiet kripto-bot.service; then
        record "kripto-bot (dry-run) + kripto-watchdog" "VERIFIED (active)"
      else
        fail "kripto-bot" "not active after 5s: journalctl -u kripto-bot -n 50"
      fi
    else
      fail "kripto-bot" "systemctl enable failed"
    fi
  else
    record "kripto-bot + kripto-watchdog" "NOT STARTED (pass --start, or: systemctl enable --now kripto-bot kripto-watchdog)"
  fi

  if [ -s "$DEADMAN_URL_FILE" ]; then
    chown "$SVC_USER:$SVC_USER" "$DEADMAN_URL_FILE" 2>/dev/null || true
    chmod 600 "$DEADMAN_URL_FILE" 2>/dev/null || true
    if systemctl enable --now kripto-deadman.service >/dev/null 2>&1; then
      record "kripto-deadman (url file present)" "VERIFIED"
    else
      fail "kripto-deadman" "systemctl enable failed"
    fi
  else
    record "kripto-deadman" "NOT CONFIGURED ($DEADMAN_URL_FILE missing; see deploy/README.md D3 - the service is your choice)"
  fi
fi

# -- summary -----------------------------------------------------------------
echo
echo "== summary"
for i in "${!STEP_NAMES[@]}"; do
  printf '   %-62s %s\n' "${STEP_NAMES[$i]}" "${STEP_STATUS[$i]}"
done
echo
echo "== still yours to do (the script cannot witness these for you)"
echo "   D2 drill  stop the bot on purpose, wait ~6 min, see loop_heartbeat CRITICAL in journalctl -u kripto-watchdog"
echo "   D3        choose a dead-man service, write its URL to $DEADMAN_URL_FILE (mode 600), re-run this script or enable kripto-deadman"
echo "   D3 drill  stop bot + deadman, confirm the alert actually reaches you"
echo "   D4        timedatectl set-ntp true; clock_skew must be green"
echo "   D6 drill  $TARGET/.venv/bin/python scripts/backup.py --verify   (as $SVC_USER)"
echo "   then      4-8 weeks of dry-run observation; scripts/weekly-report.py every Monday"
if [ "$FAILED" -ne 0 ]; then
  echo "   => FAILED (see above)"
  exit 1
fi
echo "   => OK. This installation is DRY-RUN ONLY; there is no live variant to enable."
