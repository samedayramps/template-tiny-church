import { z } from "zod"

export const tableActionSchema = z.object({
  id: z.string(),
  action: z.enum(["edit", "delete", "view"]),
  data: z.record(z.unknown())
})

export async function validateTableAction(data: unknown) {
  return tableActionSchema.parseAsync(data)
} 