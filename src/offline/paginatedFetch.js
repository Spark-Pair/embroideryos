import { apiClient } from "../api/apiClient";

const PAGE_SIZE = 1000;
const MAX_PAGES = 1000;

// Fetch a complete list without relying on the server's maximum page size.
// The returned shape stays compatible with apiClient responses used by the
// existing cache seeders: response.data.data is the complete row list.
export const fetchAllPages = async (url, params = {}) => {
  const rows = [];
  let page = 1;
  let firstResponse = null;

  while (page <= MAX_PAGES) {
    const response = await apiClient.get(url, {
      params: { ...params, page, limit: PAGE_SIZE },
    });
    if (!firstResponse) firstResponse = response;

    const pageRows = Array.isArray(response?.data?.data) ? response.data.data : [];
    rows.push(...pageRows);

    const pagination = response?.data?.pagination;
    const totalPages = Number(pagination?.totalPages);
    if (!pagination || !Number.isFinite(totalPages) || page >= totalPages || pageRows.length === 0) {
      return {
        ...firstResponse,
        data: {
          ...(firstResponse?.data || {}),
          data: rows,
          pagination: pagination
            ? { ...pagination, currentPage: 1, totalPages: 1, itemsPerPage: rows.length }
            : undefined,
        },
      };
    }
    page += 1;
  }

  throw new Error(`Pagination exceeded ${MAX_PAGES} pages for ${url}`);
};
