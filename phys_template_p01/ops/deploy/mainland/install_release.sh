#!/usr/bin/env bash
set -euo pipefail

: "${APP_ROOT:?APP_ROOT is required}"
: "${RELEASE_FILE:?RELEASE_FILE is required}"
: "${RELEASE_ID:?RELEASE_ID is required}"

releases_dir="$APP_ROOT/releases"
target_dir="$releases_dir/$RELEASE_ID"

mkdir -p "$releases_dir"
rm -rf "$target_dir"
mkdir -p "$target_dir"

tar -xzf "$RELEASE_FILE" -C "$target_dir"
ln -sfn "$target_dir" "$APP_ROOT/current"
rm -f "$RELEASE_FILE"

mapfile -t release_dirs < <(find "$releases_dir" -mindepth 1 -maxdepth 1 -type d | sort)
keep_count=5

if [ "${#release_dirs[@]}" -gt "$keep_count" ]; then
  delete_count=$((${#release_dirs[@]} - keep_count))
  for stale_dir in "${release_dirs[@]:0:$delete_count}"; do
    rm -rf "$stale_dir"
  done
fi
