#!/bin/sh
# startup.sh - Process HTML templates with custom injections
# This script runs before starting the Node.js server to inject custom HTML

set -e

echo "Starting Tunneler HTML injection process..."

# Auto-detect index.html location
if [ -f "/app/public/index.html" ]; then
  OUTPUT_FILE="/app/public/index.html"
  echo "Found index.html in /app/public/"
elif [ -f "/app/index.html" ]; then
  OUTPUT_FILE="/app/index.html"
  echo "Found index.html in /app/"
else
  echo "ERROR: index.html not found in /app/ or /app/public/"
  echo "Skipping HTML injection, starting application anyway..."
  exec "$@"
  exit 0
fi

# Define other paths
TEMPLATE_FILE="${OUTPUT_FILE}.template"
CUSTOM_HEAD_FILE="/app/config/custom-head.html"
CUSTOM_BODY_START_FILE="/app/config/custom-body-start.html"
CUSTOM_BODY_END_FILE="/app/config/custom-body-end.html"

# Function to read file or return empty string
read_file_or_empty() {
  local file=$1
  if [ -f "$file" ]; then
    cat "$file"
  else
    echo ""
  fi
}

# Check if template exists, if not use index.html as template
if [ ! -f "$TEMPLATE_FILE" ]; then
  # Check if index.html has injection points
  if ! grep -q "<!-- CUSTOM_HEAD -->" "$OUTPUT_FILE"; then
    echo "No injection points in index.html, skipping injection"
    exec "$@"
    exit 0
  fi
  
  TEMPLATE_FILE="$OUTPUT_FILE"
fi

# Read custom HTML snippets from files
CUSTOM_HEAD_FILE_CONTENT=$(read_file_or_empty "$CUSTOM_HEAD_FILE")
CUSTOM_BODY_START_FILE_CONTENT=$(read_file_or_empty "$CUSTOM_BODY_START_FILE")
CUSTOM_BODY_END_FILE_CONTENT=$(read_file_or_empty "$CUSTOM_BODY_END_FILE")

# Read from environment variables
CUSTOM_HEAD_ENV_CONTENT="${CUSTOM_HEAD_HTML:-}"
CUSTOM_BODY_START_ENV_CONTENT="${CUSTOM_BODY_START_HTML:-}"
CUSTOM_BODY_END_ENV_CONTENT="${CUSTOM_BODY_END_HTML:-}"

# Concatenate file content + environment content
# This allows using BOTH config files AND environment variables simultaneously
CUSTOM_HEAD=""
if [ -n "$CUSTOM_HEAD_FILE_CONTENT" ]; then
  CUSTOM_HEAD="$CUSTOM_HEAD_FILE_CONTENT"
fi
if [ -n "$CUSTOM_HEAD_ENV_CONTENT" ]; then
  if [ -n "$CUSTOM_HEAD" ]; then
    CUSTOM_HEAD="$CUSTOM_HEAD
  <!-- Additional content from environment variable -->
$CUSTOM_HEAD_ENV_CONTENT"
  else
    CUSTOM_HEAD="$CUSTOM_HEAD_ENV_CONTENT"
  fi
fi

CUSTOM_BODY_START=""
if [ -n "$CUSTOM_BODY_START_FILE_CONTENT" ]; then
  CUSTOM_BODY_START="$CUSTOM_BODY_START_FILE_CONTENT"
fi
if [ -n "$CUSTOM_BODY_START_ENV_CONTENT" ]; then
  if [ -n "$CUSTOM_BODY_START" ]; then
    CUSTOM_BODY_START="$CUSTOM_BODY_START
  <!-- Additional content from environment variable -->
$CUSTOM_BODY_START_ENV_CONTENT"
  else
    CUSTOM_BODY_START="$CUSTOM_BODY_START_ENV_CONTENT"
  fi
fi

