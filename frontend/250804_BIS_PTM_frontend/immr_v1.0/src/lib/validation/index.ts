import { z } from "zod";

// validation을 위한 zod schema

export const paginationSchema = z.object({
  next_page: z.union([z.number(), z.literal("null")]),
  page: z.number(),
  pages: z.number(),
  prev_page: z.union([z.number(), z.literal("null")]),
  total: z.number(),
});
