import { signInAction } from "@/app/actions";
import { AuthCard } from "@/components/common/auth-card";
import { FormMessage, Message } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";

export default async function Login(props: { searchParams: Promise<Message> }) {
  const searchParams = await props.searchParams;
  return (
    <AuthCard
      headerContent={
        <>
          <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
          <p className="text-sm text-muted-foreground">
            Don't have an account?{" "}
            <Link className="text-primary hover:underline font-medium" href="/sign-up">
              Sign up
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
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link
                href="/forgot-password"
                className="text-sm text-muted-foreground hover:text-primary"
              >
                Forgot password?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              name="password"
              placeholder="••••••••"
              required
            />
          </div>
        </div>
        <SubmitButton 
          className="w-full" 
          pendingText="Signing in..." 
          formAction={signInAction}
        >
          Sign in
        </SubmitButton>
        <FormMessage message={searchParams} />
      </form>
    </AuthCard>
  );
}
