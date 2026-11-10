#!/bin/sh
# startup.sh - Inject custom HTML snippets into index.html and lobby.html
# Runs before the Node.js server starts.

set -e

echo "Starting Tunneler HTML injection process..."

CUSTOM_HEAD_FILE="/app/config/custom-head.html"
CUSTOM_BODY_START_FILE="/app/config/custom-body-start.html"
CUSTOM_BODY_END_FILE="/app/config/custom-body-end.html"

# Combine file content with environment variable content.
# Both are used together if both are present.
combine_content() {
  file="$1"
  env_content="$2"
  out=""

  if [ -f "$file" ]; then
    out=$(cat "$file")
  fi

  if [ -n "$env_content" ]; then
    if [ -n "$out" ]; then
      out="$out
  <!-- Additional content from environment variable -->
$env_content"
    else
      out="$env_content"
    fi
  fi

  printf '%s' "$out"
}

# Find a page in /app/public first, then /app. Prints the path or nothing.
find_page() {
  for dir in /app/public /app; do
    if [ -f "$dir/$1" ]; then
      echo "$dir/$1"
      return 0
    fi
  done
  return 1
}

# Inject the snippets into one page.
inject_into() {
  OUTPUT_FILE="$1"
  TEMPLATE_FILE="${OUTPUT_FILE}.template"

  # Keep an untouched copy of the original so restarts still find the markers
  if [ ! -f "$TEMPLATE_FILE" ]; then
    if ! grep -q -E "<!-- CUSTOM_(HEAD|BODY_START|BODY_END) -->" "$OUTPUT_FILE"; then
      echo "No injection points in $OUTPUT_FILE, skipping"
      return 0
    fi
    cp "$OUTPUT_FILE" "$TEMPLATE_FILE"
  fi

  TEMP_FILE=$(mktemp)

  # Pass content via environment variables. awk -v would mangle
  # backslashes and fail on multi-line values.
  INJECT_HEAD="$CUSTOM_HEAD" \
  INJECT_BODY_START="$CUSTOM_BODY_START" \
  INJECT_BODY_END="$CUSTOM_BODY_END" \
  awk '
    /<!-- CUSTOM_HEAD -->/ {
      if (ENVIRON["INJECT_HEAD"] != "") {
        print "  <!-- Custom HEAD content injected -->"
        print ENVIRON["INJECT_HEAD"]
      }
      next
    }
    /<!-- CUSTOM_BODY_START -->/ {
      if (ENVIRON["INJECT_BODY_START"] != "") {
        print "  <!-- Custom BODY START content injected -->"
        print ENVIRON["INJECT_BODY_START"]
      }
      next
    }
    /<!-- CUSTOM_BODY_END -->/ {
      if (ENVIRON["INJECT_BODY_END"] != "") {
        print "  <!-- Custom BODY END content injected -->"
        print ENVIRON["INJECT_BODY_END"]
      }
      next
    }
    { print }
  ' "$TEMPLATE_FILE" > "$TEMP_FILE"

  mv "$TEMP_FILE" "$OUTPUT_FILE"
  chmod 644 "$OUTPUT_FILE"
  echo "OK: injected into $OUTPUT_FILE"
}

# Build the snippets once; they are shared by all pages
CUSTOM_HEAD=$(combine_content "$CUSTOM_HEAD_FILE" "${CUSTOM_HEAD_HTML:-}")
CUSTOM_BODY_START=$(combine_content "$CUSTOM_BODY_START_FILE" "${CUSTOM_BODY_START_HTML:-}")
CUSTOM_BODY_END=$(combine_content "$CUSTOM_BODY_END_FILE" "${CUSTOM_BODY_END_HTML:-}")

echo ""
echo "=== Injection Summary ==="
echo "HEAD:       $(printf '%s' "$CUSTOM_HEAD" | wc -c) bytes"
echo "BODY START: $(printf '%s' "$CUSTOM_BODY_START" | wc -c) bytes"
echo "BODY END:   $(printf '%s' "$CUSTOM_BODY_END" | wc -c) bytes"
echo "========================="
echo ""

INDEX_PAGE=$(find_page index.html || true)
LOBBY_PAGE=$(find_page lobby.html || true)

if [ -z "$INDEX_PAGE" ] && [ -z "$LOBBY_PAGE" ]; then
  echo "ERROR: neither index.html nor lobby.html found in /app/ or /app/public/"
  echo "Skipping HTML injection, starting application anyway..."
else
  [ -n "$INDEX_PAGE" ] && inject_into "$INDEX_PAGE" || echo "WARNING: index.html not found"
  [ -n "$LOBBY_PAGE" ] && inject_into "$LOBBY_PAGE" || echo "WARNING: lobby.html not found"
fi

echo "Starting application..."

# Start the Node.js server
exec "$@"
