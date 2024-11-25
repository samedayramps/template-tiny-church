"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, DefaultValues, Path, FieldValues } from "react-hook-form"
import * as z from "zod"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface EditFormProps<T extends z.ZodObject<any>> {
  schema: T
  defaultValues: z.infer<T>
  onSubmit: (values: z.infer<T>) => Promise<void>
  fields: Array<{
    name: keyof z.infer<T> & string
    label: string
    description?: string
    type?: string
    placeholder?: string
    options?: Array<{
      label: string
      value: string
    }>
  }>
  isSubmitting?: boolean
}

export function EditForm<T extends z.ZodObject<any>>({
  schema,
  defaultValues,
  onSubmit,
  fields,
  isSubmitting = false,
}: EditFormProps<T>) {
  type FormData = z.infer<T>
  
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues as DefaultValues<FormData>,
  })

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {fields.map((field) => (
          <FormField
            key={field.name}
            control={form.control}
            name={field.name as Path<FormData>}
            render={({ field: formField }) => (
              <FormItem>
                <FormLabel>{field.label}</FormLabel>
                <FormControl>
                  {field.type === 'select' && field.options ? (
                    <Select
                      value={formField.value?.toString() || ''}
                      onValueChange={formField.onChange}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={field.placeholder} />
                      </SelectTrigger>
                      <SelectContent>
                        {field.options.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      type={field.type || "text"}
                      placeholder={field.placeholder}
                      {...formField}
                    />
                  )}
                </FormControl>
                {field.description && (
                  <FormDescription>{field.description}</FormDescription>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
        ))}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Changes
        </Button>
      </form>
    </Form>
  )
} 