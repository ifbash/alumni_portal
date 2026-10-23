'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Info } from 'lucide-react';

import { Alert, Button, ButtonLink, Card, CardBody, CardHeader, CardTitle, Field, FormActions, Input, Select, Textarea, describedBy, useToast } from '@/components/ui';
import { api, outcomeToast } from '@/lib/client/api';
import { SHOWCASE_CATEGORIES } from '@/lib/community';
import type { ShowcaseCategory } from '@/lib/data/types';

/**
 * A member puts their own achievement forward.
 *
 * About themselves only, which the page says before the form does: the
 * route records the signed-in member and takes no name, so there is nothing
 * to type that could be somebody else. Sending it is their agreement to be
 * featured, and the page says that too, because it is the sentence a careful
 * person looks for before pressing the button.
 */

interface Errors {
  category?: string;
  headline?: string;
  summary?: string;
  story?: string;
  achievedOn?: string;
}

export function ShowcaseSubmitForm({ officeName }: { officeName: string }) {
  const toast = useToast();
  const router = useRouter();

  const [category, setCategory] = React.useState<ShowcaseCategory | ''>('');
  const [headline, setHeadline] = React.useState('');
  const [summary, setSummary] = React.useState('');
  const [story, setStory] = React.useState('');
  const [achievedOn, setAchievedOn] = React.useState('');

  const [errors, setErrors] = React.useState<Errors>({});
  const [saving, setSaving] = React.useState(false);
  const [refusal, setRefusal] = React.useState<string | null>(null);
  const [sent, setSent] = React.useState<{ note: string; persisted: boolean } | null>(null);

  const validate = (): Errors => {
    const e: Errors = {};
    if (!category) e.category = 'Pick the closest category.';
    if (headline.trim().length < 10) e.headline = 'Say what it is in a line, for example “Best paper award at an IEEE conference”.';
    if (summary.trim().length < 30) e.summary = 'A sentence or two on what happened and why it matters.';
    if (achievedOn && !/^\d{4}-\d{2}-\d{2}$/.test(achievedOn)) e.achievedOn = 'Use the date it happened.';
    return e;
  };

  const submit = async () => {
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) {
      toast.error('Some details need attention', 'The fields marked in red are stopping this from being sent.');
      return;
    }

    setSaving(true);
    setRefusal(null);
    const outcome = await api.post<{ note: string }>('/api/showcase', {
      category,
      headline: headline.trim(),
      summary: summary.trim(),
      story: story.trim() || undefined,
      achievedOn: achievedOn || undefined,
    });
    setSaving(false);

    const t = outcomeToast(outcome, 'Sent to the alumni cell');
    if (t) toast.show(t);

    if (outcome.status === 'ok') {
      setSent({ note: outcome.data.note, persisted: outcome.persisted });
      window.scrollTo({ top: 0, behavior: 'smooth' });
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

  if (sent) {
    return (
      <Card>
        <CardHeader>
          <CardTitle as="h2">{sent.persisted ? 'Sent to the ' + officeName : 'Checked and ready to send'}</CardTitle>
        </CardHeader>
        <CardBody className="space-y-4">
          <p className="text-md">{sent.note}</p>
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/showcase?view=mine" variant="secondary" className="min-h-11">
              Your submissions
            </ButtonLink>
            <ButtonLink href="/showcase" variant="ghost" className="min-h-11">
              Back to the showcase
            </ButtonLink>
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
        void submit();
      }}
    >
      <Alert tone="neutral" icon={<Info className="size-4 text-brand-fg" />} title="Before you send it">
        <ul className="list-disc space-y-1 pl-5">
          <li>This is about you. Sending it is your agreement to be featured, with your name and the details below.</li>
          <li>The {officeName} reads it before it appears, and tells you what is missing if it cannot publish it.</li>
          <li>You can ask for it to come down at any time, and it comes down without you needing to say why.</li>
        </ul>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle as="h2">What happened</CardTitle>
        </CardHeader>
        <CardBody className="space-y-5">
          <Field htmlFor="sc-category" label="Category" required error={errors.category}>
            <Select id="sc-category" value={category} onChange={(e) => setCategory(e.target.value as ShowcaseCategory | '')} invalid={Boolean(errors.category)} aria-describedby={describedBy('sc-category', { error: Boolean(errors.category) })}>
              <option value="">Choose</option>
              {SHOWCASE_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field htmlFor="sc-headline" label="Headline" required hint="One line: what it is." error={errors.headline}>
            <Input id="sc-headline" value={headline} onChange={(e) => setHeadline(e.target.value)} maxLength={140} invalid={Boolean(errors.headline)} aria-describedby={describedBy('sc-headline', { hint: true, error: Boolean(errors.headline) })} />
          </Field>

          <Field htmlFor="sc-summary" label="In a sentence or two" required hint="What happened and why it matters. No claims you could not point to." error={errors.summary}>
            <Textarea id="sc-summary" value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} maxLength={400} invalid={Boolean(errors.summary)} aria-describedby={describedBy('sc-summary', { hint: true, error: Boolean(errors.summary) })} />
          </Field>

          <Field htmlFor="sc-story" label="The longer story" hint="Optional. How it came about, in your own words." error={errors.story}>
            <Textarea id="sc-story" value={story} onChange={(e) => setStory(e.target.value)} rows={6} maxLength={3000} aria-describedby={describedBy('sc-story', { hint: true, error: Boolean(errors.story) })} />
          </Field>

          <Field htmlFor="sc-date" label="When" hint="Optional. The date it happened." error={errors.achievedOn} className="max-w-xs">
            <Input id="sc-date" type="date" value={achievedOn} onChange={(e) => setAchievedOn(e.target.value)} invalid={Boolean(errors.achievedOn)} aria-describedby={describedBy('sc-date', { hint: true, error: Boolean(errors.achievedOn) })} />
          </Field>
        </CardBody>
      </Card>

      {refusal ? (
        <Alert tone="danger" title="Nothing was sent">
          <p>{refusal}</p>
        </Alert>
      ) : null}

      <FormActions sticky>
        <ButtonLink href="/showcase" variant="ghost">
          Cancel
        </ButtonLink>
        <Button type="submit" loading={saving}>
          Send for review
        </Button>
      </FormActions>
    </form>
  );
}
