"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { Framework } from "@/app/actions/test-cases"

interface SelectionState {
  /** Selected test case ids, keyed by project so selections never leak across projects. */
  selected: Record<string, string[]>
  toggle: (projectId: string, id: string) => void
  setMany: (projectId: string, ids: string[]) => void
  clear: (projectId: string) => void
}

export const useSelection = create<SelectionState>((set) => ({
  selected: {},
  toggle: (projectId, id) =>
    set((s) => {
      const cur = new Set(s.selected[projectId] ?? [])
      if (cur.has(id)) cur.delete(id)
      else cur.add(id)
      return { selected: { ...s.selected, [projectId]: [...cur] } }
    }),
  setMany: (projectId, ids) => set((s) => ({ selected: { ...s.selected, [projectId]: ids } })),
  clear: (projectId) => set((s) => ({ selected: { ...s.selected, [projectId]: [] } })),
}))

interface PrefsState {
  framework: Framework
  environment: string
  setFramework: (f: Framework) => void
  setEnvironment: (e: string) => void
}

export const usePrefs = create<PrefsState>()(
  persist(
    (set) => ({
      framework: "playwright",
      environment: "Staging · Chrome 130 · macOS 15",
      setFramework: (framework) => set({ framework }),
      setEnvironment: (environment) => set({ environment }),
    }),
    { name: "qaforge-prefs" },
  ),
)
