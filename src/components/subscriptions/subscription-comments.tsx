"use client";

/**
 * Internal notes on a subscription (permission `comments:create` to post).
 */
import {
  addSubscriptionComment,
  listSubscriptionComments,
  type SubscriptionCommentItem,
} from "@/actions/subscriptions";
import { Can } from "@/components/common/can";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, MessageSquareText } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { formatDate } from "./subscription-detail.utils";

interface SubscriptionCommentsProps {
  subscriptionId: string;
  onPosted?: () => void;
}

export function SubscriptionComments({
  subscriptionId,
  onPosted,
}: SubscriptionCommentsProps) {
  const t = useTranslations("lifecycle.comments");
  const [items, setItems] = useState<SubscriptionCommentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [body, setBody] = useState("");

  const load = useCallback(async () => {
    setIsLoading(true);
    const result = await listSubscriptionComments(subscriptionId);
    if (result.success && result.data) setItems(result.data);
    setIsLoading(false);
  }, [subscriptionId]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async () => {
    if (!body.trim()) return;
    setIsSubmitting(true);
    const result = await addSubscriptionComment(subscriptionId, body);
    setIsSubmitting(false);
    if (!result.success || !result.data) {
      toast.error(result.error ?? t("submit"));
      return;
    }
    const created = result.data;
    setItems((prev) => [created, ...prev]);
    setBody("");
    toast.success(t("added"));
    onPosted?.();
  };

  return (
    <Card className="border-border/50 rounded-sm shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquareText className="text-muted-foreground h-4 w-4" />
          {t("title")}
        </CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Can permission="comments:create">
          <div className="space-y-2">
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={t("placeholder")}
              rows={3}
              disabled={isSubmitting}
              aria-label={t("title")}
            />
            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={() => void submit()}
                disabled={isSubmitting || !body.trim()}
              >
                {isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {isSubmitting ? t("submitting") : t("submit")}
              </Button>
            </div>
          </div>
        </Can>

        {isLoading ? (
          <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
        ) : items.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("empty")}</p>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => (
              <li
                key={item.id}
                className="bg-muted/40 rounded-md border px-3 py-2.5 text-sm"
              >
                <div className="text-muted-foreground mb-1 flex items-center justify-between text-xs">
                  <span className="font-medium">
                    {item.author?.name ??
                      item.author?.email ??
                      t("unknownAuthor")}
                  </span>
                  <time dateTime={new Date(item.createdAt).toISOString()}>
                    {formatDate(item.createdAt)}
                  </time>
                </div>
                <p className="whitespace-pre-wrap">{item.body}</p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
