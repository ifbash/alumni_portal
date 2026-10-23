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
import { BUSINESS_INDUSTRIES, SLUG_PATTERN, slugify } from '@/lib/community';
import { BUSINESS_PHONE } from '@/lib/schemas/businesses';

/**
 * List a business, or fix one that came back.
 *
 * The page says what happens before the form does: a listing is reviewed,
 * contact details appear only if the owner chooses and only to alumni, and
 * an edit to a live listing sends it back for review. Those are the three
 * questions an owner has, and they should not have to find out by pressing
 * the button.
 */

export interface EditableBusiness {
  slug: string;
  name: string;
  industry: string;
  description: string;
  city: string;
  region: string;
  country: string;
  website: string;
  products: string;
  services: string;
  showContact: boolean;
  contactEmail: string;
  contactPhone: string;
  live: boolean;
}

interface Errors {
  name?: string;
  slug?: string;
  industry?: string;
  description?: string;
  country?: string;
  website?: string;
  products?: string;
  services?: string;
  showContact?: string;
  contactEmail?: string;
  contactPhone?: string;
}

/** "a, b\nc" → ["a", "b", "c"], trimmed, de-duplicated, at most eight. */
function toList(text: string): string[] {
  const out: string[] = [];
  for (const part of text.split(/[,\n]/)) {
    const v = part.trim();
    if (v && !out.some((o) => o.toLowerCase() === v.toLowerCase())) out.push(v);
  }
  return out.slice(0, 8);
}

