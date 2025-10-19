#!/bin/bash -eu

body=$(curl -Ls "$SITE_URL")
response=$(curl -o /dev/null -Ls -w "%{http_code}\n" "$SITE_URL")

# WordPress-specific checks
if echo "$body" | grep -qi "error establishing a database connection"; then
  echo "❌ Database connection error found on the site."
  exit 1
fi

if echo "$body" | grep -qi "briefly unavailable for scheduled maintenance"; then
  echo "❌ Maintenance mode detected."
  exit 1
fi

if echo "$body" | grep -qi "fatal error"; then
  echo "❌ WordPress fatal error found on the page."
  exit 1
fi

# Catch-all Status Code Check
if [ "$response" -ge 200 ] && [ "$response" -lt 300 ]; then
  echo "✅ Website is up and HTTPS is working!"
  echo "HTTP status code: $response"
else
  echo "❌ Website is down. HTTP status code: $response"
  exit 1
fi
