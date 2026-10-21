"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertCircle, CheckCircle2, Clock3, ExternalLink, Instagram, LoaderCircle, MessageCircle, RefreshCw, XCircle } from "lucide-react";

type CommentEvent = {
  id: string;
  commentId: string;
  username: string | null;
  commentText: string;
  mediaId: string | null;
  matchedKeyword: string | null;
  status: "sent" | "failed" | "ignored" | "processing" | string;
  dmMessageId: string | null;
  errorMessage: string | null;
  receivedAt: string;
  processedAt: string | null;
};

export default function InstagramCommentsPage() {
  const [comments, setComments] = useState<CommentEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadComments = useCallback(async (quiet = false) => {
    if (!quiet) setRefreshing(true);
    try {
      const response = await fetch("/api/instagram/comments", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result.status) throw new Error(result.message || "Could not load Instagram comments");
      setComments(result.data.comments ?? []);
      setError("");
      setLastUpdated(new Date());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load comments");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadComments(true);
    const timer = window.setInterval(() => void loadComments(true), 30_000);
    return () => window.clearInterval(timer);
  }, [loadComments]);

  const stats = useMemo(() => ({
    total: comments.length,
    sent: comments.filter((item) => item.status === "sent").length,
    failed: comments.filter((item) => item.status === "failed").length,
    ignored: comments.filter((item) => item.status === "ignored").length,
  }), [comments]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-pink-600 dark:text-pink-400"><Instagram className="h-4 w-4" /> Instagram automation</div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Comment → private reply</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">Recent comments on the connected professional account and whether a keyword-triggered private reply was confirmed.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a href="/dashboard/instagram-comments/setup" className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm hover:bg-muted"><ExternalLink className="h-4 w-4" /> Setup guide</a>
          <Button variant="outline" size="sm" onClick={() => void loadComments()} disabled={refreshing}>
            {refreshing ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />} Refresh
          </Button>
        </div>
      </header>

      {error && <div role="alert" className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" /><div><p className="font-medium">Comments could not be refreshed</p><p className="mt-1 text-muted-foreground">{error}</p></div></div>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Recent comments" value={stats.total} icon={<MessageCircle className="h-4 w-4" />} />
        <Metric label="Private replies sent" value={stats.sent} icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />} />
        <Metric label="Delivery failures" value={stats.failed} icon={<XCircle className="h-4 w-4 text-rose-600" />} />
        <Metric label="No keyword match" value={stats.ignored} icon={<Clock3 className="h-4 w-4 text-muted-foreground" />} />
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between border-b">
          <div><CardTitle className="text-base">Latest 50 comments</CardTitle><p className="mt-1 text-xs text-muted-foreground">Refreshes automatically every 30 seconds{lastUpdated ? ` · Updated ${lastUpdated.toLocaleTimeString()}` : ""}</p></div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? <div className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground"><LoaderCircle className="h-4 w-4 animate-spin" /> Loading comments…</div> : comments.length === 0 ? <div className="p-12 text-center"><Instagram className="mx-auto h-8 w-8 text-muted-foreground/50" /><h2 className="mt-3 font-semibold">No comments received yet</h2><p className="mt-1 text-sm text-muted-foreground">Once Meta sends a signed comments webhook, events will appear here.</p></div> : <>
            <div className="space-y-3 p-3 md:hidden">
              {comments.map((comment) => <CommentCard key={comment.id} comment={comment} />)}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <Table>
                <TableHeader><TableRow><TableHead>Comment</TableHead><TableHead>Keyword</TableHead><TableHead>Received</TableHead><TableHead>DM status</TableHead></TableRow></TableHeader>
                <TableBody>{comments.map((comment) => <TableRow key={comment.id}>
                  <TableCell className="max-w-[520px]"><div className="font-medium">{comment.username ? `@${comment.username}` : "Instagram user"}</div><div className="mt-1 line-clamp-2 whitespace-pre-wrap text-sm text-muted-foreground">{comment.commentText || "(no text)"}</div></TableCell>
                  <TableCell>{comment.matchedKeyword ? <Badge variant="secondary">{comment.matchedKeyword}</Badge> : <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{formatDate(comment.receivedAt)}</TableCell>
                  <TableCell><StatusBadge status={comment.status} error={comment.errorMessage} /></TableCell>
                </TableRow>)}</TableBody>
              </Table>
            </div>
          </>}
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">Duplicate webhook events are deduplicated by comment ID. Failed sends are recorded for review and are not automatically retried, so an uncertain network outcome cannot create a duplicate DM.</p>
    </div>
  );
}

function Metric({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return <Card><CardContent className="flex items-center justify-between gap-3 p-4"><div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p></div><div className="rounded-lg bg-muted p-2">{icon}</div></CardContent></Card>;
}

function CommentCard({ comment }: { comment: CommentEvent }) {
  return <article className="rounded-lg border p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-semibold">{comment.username ? `@${comment.username}` : "Instagram user"}</p><p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground">{comment.commentText || "(no text)"}</p></div><StatusBadge status={comment.status} error={comment.errorMessage} /></div><div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-2 text-xs text-muted-foreground"><span>{comment.matchedKeyword ? `Matched: ${comment.matchedKeyword}` : "No keyword match"}</span><time>{formatDate(comment.receivedAt)}</time></div></article>;
}

function StatusBadge({ status, error }: { status: string; error?: string | null }) {
  const styles: Record<string, string> = {
    sent: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    failed: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
    ignored: "border-muted-foreground/20 bg-muted text-muted-foreground",
    processing: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  };
  const label: Record<string, string> = { sent: "DM sent", failed: "Failed", ignored: "Not matched", processing: "Sending" };
  return <span title={error || undefined}><Badge variant="outline" className={styles[status] || ""}>{label[status] || status}</Badge>{error && <p className="mt-1 max-w-48 text-xs text-rose-600">{error}</p>}</span>;
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}
