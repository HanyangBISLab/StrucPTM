// Data fetching시 사용하는 util 함수
export const fetcher = async <T = any>(
  path: string,
  requestInit?: RequestInit
): Promise<T> => {
  return fetch(process.env.NEXT_PUBLIC_API_URL + path, {
    headers: {
      "Content-Type": "application/json",
    },
    ...requestInit,
  }).then((res) => res.json());
};
