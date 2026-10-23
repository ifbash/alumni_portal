'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { EyeOff, Flag, Heart, RotateCcw, Trash2 } from 'lucide-react';

import { Button, ConfirmDialog, Dialog, Field, Textarea, describedBy, useToast } from '@/components/ui';
import { api, outcomeToast } from '@/lib/client/api';
import { cn } from '@/lib/cn';

/**
 * What a member can do with a post: like it, report it, remove their own,
 * and, for moderators, hide or restore it.
 *
 * Every control is a real button with a visible label (the heart has the
 * count beside it and `aria-pressed`), because an icon-only row of four
 * things under every post is a row nobody can learn.
 *
 * The like is optimistic and rolls back if the server refuses. Everything
 * else waits for the answer: a report or a hide that appears to have worked
 * and did not is worse than a half-second of waiting.
 */

export function PostActions({
  postId,
  likeCount,
  viewerLiked,
  isOwn,
  canModerate,
  hidden,
  authorFirstName,
}: {
  postId: string;
  likeCount: number;
  viewerLiked: boolean;
  isOwn: boolean;
  canModerate: boolean;
  hidden: boolean;
  authorFirstName: string;
}) {
  const toast = useToast();
  const router = useRouter();

  const [liked, setLiked] = React.useState(viewerLiked);
  const [count, setCount] = React.useState(likeCount);
  const [reportOpen, setReportOpen] = React.useState(false);
  const [hideOpen, setHideOpen] = React.useState(false);
  const [removeOpen, setRemoveOpen] = React.useState(false);
  const [text, setText] = React.useState('');
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [reported, setReported] = React.useState(false);

  const toggleLike = async () => {
    const next = !liked;
    setLiked(next);
    setCount((c) => Math.max(0, c + (next ? 1 : -1)));
    const outcome = await api.post(`/api/posts/${postId}/like`, { liked: next });
    if (outcome.status !== 'ok') {
      setLiked(!next);
      setCount((c) => Math.max(0, c + (next ? -1 : 1)));
      toast.error('That did not go through', outcome.message);
    }
  };

  const run = async (
    key: string,
    call: () => ReturnType<typeof api.post>,
    title: string,
    done: () => void,
  ) => {
    setBusy(key);
    setError(null);
    const outcome = await call();
    setBusy(null);
    const t = outcomeToast(outcome, title);
    if (t) toast.show(t);
    if (outcome.status !== 'ok') {
      setError(outcome.message);
      return;
    }
    done();
    if (outcome.persisted) router.refresh();
  };

  const tooShort = (min: number) => text.trim().length > 0 && text.trim().length < min;

  return (
    <>
      <div className="flex flex-wrap items-center gap-x-1 gap-y-1 border-t border-line pt-2">
        {hidden ? null : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-pressed={liked}
            onClick={() => void toggleLike()}
            className={cn('min-h-11 sm:min-h-0', liked && 'text-brand-fg')}
          >
            <Heart className={cn('size-4', liked && 'fill-current')} aria-hidden="true" />
            <span className="tabular">{count > 0 ? count : ''}</span>
            <span>{liked ? 'Liked' : 'Like'}</span>
          </Button>
        )}

        <span className="ml-auto flex flex-wrap items-center gap-1">
          {!isOwn && !hidden ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={reported}
              onClick={() => {
                setText('');
                setReportOpen(true);
              }}
              className="min-h-11 sm:min-h-0"
            >
              <Flag className="size-4" aria-hidden="true" />
              {reported ? 'Reported' : 'Report'}
            </Button>
          ) : null}

          {isOwn ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => setRemoveOpen(true)} className="min-h-11 sm:min-h-0">
              <Trash2 className="size-4" aria-hidden="true" />
              Remove
            </Button>
          ) : null}

          {canModerate && !hidden ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setText('');
                setHideOpen(true);
              }}
              className="min-h-11 sm:min-h-0"
            >
              <EyeOff className="size-4" aria-hidden="true" />
              Hide
            </Button>
          ) : null}

          {canModerate && hidden ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              loading={busy === 'restore'}
              onClick={() =>
                void run('restore', () => api.patch(`/api/posts/${postId}`, { action: 'restore' }), 'Post restored', () => undefined)
              }
              className="min-h-11 sm:min-h-0"
            >
              <RotateCcw className="size-4" aria-hidden="true" />
              Restore
            </Button>
          ) : null}
        </span>
      </div>

      {error && !reportOpen && !hideOpen && !removeOpen ? (
        <p role="alert" className="pt-1 text-sm font-medium text-danger-fg">
          {error}
        </p>
      ) : null}

      <Dialog
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        title={`Report ${authorFirstName}’s post`}
        description="A moderator at the college reads this. The author is not told who reported it."
        footer={
          <>
            <Button variant="ghost" onClick={() => setReportOpen(false)} disabled={busy === 'report'}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                void run('report', () => api.post(`/api/posts/${postId}/report`, { reason: text.trim() }), 'Report sent', () => {
                  setReported(true);
                  setReportOpen(false);
                })
              }
              loading={busy === 'report'}
              disabled={text.trim().length < 8}
            >
              Send report
            </Button>
          </>
        }
      >
        <Field
          htmlFor={`report-${postId}`}
          label="What is wrong with it"
          required
          hint="A few words is enough: spam, a sales pitch, unkind to a batchmate."
          error={tooShort(8) ? 'A few words, so the moderator knows what to look at.' : error ?? undefined}
        >
          <Textarea
            id={`report-${postId}`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            maxLength={300}
            invalid={tooShort(8)}
            aria-describedby={describedBy(`report-${postId}`, { hint: true, error: tooShort(8) })}
          />
        </Field>
      </Dialog>

      <Dialog
        open={hideOpen}
        onClose={() => setHideOpen(false)}
        title={`Hide ${authorFirstName}’s post`}
        description="It leaves the feed straight away. The author sees that it was hidden and the reason you write."
        footer={
          <>
            <Button variant="ghost" onClick={() => setHideOpen(false)} disabled={busy === 'hide'}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() =>
                void run('hide', () => api.patch(`/api/posts/${postId}`, { action: 'hide', reason: text.trim() }), 'Post hidden', () =>
                  setHideOpen(false),
                )
              }
              loading={busy === 'hide'}
              disabled={text.trim().length < 12}
            >
              Hide post
            </Button>
          </>
        }
      >
        <Field
          htmlFor={`hide-${postId}`}
          label="Reason"
          required
          hint="Name the rule. “A sales pitch with no role or employer” beats “removed”."
          error={tooShort(12) ? 'A sentence of at least 12 characters.' : error ?? undefined}
        >
          <Textarea
            id={`hide-${postId}`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            maxLength={600}
            invalid={tooShort(12)}
            aria-describedby={describedBy(`hide-${postId}`, { hint: true, error: tooShort(12) })}
          />
        </Field>
      </Dialog>

      <ConfirmDialog
        open={removeOpen}
        onClose={() => setRemoveOpen(false)}
        onConfirm={() =>
          void run(
            'remove',
            () => api.del(`/api/posts/${postId}`) as ReturnType<typeof api.post>,
            'Post removed',
            () => setRemoveOpen(false),
          )
        }
        pending={busy === 'remove'}
        tone="danger"
        confirmLabel="Remove post"
        title="Remove this post?"
        body={<p>It disappears from the feed for everyone. This cannot be undone.</p>}
      />
    </>
  );
}
