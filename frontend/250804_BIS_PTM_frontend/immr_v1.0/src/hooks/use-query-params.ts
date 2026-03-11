import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

// Search Params를 가져오고 업데이트하는 Hook
export default function useQueryParams() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const createQueryString = useCallback(
    (
      items: Record<
        string,
        string | number | boolean | Array<string | number> | undefined | null
      >
    ) => {
      const params = new URLSearchParams(searchParams);

      for (const [key, value] of Object.entries(items)) {
        if (!value) {
          params.delete(key);
          continue;
        }

        if (typeof value === "string") {
          params.set(key, value);
          continue;
        }

        params.set(key, value.toString());
      }

      return params.toString();
    },
    [searchParams]
  );

  const setQueryParams = (
    items: Record<
      string,
      string | number | boolean | Array<string | number> | undefined | null
    >
  ) => {
    router.push(`${pathname}?${createQueryString(items)}`);
  };

  return {
    queryParams: searchParams,
    createQueryString,
    setQueryParams,
  };
}
