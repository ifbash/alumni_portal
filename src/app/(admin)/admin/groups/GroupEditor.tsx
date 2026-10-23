'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import {
  Alert,
  Button,
  ButtonLink,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  Field,
  FormActions,
  Input,
  Radio,
  Select,
  Textarea,
  describedBy,
  useToast,
} from '@/components/ui';
import { api, outcomeToast } from '@/lib/client/api';
import { SLUG_PATTERN, slugify } from '@/lib/community';
import type { GroupJoinPolicy, GroupKind } from '@/lib/data/types';

/**
 * Create a group or change one.
 *
 * The address and the kind are chosen once, because links to a group are
 * forwarded and a chapter that becomes an interest group is a different
 * group. Everything else can change. Archiving hides the group from members
 * and keeps its history; it is a confirmation away, not a form field.
 */

export interface EditableGroup {
  slug: string;
  name: string;
  kind: GroupKind;
  description: string;
  city: string;
  country: string;
  joinPolicy: GroupJoinPolicy;
  archived: boolean;
}

interface Errors {
  name?: string;
  slug?: string;
  description?: string;
  city?: string;
  country?: string;
}

export function GroupEditor({
  mode,
  initial,
  takenSlugs,
}: {
  mode: 'create' | 'edit';
  initial?: EditableGroup;
  takenSlugs: string[];
}) {
  const toast = useToast();
  const router = useRouter();

  const [name, setName] = React.useState(initial?.name ?? '');
  const [slug, setSlug] = React.useState(initial?.slug ?? '');
  const [slugEdited, setSlugEdited] = React.useState(mode === 'edit');
  const [kind, setKind] = React.useState<GroupKind>(initial?.kind ?? 'interest');
  const [description, setDescription] = React.useState(initial?.description ?? '');
  const [city, setCity] = React.useState(initial?.city ?? '');
  const [country, setCountry] = React.useState(initial?.country ?? '');
  const [joinPolicy, setJoinPolicy] = React.useState<GroupJoinPolicy>(initial?.joinPolicy ?? 'open');

  const [errors, setErrors] = React.useState<Errors>({});
  const [saving, setSaving] = React.useState(false);
  const [refusal, setRefusal] = React.useState<string | null>(null);
  const [confirmArchive, setConfirmArchive] = React.useState(false);

  const effectiveSlug = slugEdited ? slug.trim() : slugify(name, 80, '');
  const taken = mode === 'create' && takenSlugs.includes(effectiveSlug);

  const validate = (): Errors => {
    const e: Errors = {};
    if (name.trim().length < 3) e.name = 'Give the group a name members will recognise.';
    if (mode === 'create') {
      if (!effectiveSlug) e.slug = 'An address is required. It is normally taken from the name.';
      else if (!SLUG_PATTERN.test(effectiveSlug)) e.slug = 'Lowercase letters, numbers and single hyphens only.';
      else if (taken) e.slug = 'A group already uses this address. Add a word to tell them apart.';
    }
    if (description.trim().length < 20) e.description = 'Say what the group is for in a sentence or two.';
    if (mode === 'create' && kind === 'chapter' && !city.trim() && !country.trim()) e.city = 'A chapter is for a place. Give a city, a country, or both.';
    if (country.trim() && !/^[A-Za-z]{2}$/.test(country.trim())) e.country = 'Two letters, for example IN or US.';
    return e;
  };

  const save = async (archived?: boolean) => {
    const found = archived === undefined ? validate() : {};
    setErrors(found);
    if (Object.keys(found).length > 0) {
      toast.error('Some details need attention', 'The fields marked in red are stopping this from being saved.');
      return;
    }

    setSaving(true);
    setRefusal(null);

    const outcome =
      mode === 'create'
        ? await api.post<{ href: string }>('/api/admin/groups', {
            name: name.trim(),
            slug: effectiveSlug,
            kind,
            description: description.trim(),
            city: kind === 'chapter' && city.trim() ? city.trim() : undefined,
            country: kind === 'chapter' && country.trim() ? country.trim().toUpperCase() : undefined,
            joinPolicy,
          })
        : await api.patch<{ href?: string }>(
            `/api/admin/groups/${initial!.slug}`,
            archived === undefined
              ? { name: name.trim(), description: description.trim(), joinPolicy }
              : { archived },
          );

    setSaving(false);
    setConfirmArchive(false);

    const t = outcomeToast(
      outcome,
      mode === 'create' ? 'Group created' : archived === undefined ? 'Group saved' : archived ? 'Group archived' : 'Group restored',
    );
    if (t) toast.show(t);

    if (outcome.status === 'ok') {
      if (outcome.persisted) router.push(mode === 'create' ? '/admin/groups' : `/admin/groups/${initial!.slug}`);
      return;
    }
    if (outcome.status === 'invalid') {
      setErrors((cur) => ({ ...cur, ...outcome.fieldErrors }));
      if (!Object.keys(outcome.fieldErrors).length) setRefusal(outcome.message);
      return;
    }
    if (outcome.status === 'conflict') {
      setErrors((cur) => ({ ...cur, slug: outcome.message }));
      return;
    }
    setRefusal(outcome.message);
  };

  return (
    <>
      <form
        className="max-w-3xl space-y-6"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <Card>
          <CardHeader>
            <CardTitle as="h2">The group</CardTitle>
          </CardHeader>
          <CardBody className="space-y-5">
            <fieldset className="space-y-2" disabled={mode === 'edit'}>
              <legend className="text-sm font-medium text-primary">What kind of group</legend>
              <Radio
                id="grp-kind-chapter"
                name="kind"
                checked={kind === 'chapter'}
                onChange={() => setKind('chapter')}
                label="Chapter"
                hint="Alumni in one city or country. Closed to students."
              />
              <Radio
                id="grp-kind-interest"
                name="kind"
                checked={kind === 'interest'}
                onChange={() => setKind('interest')}
                label="Interest group"
                hint="People who share a field or a cause. Open to students."
              />
              {mode === 'edit' ? <p className="text-xs text-secondary">The kind is fixed once a group exists.</p> : null}
            </fieldset>

            <Field htmlFor="grp-name" label="Name" required error={errors.name}>
              <Input
                id="grp-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                placeholder={kind === 'chapter' ? 'e.g. Pune chapter' : 'e.g. Embedded systems and IoT'}
                invalid={Boolean(errors.name)}
                aria-describedby={describedBy('grp-name', { error: Boolean(errors.name) })}
              />
            </Field>

            <Field
              htmlFor="grp-slug"
              label="Address"
              required={mode === 'create'}
              hint={mode === 'create' ? 'Taken from the name until you change it. It cannot change afterwards.' : 'Fixed.'}
              error={errors.slug ?? (taken ? 'A group already uses this address.' : undefined)}
            >
              <div className="flex items-center gap-2">
                <span className="shrink-0 text-sm text-secondary">/groups/</span>
                <Input
                  id="grp-slug"
                  value={effectiveSlug}
                  readOnly={mode === 'edit'}
                  onChange={(e) => {
                    setSlugEdited(true);
                    setSlug(e.target.value);
                  }}
                  spellCheck={false}
                  invalid={Boolean(errors.slug) || taken}
                  aria-describedby={describedBy('grp-slug', { hint: true, error: Boolean(errors.slug) || taken })}
                />
              </div>
            </Field>

            <Field htmlFor="grp-desc" label="What it is for" required hint="Shown on the group’s card. A sentence or two." error={errors.description}>
              <Textarea
                id="grp-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                maxLength={600}
                invalid={Boolean(errors.description)}
                aria-describedby={describedBy('grp-desc', { hint: true, error: Boolean(errors.description) })}
              />
            </Field>

            {kind === 'chapter' && mode === 'create' ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field htmlFor="grp-city" label="City" hint="Leave blank for a whole country." error={errors.city}>
                  <Input id="grp-city" value={city} onChange={(e) => setCity(e.target.value)} invalid={Boolean(errors.city)} aria-describedby={describedBy('grp-city', { hint: true, error: Boolean(errors.city) })} />
                </Field>
                <Field htmlFor="grp-country" label="Country code" hint="Two letters: IN, US, GB." error={errors.country}>
                  <Input
                    id="grp-country"
                    value={country}
                    onChange={(e) => setCountry(e.target.value.toUpperCase())}
                    maxLength={2}
                    invalid={Boolean(errors.country)}
                    aria-describedby={describedBy('grp-country', { hint: true, error: Boolean(errors.country) })}
                  />
                </Field>
              </div>
            ) : null}

            <Field htmlFor="grp-policy" label="Who can join">
              <Select id="grp-policy" value={joinPolicy} onChange={(e) => setJoinPolicy(e.target.value as GroupJoinPolicy)}>
                <option value="open">Anyone eligible, straight away</option>
                <option value="approval">By request, approved by a lead</option>
              </Select>
            </Field>
          </CardBody>
        </Card>

        {refusal ? (
          <Alert tone="danger" title="Nothing was saved">
            <p>{refusal}</p>
          </Alert>
        ) : null}

        <FormActions sticky>
          <ButtonLink href="/admin/groups" variant="ghost">
            Cancel
          </ButtonLink>
          {mode === 'edit' ? (
            <Button type="button" variant="secondary" onClick={() => (initial!.archived ? void save(false) : setConfirmArchive(true))} disabled={saving}>
              {initial!.archived ? 'Restore group' : 'Archive group'}
            </Button>
          ) : null}
          <Button type="submit" loading={saving}>
            {mode === 'create' ? 'Create group' : 'Save changes'}
          </Button>
        </FormActions>
      </form>

      <ConfirmDialog
        open={confirmArchive}
        onClose={() => setConfirmArchive(false)}
        onConfirm={() => void save(true)}
        pending={saving}
        tone="danger"
        confirmLabel="Archive group"
        title={`Archive ${initial?.name ?? 'this group'}?`}
        body={<p>Members stop seeing it, and its noticeboard closes. Its history is kept, and you can restore it later.</p>}
      />
    </>
  );
}
