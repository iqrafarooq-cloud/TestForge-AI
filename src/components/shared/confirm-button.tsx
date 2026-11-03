"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"

type ButtonProps = React.ComponentProps<typeof Button>

export function ConfirmButton({
  title,
  description,
  confirmLabel = "Delete",
  onConfirm,
  pending,
  children,
  ...buttonProps
}: Omit<ButtonProps, "onClick"> & {
  title: string
  description: string
  confirmLabel?: string
  pending?: boolean
  onConfirm: () => Promise<void> | void
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button {...buttonProps} onClick={() => setOpen(true)}>
        {children}
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription>{description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={async () => {
                await onConfirm()
                setOpen(false)
              }}
            >
              {pending && <Loader2 className="animate-spin" />}
              {confirmLabel}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
