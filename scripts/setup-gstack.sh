#!/usr/bin/env bash
set -euo pipefail

GSTACK_DIR="$HOME/.claude/skills/gstack"

if [ -d "$GSTACK_DIR" ]; then
  echo "gstack already installed at $GSTACK_DIR, pulling latest..."
  git -C "$GSTACK_DIR" pull --ff-only
else
  echo "Installing gstack to $GSTACK_DIR..."
  mkdir -p "$HOME/.claude/skills"
  git clone --single-branch --depth 1 https://github.com/garrytan/gstack.git "$GSTACK_DIR"
fi

echo "Running gstack setup..."
cd "$GSTACK_DIR" && ./setup

echo "gstack setup complete. Skills are available in Claude Code."
