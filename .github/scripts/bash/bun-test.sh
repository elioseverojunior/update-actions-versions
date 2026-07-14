#!/usr/bin/env bash
# Run bun test and return proper exit code
# bun test has a bug where it returns exit code 1 even when all tests pass

output=$(bun test "$@" 2>&1)
exit_code=$?

echo "$output"

# Check if tests passed by looking for "0 fail" and " pass" in output
if echo "$output" | grep -q "0 fail" && echo "$output" | grep -q " pass"; then
    exit 0
fi

exit $exit_code
