#!/bin/sh
# Publish site/ to the gh-pages branch, which GitHub Pages serves at
# https://simononenineeight.github.io/sprinkie/ (#60). The privacy policy URL
# goes into App Store Connect, so this path has to stay stable.
#
# gh-pages carries the documents and nothing else: Pages from /docs on main
# would have served the release runbook and the ADRs as a website.
set -eu
cd "$(dirname "$0")/.."

# A policy naming an address that does not exist is worse than no policy, so
# the placeholder is a hard stop rather than a warning.
if grep -rq PRIVACY_CONTACT_EMAIL site/; then
  echo "refusing to publish: site/ still carries the PRIVACY_CONTACT_EMAIL placeholder" >&2
  exit 1
fi

WT=$(mktemp -d)
git worktree add --force -B gh-pages "$WT" >/dev/null
find "$WT" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
cp -R site/. "$WT/"
git -C "$WT" add -A
# Distinguish "nothing to commit" from a commit that actually failed. `|| true`
# on the commit would force-push the old tip and still report success.
if git -C "$WT" diff --cached --quiet; then
  echo "site unchanged; nothing to publish"
  git worktree remove --force "$WT"
  exit 0
fi
git -C "$WT" commit --quiet -m "Publish site from $(git rev-parse --short HEAD)"
git -C "$WT" push --force origin gh-pages
git worktree remove --force "$WT"
echo "published: https://simononenineeight.github.io/sprinkie/"