export function BusinessForm({
  mode,
  initial,
  takenSlugs,
}: {
  mode: 'create' | 'resubmit';
  initial?: EditableBusiness;
  takenSlugs: string[];
}) {
  const toast = useToast();
  const router = useRouter();

  const [name, setName] = React.useState(initial?.name ?? '');
  const [slug, setSlug] = React.useState(initial?.slug ?? '');
  const [slugEdited, setSlugEdited] = React.useState(mode === 'resubmit');
  const [industry, setIndustry] = React.useState(initial?.industry ?? '');
  const [description, setDescription] = React.useState(initial?.description ?? '');
  const [city, setCity] = React.useState(initial?.city ?? '');
  const [region, setRegion] = React.useState(initial?.region ?? '');
  const [country, setCountry] = React.useState(initial?.country ?? 'IN');
  const [website, setWebsite] = React.useState(initial?.website ?? '');
  const [products, setProducts] = React.useState(initial?.products ?? '');
  const [services, setServices] = React.useState(initial?.services ?? '');
  const [showContact, setShowContact] = React.useState(initial?.showContact ?? false);
  const [contactEmail, setContactEmail] = React.useState(initial?.contactEmail ?? '');
  const [contactPhone, setContactPhone] = React.useState(initial?.contactPhone ?? '');

  const [errors, setErrors] = React.useState<Errors>({});
  const [saving, setSaving] = React.useState(false);
  const [refusal, setRefusal] = React.useState<string | null>(null);
  const [sent, setSent] = React.useState<{ note: string; persisted: boolean } | null>(null);

  const effectiveSlug = slugEdited ? slug.trim() : slugify(name, 80, '');
  const taken = mode === 'create' && takenSlugs.includes(effectiveSlug);

  const validate = (): Errors => {
    const e: Errors = {};
    if (name.trim().length < 2) e.name = 'What is the business called?';
    if (mode === 'create') {
      if (!effectiveSlug) e.slug = 'An address is required. It is normally taken from the name.';
      else if (!SLUG_PATTERN.test(effectiveSlug)) e.slug = 'Lowercase letters, numbers and single hyphens only.';
      else if (taken) e.slug = 'A listing already uses this address. Add the city, or a word to tell them apart.';
    }
    if (!industry) e.industry = 'Pick the closest industry.';
    if (description.trim().length < 40) e.description = 'Say what the business does and who it is for, in a couple of sentences.';
    if (country.trim() && !/^[A-Za-z]{2}$/.test(country.trim())) e.country = 'Two letters, for example IN or AE.';
    if (website.trim() && !/^https:\/\//i.test(website.trim())) e.website = 'Use an https address, for example https://example.com.';
    if (showContact) {
      if (!contactEmail.trim() && !contactPhone.trim()) e.contactEmail = 'Add an email or a phone number, or turn sharing off.';
      if (contactEmail.trim() && !/^\S+@\S+\.\S+$/.test(contactEmail.trim())) e.contactEmail = 'That email address does not look right.';
      if (contactPhone.trim() && !BUSINESS_PHONE.test(contactPhone.trim())) e.contactPhone = 'A phone number, with the country code if it is outside India.';
    }
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

    const business = {
      name: name.trim(),
      industry,
      description: description.trim(),
      city: city.trim() || undefined,
      region: region.trim() || undefined,
      country: country.trim() ? country.trim().toUpperCase() : undefined,
      website: website.trim() || undefined,
      products: toList(products),
      services: toList(services),
      showContact,
      contactEmail: showContact && contactEmail.trim() ? contactEmail.trim() : undefined,
      contactPhone: showContact && contactPhone.trim() ? contactPhone.trim() : undefined,
    };

    const outcome =
      mode === 'create'
        ? await api.post<{ note: string }>('/api/businesses', { ...business, slug: effectiveSlug })
        : await api.patch<{ note: string }>(`/api/businesses/${initial!.slug}`, { action: 'resubmit', business });

    setSaving(false);

    const t = outcomeToast(outcome, 'Sent for review');
    if (t) toast.show(t);

    if (outcome.status === 'ok') {
      setSent({ note: outcome.data.note, persisted: outcome.persisted });
      window.scrollTo({ top: 0, behavior: 'smooth' });
      if (outcome.persisted) router.refresh();
      return;
    }
    if (outcome.status === 'invalid') {
      setErrors((cur) => ({ ...cur, ...flatten(outcome.fieldErrors) }));
      if (!Object.keys(outcome.fieldErrors).length) setRefusal(outcome.message);
      return;
    }
    if (outcome.status === 'conflict') {
      setErrors((cur) => ({ ...cur, slug: outcome.message }));
      return;
    }
    setRefusal(outcome.message);
  };

  if (sent) {
    return (
      <Card>
        <CardHeader>
          <CardTitle as="h2">{sent.persisted ? 'Sent for review' : 'Checked and ready to send'}</CardTitle>
        </CardHeader>
        <CardBody className="space-y-4">
          <p className="text-md">{sent.note}</p>
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/businesses?view=mine" variant="secondary" className="min-h-11">
              Your listings
            </ButtonLink>
            <ButtonLink href="/businesses" variant="ghost" className="min-h-11">
              Back to the directory
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
      <Alert tone="neutral" icon={<Info className="size-4 text-brand-fg" />} title="How listing works">
        <ul className="list-disc space-y-1 pl-5">
          <li>The alumni cell reviews every listing before it appears, and tells you what to change if it cannot.</li>
          <li>Your phone and email appear only if you choose to share them below, and only to alumni, never to students.</li>
          {mode === 'resubmit' && initial?.live ? <li>Changing a live listing takes it out of the directory until it is approved again.</li> : null}
        </ul>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle as="h2">The business</CardTitle>
        </CardHeader>
        <CardBody className="space-y-5">
          <Field htmlFor="biz-name" label="Name" required error={errors.name}>
            <Input id="biz-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} invalid={Boolean(errors.name)} aria-describedby={describedBy('biz-name', { error: Boolean(errors.name) })} />
          </Field>

          <Field
            htmlFor="biz-slug"
            label="Address"
            required={mode === 'create'}
            hint={mode === 'create' ? 'Taken from the name until you change it. It cannot change afterwards.' : 'Fixed.'}
            error={errors.slug ?? (taken ? 'A listing already uses this address.' : undefined)}
          >
            <div className="flex items-center gap-2">
              <span className="shrink-0 text-sm text-secondary">/businesses/</span>
              <Input
                id="biz-slug"
                value={effectiveSlug}
                readOnly={mode === 'resubmit'}
                onChange={(e) => {
                  setSlugEdited(true);
                  setSlug(e.target.value);
                }}
                spellCheck={false}
                invalid={Boolean(errors.slug) || taken}
                aria-describedby={describedBy('biz-slug', { hint: true, error: Boolean(errors.slug) || taken })}
              />
            </div>
          </Field>

          <Field htmlFor="biz-industry" label="Industry" required error={errors.industry}>
            <Select id="biz-industry" value={industry} onChange={(e) => setIndustry(e.target.value)} invalid={Boolean(errors.industry)} aria-describedby={describedBy('biz-industry', { error: Boolean(errors.industry) })}>
              <option value="">Choose</option>
              {BUSINESS_INDUSTRIES.map((i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            htmlFor="biz-desc"
            label="What it does"
            required
            hint="Who it is for and what you sell or do. No promises of returns."
            error={errors.description}
          >
            <Textarea
              id="biz-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              maxLength={1200}
              invalid={Boolean(errors.description)}
              aria-describedby={describedBy('biz-desc', { hint: true, error: Boolean(errors.description) })}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field htmlFor="biz-city" label="City">
              <Input id="biz-city" value={city} onChange={(e) => setCity(e.target.value)} />
            </Field>
            <Field htmlFor="biz-region" label="State or region">
              <Input id="biz-region" value={region} onChange={(e) => setRegion(e.target.value)} />
            </Field>
            <Field htmlFor="biz-country" label="Country code" error={errors.country}>
              <Input
                id="biz-country"
                value={country}
                onChange={(e) => setCountry(e.target.value.toUpperCase())}
                maxLength={2}
                invalid={Boolean(errors.country)}
                aria-describedby={describedBy('biz-country', { error: Boolean(errors.country) })}
              />
            </Field>
          </div>

          <Field htmlFor="biz-site" label="Website" hint="Optional. An https address." error={errors.website}>
            <Input id="biz-site" type="url" inputMode="url" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" invalid={Boolean(errors.website)} aria-describedby={describedBy('biz-site', { hint: true, error: Boolean(errors.website) })} />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2">What it offers</CardTitle>
        </CardHeader>
        <CardBody className="space-y-5">
          <Field htmlFor="biz-products" label="Products" hint="Separate with commas. Up to eight." error={errors.products}>
            <Textarea id="biz-products" value={products} onChange={(e) => setProducts(e.target.value)} rows={2} aria-describedby={describedBy('biz-products', { hint: true, error: Boolean(errors.products) })} />
          </Field>
          <Field htmlFor="biz-services" label="Services" hint="Separate with commas. Up to eight." error={errors.services}>
            <Textarea id="biz-services" value={services} onChange={(e) => setServices(e.target.value)} rows={2} aria-describedby={describedBy('biz-services', { hint: true, error: Boolean(errors.services) })} />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2">Contact</CardTitle>
        </CardHeader>
        <CardBody className="space-y-5">
          <Switch
            id="biz-share"
            checked={showContact}
            onChange={(e) => setShowContact(e.target.checked)}
            label="Show contact details to alumni"
            hint="Off by default. Students never see them, whatever you choose."
          />
          {errors.showContact ? <p role="alert" className="text-xs font-medium text-danger-fg">{errors.showContact}</p> : null}

          {showContact ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field htmlFor="biz-email" label="Email" error={errors.contactEmail}>
                <Input id="biz-email" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} invalid={Boolean(errors.contactEmail)} aria-describedby={describedBy('biz-email', { error: Boolean(errors.contactEmail) })} />
              </Field>
              <Field htmlFor="biz-phone" label="Phone" error={errors.contactPhone}>
                <Input id="biz-phone" inputMode="tel" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} invalid={Boolean(errors.contactPhone)} aria-describedby={describedBy('biz-phone', { error: Boolean(errors.contactPhone) })} />
              </Field>
            </div>
          ) : null}
        </CardBody>
      </Card>

      {refusal ? (
        <Alert tone="danger" title="Nothing was sent">
          <p>{refusal}</p>
        </Alert>
      ) : null}

      <FormActions sticky>
        <ButtonLink href="/businesses" variant="ghost">
          Cancel
        </ButtonLink>
        <Button type="submit" loading={saving}>
          {mode === 'create' ? 'Send for review' : 'Resubmit for review'}
        </Button>
      </FormActions>
    </form>
  );
}

/** The server names a few fields differently from the form. */
function flatten(fieldErrors: Record<string, string>): Errors {
  const out: Errors = {};
  for (const [key, message] of Object.entries(fieldErrors)) {
    const base = key.replace(/^business\./, '');
    if (base in EMPTY) (out as Record<string, string>)[base] = message;
  }
  return out;
}

const EMPTY: Record<keyof Errors, true> = {
  name: true,
  slug: true,
  industry: true,
  description: true,
  country: true,
  website: true,
  products: true,
  services: true,
  showContact: true,
  contactEmail: true,
  contactPhone: true,
};
