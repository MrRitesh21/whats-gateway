import { MetaAutomationRules } from "@/components/dashboard/meta-automation-rules";

export default function WhatsAppCloudAutomationPage() {
  return <div className="max-w-5xl space-y-3">
    <div><h1 className="text-xl font-bold tracking-tight sm:text-2xl">Automation channels</h1><p className="text-sm text-muted-foreground">Choose the official WhatsApp Cloud API or the existing linked-device integration.</p></div>
    <MetaAutomationRules channel="WHATSAPP_CLOUD" />
  </div>;
}
