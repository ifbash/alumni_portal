'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { Alert, Button, Card, CardBody, Field, Input, Select, Textarea, describedBy, useToast } from '@/components/ui';
import { api, outcomeToast } from '@/lib/client/api';
import { POST_KINDS, POST_MAX_LENGTH, POST_MAX_TAGS, normaliseTags } from '@/lib/community';
import { POST_MAX_LINKS, countLinks } from '@/lib/schemas/feed';
import { cn } from '@/lib/cn';
import type { PostKind } from '@/lib/data/types';

/**
 * Write a post.
 *
 * Short on purpose: a kind, some words, and up to five tags. The kind is a
 * choice of four plain labels rather than a menu, because "what sort of
 * post is this" is the first thing a reader wants to know and the writer
 * should have to say. The limits shown here (length, links, tags) are the
 * server's own; a client that allowed more would be a round trip that
 * exists to fail.
 */

export function PostComposer({
  groups,
  fixedGroup = null,
  prompt,
}: {
  /** The groups the writer belongs to, for the "post in" choice. */
  groups: Array<{ slug: string; name: string }>;
  /** Set on a group's own noticeboard: posts go there, with no choice. */
  fixedGroup?: { slug: string; name: string } | null;
  prompt?: string;
}) {
  const toast = useToast();
  const router = useRouter();

  const [kind, setKind] = React.useState<PostKind>('update');
  const [body, setBody] = React.useState('');
  const [tagText, setTagText] = React.useState('');
  const [groupSlug, setGroupSlug] = React.useState(fixedGroup?.slug ?? '');
  const [saving, setSaving] = React.useState(false);
  const [errors, setErrors] = React.useState<{ body?: string; tags?: string; groupSlug?: string }>({});
  const [refusal, setRefusal] = React.useState<string | null>(null);

  const tags = normaliseTags(tagText);
  const links = countLinks(body);
  const remaining = POST_MAX_LENGTH - body.length;
  const kindMeta = POST_KINDS.find((k) => k.value === kind)!;

  const submit = async () => {
    const e: typeof errors = {};
    if (body.trim().length < 10) e.body = 'Say a little more, at least a sentence.';
    if (links > POST_MAX_LINKS) e.body = `At most ${POST_MAX_LINKS} links in a post.`;
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    setSaving(true);
    setRefusal(null);
    const outcome = await api.post('/api/posts', {
      kind,
      body: body.trim(),
      tags,
      groupSlug: (fixedGroup?.slug ?? groupSlug) || undefined,
    });
    setSaving(false);

    const t = outcomeToast(outcome, 'Posted');
    if (t) toast.show(t);

    if (outcome.status === 'ok') {
      setBody('');
      setTagText('');
      if (outcome.persisted) router.refresh();
      return;
    }
    if (outcome.status === 'invalid') {
      setErrors({
        body: outcome.fieldErrors.body,
        tags: outcome.fieldErrors.tags,
        groupSlug: outcome.fieldErrors.groupSlug,
      });
      if (!outcome.fieldErrors.body && !outcome.fieldErrors.tags && !outcome.fieldErrors.groupSlug) setRefusal(outcome.message);
      return;
    }
    setRefusal(outcome.message);
  };

  return (
    <Card>
      <CardBody className="space-y-4">
        <form
          className="space-y-4"
          noValidate
          onSubmit={(ev) => {
            ev.preventDefault();
            void submit();
          }}
        >
          <fieldset>
            <legend className="sr-only">What sort of post</legend>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="What sort of post">
              {POST_KINDS.map((k) => {
                const on = kind === k.value;
                return (
                  <label
                    key={k.value}
                    className={cn(
                      'inline-flex min-h-11 cursor-pointer items-center rounded-full border px-4 text-sm transition-colors duration-fast ease-brand',
                      'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--focus-ring)]',
                      on ? 'border-[var(--button-primary-bg)] bg-brand-soft text-brand-soft-fg' : 'border-line bg-surface-raised text-secondary hover:border-line-strong',
                    )}
                  >
                    <input type="radio" name="post-kind" className="sr-only" checked={on} onChange={() => setKind(k.value)} />
                    {k.label}
                  </label>
                );
              })}
            </div>
          </fieldset>

          <Field
            htmlFor="post-body"
            label={prompt ?? 'What would you like to share?'}
            hint={kindMeta.blurb}
            error={errors.body}
          >
            <Textarea
              id="post-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              maxLength={POST_MAX_LENGTH + 200}
              invalid={Boolean(errors.body)}
              aria-describedby={describedBy('post-body', { hint: true, error: Boolean(errors.body) })}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              htmlFor="post-tags"
              label="Tags"
              hint={tags.length ? `Will be saved as ${tags.map((t) => `#${t}`).join(' ')}` : `Optional, up to ${POST_MAX_TAGS}, separated by commas.`}
              error={errors.tags}
            >
              <Input
                id="post-tags"
                value={tagText}
                onChange={(e) => setTagText(e.target.value)}
                placeholder="hiring, hyderabad"
                autoComplete="off"
                invalid={Boolean(errors.tags)}
                aria-describedby={describedBy('post-tags', { hint: true, error: Boolean(errors.tags) })}
              />
            </Field>

            {fixedGroup ? (
              <p className="self-end pb-2 text-sm text-secondary">
                Posting to <span className="font-medium text-primary">{fixedGroup.name}</span>
              </p>
            ) : groups.length > 0 ? (
              <Field htmlFor="post-group" label="Post in" error={errors.groupSlug}>
                <Select
                  id="post-group"
                  value={groupSlug}
                  onChange={(e) => setGroupSlug(e.target.value)}
                  aria-describedby={describedBy('post-group', { error: Boolean(errors.groupSlug) })}
                >
                  <option value="">Everyone</option>
                  {groups.map((g) => (
                    <option key={g.slug} value={g.slug}>
                      {g.name} only
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}
          </div>

          {refusal ? (
            <Alert tone="danger" title="Nothing was posted">
              <p>{refusal}</p>
            </Alert>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className={cn('text-xs tabular', remaining < 0 ? 'font-medium text-danger-fg' : remaining < 100 ? 'text-warning-fg' : 'text-secondary')}>
              {remaining < 0 ? `${-remaining} over the limit` : `${remaining.toLocaleString('en-IN')} characters left`}
              {links > 0 ? ` · ${links} of ${POST_MAX_LINKS} links` : ''}
            </p>
            <Button type="submit" loading={saving} disabled={remaining < 0} className="min-h-11">
              Post
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
