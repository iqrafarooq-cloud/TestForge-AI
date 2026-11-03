"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { addDays, format } from "date-fns"
import { Loader2, Plus } from "lucide-react"
import { createProject } from "@/app/actions/projects"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useServerAction } from "@/hooks/use-server-action"

function suggestKey(name: string) {
  const words = name.toUpperCase().replace(/[^A-Z0-9 ]/g, "").split(/\s+/).filter(Boolean)
  const key = words.length > 1 ? words.map((w) => w[0]).join("") : (words[0] ?? "")
  return key.replace(/^[0-9]+/, "").slice(0, 6)
}

export function CreateProjectDialog({ variant = "default" }: { variant?: "default" | "outline" }) {
  const router = useRouter()
  const params = useSearchParams()
  const [openState, setOpen] = useState(false)
  const forcedOpen = params.get("new") === "1"
  const open = openState || forcedOpen
  const [name, setName] = useState("")
  const [key, setKey] = useState("")
  const [keyTouched, setKeyTouched] = useState(false)
  const today = format(new Date(), "yyyy-MM-dd")
  const { run, pending } = useServerAction(createProject, { success: "Project created" })

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o && forcedOpen) router.replace("/projects")
      }}
    >
      <DialogTrigger asChild>
        <Button variant={variant}>
          <Plus /> New project
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            const fd = new FormData(e.currentTarget)
            const res = await run({
              name: String(fd.get("name")),
              description: String(fd.get("description") ?? ""),
              key: String(fd.get("key")),
              start_date: String(fd.get("start_date")),
              end_date: String(fd.get("end_date")),
            })
            if (res) {
              setOpen(false)
              router.push(`/projects/${res.id}/requirements`)
            }
          }}
          className="space-y-5"
        >
          <DialogHeader>
            <DialogTitle>Create project</DialogTitle>
            <DialogDescription>A project holds requirements, test cases, executions and defects for one release or product.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-[1fr_7rem] gap-3">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  name="name"
                  required
                  minLength={2}
                  maxLength={120}
                  placeholder="Checkout revamp v2"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value)
                    if (!keyTouched) setKey(suggestKey(e.target.value))
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="key">Key</Label>
                <Input
                  id="key"
                  name="key"
                  required
                  pattern="[A-Za-z][A-Za-z0-9]{1,9}"
                  title="2-10 letters or digits, starting with a letter"
                  className="font-mono uppercase"
                  placeholder="CHK"
                  value={key}
                  onChange={(e) => {
                    setKeyTouched(true)
                    setKey(e.target.value.toUpperCase())
                  }}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" rows={3} placeholder="Scope, platforms, release goals…" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="start_date">Test start</Label>
                <Input id="start_date" name="start_date" type="date" required defaultValue={today} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_date">Release date</Label>
                <Input
                  id="end_date"
                  name="end_date"
                  type="date"
                  required
                  defaultValue={format(addDays(new Date(), 28), "yyyy-MM-dd")}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setOpen(false)
                if (forcedOpen) router.replace("/projects")
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />}
              Create project
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
