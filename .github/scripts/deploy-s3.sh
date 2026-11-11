#!/usr/bin/env bash
# Sync the CBC website to S3 with the same content types and cache headers
# as /workspace/aws/cbc-deploy.sh. --delete runs only on the final full-site
# sync so a revert of main removes files that are no longer in that commit.
set -euo pipefail

SRC="${1:-.}"
BUCKET="${S3_BUCKET:-chicagobitcoincollective-site}"

if [ ! -f "$SRC/index.html" ]; then
  echo "Refusing to sync: $SRC/index.html is missing. This does not look like the full site." >&2
  exit 1
fi

EX=(
  --exclude ".git/*"
  --exclude ".git"
  --exclude ".github/*"
  --exclude ".github"
  --exclude ".nojekyll"
  --exclude ".gitignore"
  --exclude "*.DS_Store"
  --exclude "README"
  --exclude "README.md"
  --exclude "CNAME"
  --exclude "LICENSE"
  --exclude "LICENSE.md"
)

LONG="public, max-age=31536000, immutable"

# HTML first, no --delete here. A filtered sync plus --delete can remove
# non-html objects from the bucket.
aws s3 sync "$SRC" "s3://$BUCKET" "${EX[@]}" \
  --exclude "*" --include "*.html" \
  --content-type "text/html; charset=utf-8" \
  --cache-control "no-cache" \
  --no-progress

up() {
  aws s3 sync "$SRC" "s3://$BUCKET" "${EX[@]}" \
    --exclude "*" --include "$1" \
    --content-type "$2" \
    --cache-control "$LONG" \
    --no-progress
}

up "*.css" "text/css; charset=utf-8"
up "*.js" "text/javascript; charset=utf-8"
up "*.json" "application/json"
up "*.svg" "image/svg+xml"
up "*.woff2" "font/woff2"
up "*.woff" "font/woff"
up "*.otf" "font/otf"
up "*.ttf" "font/ttf"
up "*.webp" "image/webp"
up "*.avif" "image/avif"
up "*.mp4" "video/mp4"
up "*.png" "image/png"
up "*.jpg" "image/jpeg"
up "*.jpeg" "image/jpeg"
up "*.JPG" "image/jpeg"
up "*.ico" "image/x-icon"
up "*.gif" "image/gif"

# Remaining files, then delete bucket objects that are not in this commit.
aws s3 sync "$SRC" "s3://$BUCKET" "${EX[@]}" \
  --cache-control "$LONG" \
  --delete \
  --no-progress
