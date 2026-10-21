import { MetaAutomationRules } from "@/components/dashboard/meta-automation-rules";

export default function InstagramAutomationPage() {
  return <div className="max-w-5xl space-y-3">
    <div><h1 className="text-xl font-bold tracking-tight sm:text-2xl">Automation channels</h1><p className="text-sm text-muted-foreground">Switch between WhatsApp and Instagram automation.</p></div>
    <MetaAutomationRules channel="INSTAGRAM" />
  </div>;
}
