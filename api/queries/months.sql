-- name: ListMonthDots :many
-- One row per entry in the month, date-then-position order; the handler
-- groups rows into days. Only structure leaves the database — dots need
-- categories, never content (ADR-0004).
-- Visibility is the hidden-set (#30): a refined Entry follows its
-- Subcategory (shown even under a hidden parent), an unrefined one follows
-- its Category; empty arrays hide nothing.
-- The Filter (#134, ADR-0010) applies alongside it: an unrefined Entry
-- shows when its Category is chosen; a refined one when its Category's
-- choice and its Subcategory's listing as an exception differ, so a
-- Subcategory nobody listed follows its Category. Both empty: no Filter.
select
    to_char(entry_date, 'YYYY-MM-DD') as entry_date,
    category_id
from entries
where journal_id = @journal_id::uuid
  and entry_date >= @first_day::date
  and entry_date < @next_month::date
  and not (
    (subcategory_id is null and category_id = any(@hidden_category_ids::uuid[]))
    or (subcategory_id is not null and subcategory_id = any(@hidden_subcategory_ids::uuid[]))
  )
  and (
    (cardinality(@filter_category_ids::uuid[]) = 0
      and cardinality(@filter_subcategory_exception_ids::uuid[]) = 0)
    or (subcategory_id is null and category_id = any(@filter_category_ids::uuid[]))
    or (subcategory_id is not null
      and (category_id = any(@filter_category_ids::uuid[]))
        <> (subcategory_id = any(@filter_subcategory_exception_ids::uuid[])))
  )
order by entry_date, position;
