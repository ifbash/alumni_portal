'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Info } from 'lucide-react';

import {
  Alert,
  Button,
  ButtonLink,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Checkbox,
  Field,
  FormActions,
  Input,
  Select,
  Switch,
  Textarea,
  describedBy,
  useToast,
} from '@/components/ui';
import { api, outcomeToast } from '@/lib/client/api';
import { SHOWCASE_CATEGORIES, SHOWCASE_KINDS } from '@/lib/community';
import type { ShowcaseCategory, ShowcaseKind } from '@/lib/data/types';

/**
 * Staff adding an entry to the showcase.
 *
 * The choice that matters is the first: is this about somebody on the
 * portal, or about somebody who is not? The form follows from it. For a
 * member it asks the curator to confirm they agreed to be featured (the
 * server will not save it without that); for anyone else it asks for the
 * link where it was already published. The two are mutually exclusive on
 * purpose, so the form never has a state with no basis for publishing.
 */

export interface MemberOption {
  id: string;
  name: string;
  line: string;
  batchYear: number | null;
  departmentCode: string | null;
}

interface Errors {
  kind?: string;
  category?: string;
  headline?: string;
  summary?: string;
  displayName?: string;
  memberId?: string;
  consentConfirmed?: string;
  sourceUrl?: string;
}

