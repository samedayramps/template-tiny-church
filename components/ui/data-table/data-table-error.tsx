"use client"

import { AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export function DataTableError({ error, reset }: { 
  error: Error
  reset: () => void 
}) {
  return (
    <Alert variant="destructive" className="my-4">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Error</AlertTitle>
      <AlertDescription className="mt-1 flex items-center justify-between">
        <span>{error.message || "Something went wrong"}</span>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={reset}
          className="ml-2"
        >
          Try again
        </Button>
      </AlertDescription>
    </Alert>
  )
} 