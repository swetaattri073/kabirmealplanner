#!/bin/sh
set -e
# Host bind-mount (~/meal-data → /app/instance) is often root-owned on Lightsail.
# Fix ownership so the non-root app can write SQLite + logs.
mkdir -p /app/instance/logs
chown -R appuser:appuser /app/instance || true
exec gosu appuser "$@"