CUSTOM_BODY_END=""
if [ -n "$CUSTOM_BODY_END_FILE_CONTENT" ]; then
  CUSTOM_BODY_END="$CUSTOM_BODY_END_FILE_CONTENT"
fi
if [ -n "$CUSTOM_BODY_END_ENV_CONTENT" ]; then
  if [ -n "$CUSTOM_BODY_END" ]; then
    CUSTOM_BODY_END="$CUSTOM_BODY_END
  <!-- Additional content from environment variable -->
$CUSTOM_BODY_END_ENV_CONTENT"
  else
    CUSTOM_BODY_END="$CUSTOM_BODY_END_ENV_CONTENT"
  fi
fi

# Display what we're injecting
echo ""
echo "=== Injection Summary ==="
if [ -n "$CUSTOM_HEAD" ]; then
  echo "✓ HEAD content:"
  [ -n "$CUSTOM_HEAD_FILE_CONTENT" ] && echo "  - From file: $(echo "$CUSTOM_HEAD_FILE_CONTENT" | wc -c) bytes"
  [ -n "$CUSTOM_HEAD_ENV_CONTENT" ] && echo "  - From env: $(echo "$CUSTOM_HEAD_ENV_CONTENT" | wc -c) bytes"
  echo "  - Total: $(echo "$CUSTOM_HEAD" | wc -c) bytes"
else
  echo "ℹ No HEAD content"
fi

if [ -n "$CUSTOM_BODY_START" ]; then
  echo "✓ BODY START content:"
  [ -n "$CUSTOM_BODY_START_FILE_CONTENT" ] && echo "  - From file: $(echo "$CUSTOM_BODY_START_FILE_CONTENT" | wc -c) bytes"
  [ -n "$CUSTOM_BODY_START_ENV_CONTENT" ] && echo "  - From env: $(echo "$CUSTOM_BODY_START_ENV_CONTENT" | wc -c) bytes"
  echo "  - Total: $(echo "$CUSTOM_BODY_START" | wc -c) bytes"
else
  echo "ℹ No BODY START content"
fi

if [ -n "$CUSTOM_BODY_END" ]; then
  echo "✓ BODY END content:"
  [ -n "$CUSTOM_BODY_END_FILE_CONTENT" ] && echo "  - From file: $(echo "$CUSTOM_BODY_END_FILE_CONTENT" | wc -c) bytes"
  [ -n "$CUSTOM_BODY_END_ENV_CONTENT" ] && echo "  - From env: $(echo "$CUSTOM_BODY_END_ENV_CONTENT" | wc -c) bytes"
  echo "  - Total: $(echo "$CUSTOM_BODY_END" | wc -c) bytes"
else
  echo "ℹ No BODY END content"
fi
echo "========================="
echo ""

# Create temporary file for processing
TEMP_FILE=$(mktemp)

# Process the template and inject custom HTML
# Using awk for more robust multiline replacement
awk -v head="$CUSTOM_HEAD" -v bodystart="$CUSTOM_BODY_START" -v bodyend="$CUSTOM_BODY_END" '
  /<!-- CUSTOM_HEAD -->/ {
    if (head != "") {
      print "  <!-- Custom HEAD content injected -->"
      print head
    }
    next
  }
  /<!-- CUSTOM_BODY_START -->/ {
    if (bodystart != "") {
      print "  <!-- Custom BODY START content injected -->"
      print bodystart
    }
    next
  }
  /<!-- CUSTOM_BODY_END -->/ {
    if (bodyend != "") {
      print "  <!-- Custom BODY END content injected -->"
      print bodyend
    }
    next
  }
  { print }
' "$TEMPLATE_FILE" > "$TEMP_FILE"

# Move processed file to output location
mv "$TEMP_FILE" "$OUTPUT_FILE"

echo "✓ HTML injection complete - Modified: $OUTPUT_FILE"
echo "Starting application..."

# Execute the original command (start Node.js server)
exec "$@"
