#!/bin/sh
# Builds the Chrome Web Store upload. Lists files by name so tests, git data and
# local files such as .DS_Store never reach the store.
set -e
cd "$(dirname "$0")"
rm -f site-blocker.zip
zip -X site-blocker.zip manifest.json background.js domains.js focus.js \
  popup.html popup.css popup.js icon.png
