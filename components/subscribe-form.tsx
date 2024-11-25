'use client';

import { useToast } from "@/hooks/use-toast";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { subscribeAction } from "@/actions/subscription";

export function SubscribeForm() {
  const { toast } = useToast();

  return (
    <form 
      action={async (formData: FormData) => {
        const result = await subscribeAction(formData);
        if ('error' in result) {
          toast({
            variant: "destructive",
            title: "Error",
            description: result.error,
          });
        } else if ('success' in result) {
          toast({
            title: "Success",
            description: result.success,
          });
        }
      }} 
      className="flex w-full max-w-md gap-4"
    >
      <Input 
        type="email" 
        name="email"
        placeholder="Enter your email"
        className="flex-1"
        required
      />
      <SubmitButton
        className="bg-primary text-primary-foreground hover:bg-primary/90"
        pendingText="Subscribing..."
      >
        Subscribe
      </SubmitButton>
    </form>
  );
} 