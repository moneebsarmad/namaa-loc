import { Badge, Button, Card, Input } from "@namaa-loc/ui";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#faf9f7] pattern-overlay px-6 py-12">
      <section className="mx-auto max-w-3xl">
        <div className="mb-8">
          <Badge className="mb-4 inline-flex rounded-lg px-3 py-1 text-sm">
            Visual foundation check
          </Badge>
          <h1 className="gold-underline pb-2 text-3xl font-bold text-[#1a1a1a]">
            namaa-loc portal
          </h1>
        </div>

        <Card className="rounded-2xl p-6">
          <div className="space-y-4">
            <label className="block text-sm font-semibold text-[#1a1a1a]">
              Program name
            </label>
            <Input
              aria-label="Program name"
              className="w-full rounded-xl px-3 py-2.5 text-sm"
              defaultValue="League of Champions"
            />
            <Button className="rounded-xl px-5 py-2.5 text-sm font-medium text-white">
              Save visual check
            </Button>
          </div>
        </Card>
      </section>
    </main>
  );
}
