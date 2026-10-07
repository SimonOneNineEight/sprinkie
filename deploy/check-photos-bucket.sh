#!/bin/sh
# Check that the hosted `photos` bucket matches [storage.buckets.photos] in
# supabase/config.toml (#54). Photo bytes never reach the API (ADR-0002), so
# the bucket's size and type limits are the only bound on an upload, and
# `supabase db push` does not carry them: the hosted bucket was made by hand.
# Exits non-zero on any difference, or if the bucket cannot be read.
#
# Needs a Supabase CLI that is logged in and linked to the hosted project.
set -eu
cd "$(dirname "$0")/.."

# `supabase link` writes supabase/.temp/ in the checkout it ran in, which is
# gitignored, so a fresh worktree is not linked. Use the main checkout's link.
LINKED=$(cd "$(git rev-parse --git-common-dir)/.." && pwd)

section() {
  sed -n '/^\[storage\.buckets\.photos\]$/,/^\[/p' supabase/config.toml
}
value() {
  section | sed -n "s/^$1 *= *//p"
}

public=$(value public)
size=$(value file_size_limit | tr -d '"')
mimes=$(value allowed_mime_types | tr -d '[]" ' | tr ',' ' ')

case "$size" in
  *GiB) bytes=$(( ${size%GiB} * 1024 * 1024 * 1024 )) ;;
  *MiB) bytes=$(( ${size%MiB} * 1024 * 1024 )) ;;
  *KiB) bytes=$(( ${size%KiB} * 1024 )) ;;
  *)
    echo "check-photos-bucket: cannot read file_size_limit \"$size\" from supabase/config.toml" >&2
    exit 1
    ;;
esac

want="public=$public file_size_limit=$bytes allowed_mime_types=$mimes"

# One text column, so the CSV output is the value itself: no float rendering
# of the bigint, no quoting of a list. A failed query stops here under set -e.
out=$(supabase db query --workdir "$LINKED" --linked -o csv "
  select format('public=%s file_size_limit=%s allowed_mime_types=%s',
                public::text, file_size_limit,
                array_to_string(allowed_mime_types, ' ')) as bucket
  from storage.buckets where id = 'photos'")
got=$(printf '%s\n' "$out" | sed -n 2p)

if [ -z "$got" ]; then
  echo "check-photos-bucket: no bucket 'photos' on the linked project" >&2
  exit 1
fi

if [ "$got" != "$want" ]; then
  echo "check-photos-bucket: the hosted photos bucket does not match supabase/config.toml" >&2
  echo "  config.toml: $want" >&2
  echo "  hosted:      $got" >&2
  exit 1
fi

echo "photos bucket matches supabase/config.toml: $got"
