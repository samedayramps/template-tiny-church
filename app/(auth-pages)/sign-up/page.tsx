import { signUpAction } from "@/app/actions";
import { AuthCard } from "@/components/common/auth-card";
import { FormMessage, Message } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";

export default async function Signup(props: {
  searchParams: Promise<Message>;
}) {
  const searchParams = await props.searchParams;
  if ("message" in searchParams) {
    return (
      <div className="w-full flex items-center justify-center gap-2">
        <FormMessage message={searchParams} />
      </div>
    );
  }

  return (
    <AuthCard
      headerContent={
        <>
          <h1 className="text-2xl font-semibold tracking-tight">Sign up</h1>
          <p className="text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link className="text-primary hover:underline font-medium" href="/sign-in">
              Sign in
            </Link>
          </p>
        </>
      }
    >
      <form className="flex flex-col w-full space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input 
              id="email"
              name="email" 
              type="email"
              placeholder="you@example.com" 
              required 
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              name="password"
              placeholder="••••••••"
              minLength={6}
              required
            />
          </div>
        </div>
        <SubmitButton 
          className="w-full" 
          formAction={signUpAction} 
          pendingText="Signing up..."
        >
          Sign up
        </SubmitButton>
        <FormMessage message={searchParams} />
      </form>
    </AuthCard>
  );
}
