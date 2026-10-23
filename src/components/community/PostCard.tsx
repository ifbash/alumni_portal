import * as React from 'react';
import Link from 'next/link';
import { EyeOff } from 'lucide-react';

import { Avatar, Badge, Card, CardBody } from '@/components/ui';
import { formatRelative, memberLine } from '@/lib/format';
import { postKindLabel } from '@/lib/community';
import type { LocaleSpec } from '@/lib/branding/pack';
import type { PostItem } from '@/lib/data/types';
import { Linkified } from './Linkified';
import { PostActions } from './PostActions';

/**
 * One post on the feed or in a group's noticeboard.
 *
 * The author is a `MemberSummary` already narrowed to the viewer's tier, so
 * a student reading the feed sees what the directory shows a student and no
 * more. A post never offers a way to contact its author: the profile link
 * goes to the directory, which applies the two-gate contact rule.
 */

const KIND_TONE = {
  update: 'outline',
  achievement: 'accent',
  question: 'brand',
  opportunity: 'neutral',
} as const;

export function PostCard({
  post,
  locale,
  viewerId,
  canModerate,
  directory,
  showGroup = true,
  tagHref,
}: {
  post: PostItem;
  locale: LocaleSpec;
  viewerId: string;
  canModerate: boolean;
  /** Whether the directory is on, so the author's name can link to a profile. */
  directory: boolean;
  /** Hide the group badge on a group's own noticeboard, where it says nothing new. */
  showGroup?: boolean;
  /** Where a tag leads. */
  tagHref: (tag: string) => string;
}) {
  const hidden = post.state === 'hidden';
  const isOwn = post.author.id === viewerId;
  const first = post.author.fullName.split(/\s+/)[0] ?? post.author.fullName;
  const byline = memberLine([
    post.author.designation,
    post.author.currentCompany,
    post.author.batchYear ? `Batch of ${post.author.batchYear}` : null,
  ]);

  return (
    <Card id={`post-${post.id}`} className={hidden ? 'border-dashed' : undefined}>
      <CardBody className="space-y-3">
        <header className="flex items-start gap-3">
          <Avatar name={post.author.fullName} src={post.author.photoUrl ?? undefined} size="md" />
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
              {directory ? (
                <Link href={`/directory/${post.author.slug}`} className="link-quiet font-semibold">
                  {post.author.fullName}
                </Link>
              ) : (
                <span className="font-semibold">{post.author.fullName}</span>
              )}
              <Badge tone={KIND_TONE[post.kind]}>{postKindLabel(post.kind)}</Badge>
              {showGroup && post.group ? (
                <Link href={`/groups/${post.group.slug}`} className="inline-flex">
                  <Badge tone="outline">{post.group.name}</Badge>
                </Link>
              ) : null}
            </p>
            {byline ? <p className="truncate text-sm text-secondary">{byline}</p> : null}
            <p className="text-xs text-secondary">
              <time dateTime={post.createdAt}>{formatRelative(post.createdAt, { locale: locale.locale, timeZone: locale.timeZone })}</time>
            </p>
          </div>
        </header>

        {hidden ? (
          <div className="flex items-start gap-2 rounded-lg bg-surface-sunken px-3 py-2 text-sm text-secondary" role="note">
            <EyeOff className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
            <p>
              <span className="font-medium text-primary">Hidden by a moderator.</span>{' '}
              {post.moderation?.hiddenReason ?? 'Only moderators and its author can see it.'}
            </p>
          </div>
        ) : null}

        <Linkified text={post.body} className="text-md leading-relaxed text-primary whitespace-pre-line break-words" />

        {post.tags.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5" aria-label="Tags">
            {post.tags.map((t) => (
              <li key={t}>
                <Link href={tagHref(t)} className="inline-flex min-h-8 items-center rounded-full bg-surface-sunken px-2.5 text-xs text-secondary hover:text-primary">
                  #{t}
                </Link>
              </li>
            ))}
          </ul>
        ) : null}

        {canModerate && post.moderation && post.moderation.reportCount > 0 ? (
          <div className="space-y-2">
            <p>
              <Badge tone="warning">
                {post.moderation.reportCount} {post.moderation.reportCount === 1 ? 'report' : 'reports'}
              </Badge>
            </p>
            <ul className="space-y-1 border-l-2 border-line pl-3 text-sm text-secondary" aria-label="What reporters said">
              {post.moderation.reportReasons.map((reason, i) => (
                <li key={i}>“{reason}”</li>
              ))}
            </ul>
          </div>
        ) : null}

        <PostActions
          postId={post.id}
          likeCount={post.likeCount}
          viewerLiked={post.viewerLiked}
          isOwn={isOwn}
          canModerate={canModerate}
          hidden={hidden}
          authorFirstName={first}
        />
      </CardBody>
    </Card>
  );
}