export function CurateForm({ members }: { members: MemberOption[] }) {
  const toast = useToast();
  const router = useRouter();

  const [basis, setBasis] = React.useState<'member' | 'public'>(members.length > 0 ? 'member' : 'public');
  const [kind, setKind] = React.useState<ShowcaseKind>('prominent');
  const [category, setCategory] = React.useState<ShowcaseCategory | ''>('');
  const [headline, setHeadline] = React.useState('');
  const [summary, setSummary] = React.useState('');
  const [story, setStory] = React.useState('');
  const [displayName, setDisplayName] = React.useState('');
  const [memberQuery, setMemberQuery] = React.useState('');
  const [consent, setConsent] = React.useState(false);
  const [sourceUrl, setSourceUrl] = React.useState('');
  const [featured, setFeatured] = React.useState(false);

  const [errors, setErrors] = React.useState<Errors>({});
  const [saving, setSaving] = React.useState(false);
  const [refusal, setRefusal] = React.useState<string | null>(null);
  const [done, setDone] = React.useState<{ note: string; persisted: boolean; href: string } | null>(null);

  const picked = members.find((m) => `${m.name} · ${m.line}` === memberQuery || m.name === memberQuery) ?? null;

  const validate = (): Errors => {
    const e: Errors = {};
    if (!category) e.category = 'Pick the closest category.';
    if (headline.trim().length < 10) e.headline = 'Say what it is in a line.';
    if (summary.trim().length < 30) e.summary = 'A sentence or two on what happened and why it matters.';
    if (basis === 'member') {
      if (!picked) e.memberId = 'Choose a member from the list.';
      if (!consent) e.consentConfirmed = 'Confirm they agreed to be featured before this can be saved.';
    } else {
      if (displayName.trim().length < 3) e.displayName = 'The name as it should read.';
      if (!/^https:\/\//i.test(sourceUrl.trim())) e.sourceUrl = 'Give the https link to where it was already published.';
    }
    return e;
  };

  const save = async (publish: boolean) => {
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) {
      toast.error('Some details need attention', 'The fields marked in red are stopping this from being saved.');
      return;
    }

    setSaving(true);
    setRefusal(null);
    const outcome = await api.post<{ note: string; href: string }>('/api/admin/showcase', {
      kind,
      category,
      headline: headline.trim(),
      summary: summary.trim(),
      story: story.trim() || undefined,
      displayName: basis === 'member' ? picked!.name : displayName.trim(),
      memberId: basis === 'member' ? picked!.id : undefined,
      consentConfirmed: basis === 'member' ? consent : false,
      sourceUrl: basis === 'public' ? sourceUrl.trim() : undefined,
      batchYear: basis === 'member' ? (picked!.batchYear ?? undefined) : undefined,
      departmentCode: basis === 'member' ? (picked!.departmentCode ?? undefined) : undefined,
      featured,
      publish,
    });
    setSaving(false);

    const t = outcomeToast(outcome, publish ? 'Entry published' : 'Entry saved');
    if (t) toast.show(t);

    if (outcome.status === 'ok') {
      setDone({ note: outcome.data.note, persisted: outcome.persisted, href: outcome.data.href });
      if (outcome.persisted) router.refresh();
      return;
    }
    if (outcome.status === 'invalid') {
      setErrors((cur) => ({ ...cur, ...(outcome.fieldErrors as Errors) }));
      if (!Object.keys(outcome.fieldErrors).length) setRefusal(outcome.message);
      return;
    }
    if (outcome.status === 'conflict') {
      setErrors((cur) => ({ ...cur, headline: outcome.message }));
      return;
    }
    setRefusal(outcome.message);
  };

  if (done) {
    return (
      <Card>
        <CardHeader>
          <CardTitle as="h2">{done.persisted ? 'Done' : 'Checked and ready'}</CardTitle>
        </CardHeader>
        <CardBody className="space-y-4">
          <p className="text-md">{done.note}</p>
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/admin/showcase" variant="secondary" className="min-h-11">
              Back to the showcase
            </ButtonLink>
            <Button variant="ghost" className="min-h-11" onClick={() => { setDone(null); setHeadline(''); setSummary(''); setStory(''); setConsent(false); setMemberQuery(''); setDisplayName(''); setSourceUrl(''); }}>
              Add another
            </Button>
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <form
      className="max-w-3xl space-y-6"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void save(false);
      }}
    >
      <Alert tone="neutral" icon={<Info className="size-4 text-brand-fg" />} title="Publishing about a person">
        <p>
          An entry is about a named person. For a member of the portal it needs their agreement, which you confirm below and which is
          recorded against your name. For somebody who is not on the portal it needs a link to where it was already public.
        </p>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle as="h2">Who it is about</CardTitle>
        </CardHeader>
        <CardBody className="space-y-5">
          <fieldset className="grid gap-2 sm:grid-cols-2">
            <legend className="sr-only">Whether the person is on the portal</legend>
            {(['member', 'public'] as const).map((b) => (
              <label
                key={b}
                htmlFor={`basis-${b}`}
                className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border p-3 ${basis === b ? 'border-[var(--button-primary-bg)] bg-brand-soft' : 'border-line bg-surface-raised'} ${b === 'member' && members.length === 0 ? 'cursor-not-allowed opacity-60' : ''}`}
              >
                <input
                  id={`basis-${b}`}
                  type="radio"
                  name="basis"
                  className="mt-1"
                  checked={basis === b}
                  disabled={b === 'member' && members.length === 0}
                  onChange={() => setBasis(b)}
                />
                <span className="min-w-0">
                  <span className="block font-medium text-primary">{b === 'member' ? 'A member of the portal' : 'Somebody not on the portal'}</span>
                  <span className="block text-sm text-secondary">{b === 'member' ? 'Needs their agreement.' : 'Needs a public source.'}</span>
                </span>
              </label>
            ))}
          </fieldset>

          {basis === 'member' ? (
            <>
              <Field htmlFor="cur-member" label="Member" required hint="Start typing a name." error={errors.memberId}>
                <Input
                  id="cur-member"
                  list="cur-members"
                  value={memberQuery}
                  onChange={(e) => setMemberQuery(e.target.value)}
                  autoComplete="off"
                  invalid={Boolean(errors.memberId)}
                  aria-describedby={describedBy('cur-member', { hint: true, error: Boolean(errors.memberId) })}
                />
                <datalist id="cur-members">
                  {members.map((m) => (
                    <option key={m.id} value={`${m.name} · ${m.line}`} />
                  ))}
                </datalist>
              </Field>
              <Checkbox
                id="cur-consent"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                label="They have agreed to be featured"
                hint="You have asked them, and they said yes. This is recorded with your name."
              />
              {errors.consentConfirmed ? <p role="alert" className="text-xs font-medium text-danger-fg">{errors.consentConfirmed}</p> : null}
            </>
          ) : (
            <>
              <Field htmlFor="cur-name" label="Name, as it should read" required error={errors.displayName}>
                <Input id="cur-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} invalid={Boolean(errors.displayName)} aria-describedby={describedBy('cur-name', { error: Boolean(errors.displayName) })} />
              </Field>
              <Field htmlFor="cur-source" label="Where it was published" required hint="An https link: a press article, an official announcement." error={errors.sourceUrl}>
                <Input id="cur-source" type="url" inputMode="url" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://" invalid={Boolean(errors.sourceUrl)} aria-describedby={describedBy('cur-source', { hint: true, error: Boolean(errors.sourceUrl) })} />
              </Field>
            </>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2">The entry</CardTitle>
        </CardHeader>
        <CardBody className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field htmlFor="cur-kind" label="Kind" required error={errors.kind}>
              <Select id="cur-kind" value={kind} onChange={(e) => setKind(e.target.value as ShowcaseKind)}>
                {SHOWCASE_KINDS.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field htmlFor="cur-category" label="Category" required error={errors.category}>
              <Select id="cur-category" value={category} onChange={(e) => setCategory(e.target.value as ShowcaseCategory | '')} invalid={Boolean(errors.category)} aria-describedby={describedBy('cur-category', { error: Boolean(errors.category) })}>
                <option value="">Choose</option>
                {SHOWCASE_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field htmlFor="cur-headline" label="Headline" required hint="One line: what it is." error={errors.headline}>
            <Input id="cur-headline" value={headline} onChange={(e) => setHeadline(e.target.value)} maxLength={140} invalid={Boolean(errors.headline)} aria-describedby={describedBy('cur-headline', { hint: true, error: Boolean(errors.headline) })} />
          </Field>

          <Field htmlFor="cur-summary" label="In a sentence or two" required error={errors.summary}>
            <Textarea id="cur-summary" value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} maxLength={400} invalid={Boolean(errors.summary)} aria-describedby={describedBy('cur-summary', { error: Boolean(errors.summary) })} />
          </Field>

          <Field htmlFor="cur-story" label="The longer story" hint="Optional.">
            <Textarea id="cur-story" value={story} onChange={(e) => setStory(e.target.value)} rows={6} maxLength={3000} />
          </Field>

          <Switch id="cur-featured" checked={featured} onChange={(e) => setFeatured(e.target.checked)} label="Feature it at the top" hint="Featured entries lead the page. Use it for two or three at a time." />
        </CardBody>
      </Card>

      {refusal ? (
        <Alert tone="danger" title="Nothing was saved">
          <p>{refusal}</p>
        </Alert>
      ) : null}

      <FormActions sticky>
        <ButtonLink href="/admin/showcase" variant="ghost">
          Cancel
        </ButtonLink>
        <Button type="button" variant="secondary" onClick={() => void save(false)} loading={saving}>
          Save, not published
        </Button>
        <Button type="button" onClick={() => void save(true)} loading={saving}>
          Publish
        </Button>
      </FormActions>
    </form>
  );
}
