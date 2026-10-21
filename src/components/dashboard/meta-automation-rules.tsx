"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Trash2, Power, MessageSquareText } from "lucide-react";

type Channel = "INSTAGRAM" | "WHATSAPP_CLOUD";
type Rule = { id: string; keyword: string; matchType: string; response: string; isActive: boolean };
const labels: Record<Channel, string> = { INSTAGRAM: "Instagram comments", WHATSAPP_CLOUD: "WhatsApp Official API" };
const matchTypes = ["CONTAINS", "EXACT", "STARTS_WITH", "REGEX"];

export function MetaAutomationRules({ channel }: { channel: Channel }) {
  const [rules, setRules] = useState<Rule[]>([]);
  const [keyword, setKeyword] = useState("");
  const [response, setResponse] = useState("");
  const [matchType, setMatchType] = useState("CONTAINS");
  const [configured, setConfigured] = useState(false);
  const [webhookPath, setWebhookPath] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetch(`/api/channel-automation-rules?channel=${channel}`, { cache: "no-store" });
      const data = await result.json();
      if (!result.ok) throw new Error(data.error || "Unable to load automation rules");
      setRules(data.rules);
      setConfigured(data.configured);
      setWebhookPath(data.webhookPath);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to load rules"); }
    finally { setLoading(false); }
  }, [channel]);
  useEffect(() => { void refresh(); }, [refresh]);

  async function createRule(event: React.FormEvent) {
    event.preventDefault();
    if (!keyword.trim() || !response.trim()) return;
    setSaving(true);
    try {
      const result = await fetch("/api/channel-automation-rules", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ channel, keyword, response, matchType }) });
      const data = await result.json();
      if (!result.ok) throw new Error(data.error || "Could not save rule");
      setKeyword(""); setResponse(""); toast.success("Automation rule saved"); await refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not save rule"); }
    finally { setSaving(false); }
  }

  async function updateRule(rule: Rule) {
    const result = await fetch("/api/channel-automation-rules", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: rule.id, isActive: !rule.isActive }) });
    if (!result.ok) { toast.error("Could not update rule"); return; }
    setRules((items) => items.map((item) => item.id === rule.id ? { ...item, isActive: !item.isActive } : item));
  }
  async function deleteRule(rule: Rule) {
    if (!window.confirm(`Delete the “${rule.keyword}” rule?`)) return;
    const result = await fetch(`/api/channel-automation-rules?id=${encodeURIComponent(rule.id)}`, { method: "DELETE" });
    if (!result.ok) { toast.error("Could not delete rule"); return; }
    setRules((items) => items.filter((item) => item.id !== rule.id)); toast.success("Rule deleted");
  }

  const cloud = channel === "WHATSAPP_CLOUD";
  return <div className="max-w-5xl space-y-6">
    <div className="flex flex-wrap gap-2" role="tablist" aria-label="Automation channel">
      <Button variant={channel === "INSTAGRAM" ? "default" : "outline"} asChild><Link href="/dashboard/autoreply/instagram">Instagram</Link></Button>
      <Button variant={cloud ? "default" : "outline"} asChild><Link href="/dashboard/autoreply/whatsapp-cloud">WhatsApp Official API</Link></Button>
      <Button variant="outline" asChild><Link href="/dashboard/autoreply">WhatsApp linked device</Link></Button>
    </div>

    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><MessageSquareText className="h-5 w-5" />{labels[channel]}</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p>Meta connection: <Badge variant={configured ? "default" : "secondary"}>{configured ? "Configured" : "Needs server setup"}</Badge></p>
        <p>Webhook endpoint: <code className="rounded bg-muted px-2 py-1">{webhookPath || (cloud ? "/api/webhooks/whatsapp-cloud" : "/api/webhooks/instagram")}</code></p>
        <p className="text-muted-foreground">{cloud ? "Official WhatsApp Cloud API. Sends a free-form text reply only after an inbound customer message; Meta's customer-service window and messaging policies apply. Credentials stay in server environment variables." : "Matches comments on the configured Instagram professional account and sends a private reply to the comment. Credentials stay in server environment variables."}</p>
      </CardContent>
    </Card>

    <Card><CardHeader><CardTitle>Create a rule</CardTitle></CardHeader><CardContent>
      <form onSubmit={createRule} className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2"><Label htmlFor="keyword">Keyword / pattern</Label><Input id="keyword" value={keyword} onChange={(event) => setKeyword(event.target.value)} maxLength={300} placeholder={cloud ? "e.g. pricing" : "e.g. details"} /></div>
        <div className="space-y-2"><Label>Match behavior</Label><Select value={matchType} onValueChange={setMatchType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{matchTypes.map((item) => <SelectItem key={item} value={item}>{item.replace("_", " ")}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-2 md:col-span-2"><Label htmlFor="response">Reply text</Label><Textarea id="response" value={response} onChange={(event) => setResponse(event.target.value)} maxLength={cloud ? 4000 : 1000} className="min-h-28" placeholder="Write the reply. You can include a link." /></div>
        <div><Button type="submit" disabled={saving || !keyword.trim() || !response.trim()}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}Save rule</Button></div>
      </form>
    </CardContent></Card>

    <section className="space-y-3"><h2 className="text-lg font-semibold">Rules</h2>
      {loading ? <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div> : rules.length === 0 ? <Card className="border-dashed"><CardContent className="py-8 text-center text-muted-foreground">No rules yet. Add a keyword and response above to start.</CardContent></Card> : <div className="grid gap-3 md:grid-cols-2">{rules.map((rule) => <Card key={rule.id}><CardContent className="flex gap-3 p-4"><div className="min-w-0 flex-1 space-y-2"><div className="flex flex-wrap items-center gap-2"><strong className="break-all">{rule.keyword}</strong><Badge variant="outline">{rule.matchType}</Badge><Badge variant={rule.isActive ? "default" : "secondary"}>{rule.isActive ? "Active" : "Paused"}</Badge></div><p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{rule.response}</p></div><div className="flex shrink-0 flex-col gap-1"><Button size="icon" variant="ghost" aria-label={rule.isActive ? "Pause rule" : "Activate rule"} onClick={() => void updateRule(rule)}><Power className="h-4 w-4" /></Button><Button size="icon" variant="ghost" aria-label="Delete rule" onClick={() => void deleteRule(rule)}><Trash2 className="h-4 w-4" /></Button></div></CardContent></Card>)}</div>}
    </section>
    <p className="text-xs text-muted-foreground">Meta integrations are platform-admin managed because account credentials are configured once on the server. The existing linked-device WhatsApp automation remains unchanged.</p>
  </div>;
}
