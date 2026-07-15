#!/bin/sh
set -eu

target_path="$1"
target_mode="$2"

if [ ! -e "$target_path" ]; then
  exit 0
fi

find "$target_path" ! -perm "$target_mode" -print0 | xargs -0 -r chmod "$target_mode"
