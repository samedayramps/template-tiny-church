import { SubscribeForm } from "@/components/subscribe-form";

export default function Home() {
  return (
    <div className="flex-1 w-full flex flex-col items-center justify-center min-h-screen text-center px-4">
      <div className="max-w-3xl">
        <h1 className="text-6xl font-bold mb-8">
          Focus on your calling,<br/>
          not technology.
        </h1>
        <p className="text-xl text-foreground/80 mb-12">
          We provide small churches with a simple, all-in-one platform that handles 
          their complete digital presence, so pastors can focus on ministry instead of 
          managing technology.
        </p>
        <div className="flex flex-col items-center gap-4">
          <SubscribeForm />
          <p className="text-sm text-muted-foreground">
            Be the first to know when we launch
          </p>
        </div>
      </div>
    </div>
  );
}
