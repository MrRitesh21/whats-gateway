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
import { Loader2, Plus, Trash2, Power, MessageSquareText, Instagram, Unlink } from "lucide-react";

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
  const [connectReady, setConnectReady] = useState(false);
  const [connection, setConnection] = useState<{ username: string; instagramUserId: string; tokenExpiresAt: string; webhookSubscribed: boolean } | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
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
      setConnection(data.connection || null);
      setConnectReady(!!data.connectReady);
      setWebhookPath(data.webhookPath);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to load rules"); }
    finally { setLoading(false); }
  }, [channel]);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    const result = new URLSearchParams(window.location.search).get("instagram_connect");
    if (!result) return;
    if (result === "success") toast.success("Instagram account connected");
    else if (result === "connected_webhook_pending") toast.warning("Account connected; webhook subscription needs attention");
    else if (result === "cancelled") toast.info("Instagram connection cancelled");
    else toast.error("Could not connect Instagram. Check app settings and try again.");
    window.history.replaceState({}, "", window.location.pathname);
    void refresh();
  }, [refresh]);

  async function disconnectInstagram() {
    if (!window.confirm(`Disconnect @${connection?.username || "Instagram"}? Automation for this account will stop.`)) return;
    setDisconnecting(true);
    try {
      const result = await fetch("/api/instagram/connection", { method: "DELETE" });
      const data = await result.json();
      if (!result.ok) throw new Error(data.error || "Could not disconnect Instagram");
      setConnection(null); setConfigured(false); setRules([]); toast.success("Instagram account disconnected");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not disconnect Instagram"); }
    finally { setDisconnecting(false); }
  }

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

    {!cloud && <Card className="border-pink-500/30">
      <CardHeader><CardTitle className="flex items-center gap-2"><Instagram className="h-5 w-5" />Instagram account</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {connection ? <>
          <div className="flex flex-wrap items-center gap-2"><span className="font-medium">@{connection.username}</span><Badge>Connected</Badge><Badge variant={connection.webhookSubscribed ? "default" : "secondary"}>{connection.webhookSubscribed ? "Comments webhook active" : "Webhook needs setup"}</Badge></div>
          <p className="text-sm text-muted-foreground">Access token is stored encrypted on the server and never shown in the browser. Token expiry: {new Date(connection.tokenExpiresAt).toLocaleDateString()}.</p>
          {!connection.webhookSubscribed && <p className="text-sm text-amber-700">Account linked, but Meta did not confirm comment webhook subscription. Confirm the Instagram Comments webhook field is enabled in your Meta app.</p>}
          <Button variant="outline" onClick={() => void disconnectInstagram()} disabled={disconnecting}>{disconnecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Unlink className="mr-2 h-4 w-4" />}Disconnect Instagram</Button>
        </> : <>
          <p className="text-sm text-muted-foreground">Connect a professional Instagram account using Meta’s secure authorization. Only this signed-in account can manage its Instagram rules.</p>
          {connectReady ? <Button asChild><a href="/api/instagram/connect"><Instagram className="mr-2 h-4 w-4" />Connect Instagram account</a></Button> : <div className="space-y-2"><Button disabled><Instagram className="mr-2 h-4 w-4" />Connect Instagram account</Button><p className="text-sm text-muted-foreground">Server setup required before OAuth: configure Instagram App ID/secret, token-encryption key, Meta webhook secret and verify token.</p></div>}
        </>}
      </CardContent>
    </Card>}

    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><MessageSquareText className="h-5 w-5" />{labels[channel]}</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p>Meta connection: <Badge variant={configured ? "default" : "secondary"}>{configured ? "Configured" : cloud ? "Needs server setup" : "Not connected"}</Badge></p>
        <p>Webhook endpoint: <code className="rounded bg-muted px-2 py-1">{webhookPath || (cloud ? "/api/webhooks/whatsapp-cloud" : "/api/webhooks/instagram")}</code></p>
        <p className="text-muted-foreground">{cloud ? "Official WhatsApp Cloud API. Sends a free-form text reply only after an inbound customer message; Meta's customer-service window and messaging policies apply. Credentials stay in server environment variables." : "Matches comments on your connected Instagram professional account and sends a private reply to the comment. Account tokens are encrypted server-side."}</p>
      </CardContent>
    </Card>

    <Card><CardHeader><CardTitle>Create a rule</CardTitle></CardHeader><CardContent>
      <form onSubmit={createRule} className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2"><Label htmlFor="keyword">{cloud ? "Keyword / pattern" : "Keyword + typo variants"}</Label><Input id="keyword" value={keyword} onChange={(event) => setKeyword(event.target.value)} maxLength={300} placeholder={cloud ? "e.g. pricing" : "e.g. details, detials, detailes"} /><p className="text-xs text-muted-foreground">{cloud ? "One matching keyword or pattern." : "Comma-separate spelling variants; matching ignores case."}</p></div>
        <div className="space-y-2"><Label>Match behavior</Label><Select value={matchType} onValueChange={setMatchType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{matchTypes.map((item) => <SelectItem key={item} value={item}>{item.replace("_", " ")}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-2 md:col-span-2"><Label htmlFor="response">Reply text</Label><Textarea id="response" value={response} onChange={(event) => setResponse(event.target.value)} maxLength={cloud ? 4000 : 1000} className="min-h-28" placeholder="Write the reply. You can include a link." /></div>
        <div><Button type="submit" disabled={saving || !keyword.trim() || !response.trim() || (!cloud && !connection)}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}Save rule</Button></div>
      </form>
    </CardContent></Card>

    <section className="space-y-3"><h2 className="text-lg font-semibold">Rules</h2>
      {loading ? <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div> : rules.length === 0 ? <Card className="border-dashed"><CardContent className="py-8 text-center text-muted-foreground">No rules yet. Add a keyword and response above to start.</CardContent></Card> : <div className="grid gap-3 md:grid-cols-2">{rules.map((rule) => <Card key={rule.id}><CardContent className="flex gap-3 p-4"><div className="min-w-0 flex-1 space-y-2"><div className="flex flex-wrap items-center gap-2"><strong className="break-all">{rule.keyword}</strong><Badge variant="outline">{rule.matchType}</Badge><Badge variant={rule.isActive ? "default" : "secondary"}>{rule.isActive ? "Active" : "Paused"}</Badge></div><p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{rule.response}</p></div><div className="flex shrink-0 flex-col gap-1"><Button size="icon" variant="ghost" aria-label={rule.isActive ? "Pause rule" : "Activate rule"} onClick={() => void updateRule(rule)}><Power className="h-4 w-4" /></Button><Button size="icon" variant="ghost" aria-label="Delete rule" onClick={() => void deleteRule(rule)}><Trash2 className="h-4 w-4" /></Button></div></CardContent></Card>)}</div>}
    </section>
    <p className="text-xs text-muted-foreground">Instagram automation is scoped to the account connected by the signed-in owner. WhatsApp Cloud API rules remain platform-admin managed; the existing linked-device WhatsApp automation is unchanged.</p>
  </div>;
}
