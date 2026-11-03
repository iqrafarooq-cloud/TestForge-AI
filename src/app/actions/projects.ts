"use server"

import { revalidatePath } from "next/cache"
import { addDays, differenceInCalendarDays, formatISO, parseISO } from "date-fns"
import { and, eq } from "drizzle-orm"
import { z } from "zod"
import { getDb, schema } from "@/lib/db"
import { requireProject, safe, UserError } from "@/lib/server/guard"

const projectInput = z
  .object({
    name: z.string().trim().min(2, "Name is too short").max(120),
    description: z.string().trim().max(2000).optional().default(""),
    key: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z][A-Z0-9]{1,9}$/, "Key must be 2-10 letters/digits starting with a letter"),
    start_date: z.iso.date(),
    end_date: z.iso.date(),
  })
  .refine((v) => v.end_date >= v.start_date, { message: "End date must be after start date" })

const DEFAULT_PHASES: [string, number, number][] = [
  ["Requirement analysis", 0, 0.15],
  ["Test design", 0.15, 0.35],
  ["Test data & automation", 0.3, 0.55],
  ["Test execution", 0.5, 0.85],
  ["Regression & sign-off", 0.85, 1],
]

export async function createProject(input: z.input<typeof projectInput>) {
  return safe(async () => {
    const parsed = projectInput.safeParse(input)
    if (!parsed.success) throw new UserError(parsed.error.issues[0].message)
    const db = await getDb()

    const projectId = crypto.randomUUID()
    const start = parseISO(parsed.data.start_date)
    const span = Math.max(differenceInCalendarDays(parseISO(parsed.data.end_date), start), DEFAULT_PHASES.length)
    const day = (frac: number) => formatISO(addDays(start, Math.round(span * frac)), { representation: "date" })

    await db.batch([
      db.insert(schema.projects).values({ ...parsed.data, id: projectId }),
      db.insert(schema.phases).values(
        DEFAULT_PHASES.map(([name, from, to], position) => ({
          project_id: projectId,
          name,
          position,
          start_date: day(from),
          end_date: day(to),
        })),
      ),
    ])

    revalidatePath("/projects")
    return { id: projectId }
  })
}

export async function deleteProject(projectId: string) {
  return safe(async () => {
    const { db } = await requireProject(projectId)
    await db.delete(schema.projects).where(eq(schema.projects.id, projectId))
    revalidatePath("/projects")
    return null
  })
}

const phaseInput = z
  .object({
    id: z.uuid(),
    name: z.string().trim().min(1).max(80),
    start_date: z.iso.date(),
    end_date: z.iso.date(),
    progress: z.number().int().min(0).max(100),
  })
  .refine((v) => v.end_date >= v.start_date, { message: "End date must be after start date" })

export async function updatePhase(projectId: string, input: z.input<typeof phaseInput>) {
  return safe(async () => {
    const parsed = phaseInput.safeParse(input)
    if (!parsed.success) throw new UserError(parsed.error.issues[0].message)
    const { db } = await requireProject(projectId)
    const { id, ...rest } = parsed.data
    await db
      .update(schema.phases)
      .set(rest)
      .where(and(eq(schema.phases.id, id), eq(schema.phases.project_id, projectId)))
    revalidatePath(`/projects/${projectId}`)
    return null
  })
}
