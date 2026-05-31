// Opt-in pagination for list endpoints.
//
// When a request includes ?page or ?pageSize, the endpoint paginates and
// returns an envelope: { rows, total, page, pageSize }. When NEITHER param is
// present, paginated=false and the endpoint returns a plain array (preserving
// the Dashboard's "fetch all, aggregate client-side" callers).
//
// Query functions take the resulting { limit, offset } and, when paginating,
// tack a `COUNT(*) OVER() AS total_count` onto their SELECT to get the grand
// total in the same round-trip.

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE     = 500;

export function parsePagination(query, { defaultPageSize = DEFAULT_PAGE_SIZE, maxPageSize = MAX_PAGE_SIZE } = {}) {
  if (query.page === undefined && query.pageSize === undefined) {
    return { paginated: false };
  }
  const page     = Math.max(1, parseInt(query.page, 10) || 1);
  const pageSize = Math.min(maxPageSize, Math.max(1, parseInt(query.pageSize, 10) || defaultPageSize));
  return {
    paginated: true,
    page,
    pageSize,
    limit:  pageSize,
    offset: (page - 1) * pageSize,
  };
}

/**
 * Shape a paginated result. `rows` already contains a `total_count` column
 * (from COUNT(*) OVER()); we strip it off each row and surface it as `total`.
 */
export function paginatedResult(rows, { page, pageSize }) {
  const total = rows.length ? Number(rows[0].total_count) : 0;
  return {
    rows: rows.map(({ total_count, ...rest }) => rest),
    total,
    page,
    pageSize,
  };
}
