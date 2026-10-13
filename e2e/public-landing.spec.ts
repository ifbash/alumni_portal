import { expect, test } from '@playwright/test';

/**
 * The public landing page and its chrome.
 *
 * Two kinds of promise, both easy to break without noticing:
 *
 *  1. **The first phone screen.** A DIET graduate arrives from a WhatsApp
 *     forward on a 390px phone. The college's full name, one h1, and both
 *     doors (Register, Sign in) must be above the fold, and the page must
 *     not sprawl. A new section or a type-scale change that pushes Register
 *     below y = 664 fails here, not in a screenshot review a week later.
 *
 *  2. **Nothing counted from member rows reaches a public page.** The old
 *     landing page printed registration counts and event capacity on the
 *     open internet. The guard is on the HTML itself — including the RSC
 *     payload embedded in it — because a count passed to a component can
 *     leak there without ever being rendered.
 *
 * Runs against `next dev`; the default host resolves to DIET. The second
 * college is selected by Host header, as in `tenant-isolation.spec.ts`.
 */

const PHONE = { width: 390, height: 844 };
/** The bottom of the first phone screen, less the browser's own chrome. */
const FOLD = 664;
const INSTITUTION = 'Dhanekula Institute of Engineering & Technology';

/**
 * A request aimed at the dev server with the tenant in the Host header.
 *
 * Browsers resolve `*.localhost` to loopback; Node does not
 * (`getaddrinfo ENOTFOUND diet.localhost`). So a request against a
 * `http://diet.localhost:3000` base goes to 127.0.0.1 on the same port,
 * carrying the host it was meant for — which is all tenant resolution
 * reads. Any other base URL is used as it is.
 */
function direct(
  baseURL: string | undefined,
  path: string,
  host?: string,
): { url: string; headers: Record<string, string> } {
  const u = new URL(baseURL ?? 'http://localhost:3300');
  const loopback = u.hostname === 'localhost' || u.hostname.endsWith('.localhost');
  return {
    url: loopback ? `${u.protocol}//127.0.0.1:${u.port}${path}` : `${u.origin}${path}`,
    headers: { host: host ?? u.host },
  };
}

test.describe('public landing page', () => {
  test('the first phone screen carries the college, one h1 and both doors', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.goto('/', { waitUntil: 'networkidle' });

    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    expect(height, `the landing page is ${height}px tall at 390; the ceiling is 3,600`).toBeLessThanOrEqual(3600);

    await expect(page.locator('h1')).toHaveCount(1);

    const hero = page.locator('section[aria-labelledby="hero-title"]');
    for (const name of ['Register', 'Sign in']) {
      const link = hero.getByRole('link', { name, exact: true });
      await expect(link).toBeVisible();
      const box = await link.boundingBox();
      expect(box, `${name} has no box`).not.toBeNull();
      expect(box!.y + box!.height, `${name} ends below the fold`).toBeLessThanOrEqual(FOLD);
    }

    const name = hero.getByText(INSTITUTION, { exact: true });
    await expect(name).toBeVisible();
    const nameBox = await name.boundingBox();
    expect(nameBox!.y + nameBox!.height).toBeLessThanOrEqual(FOLD);
  });

  test('the HTML carries no member counts and no event capacity', async ({ request, baseURL }) => {
    const home = direct(baseURL, '/');
    const res = await request.get(home.url, { headers: home.headers, maxRedirects: 0 });
    expect(res.status()).toBe(200);
    const html = await res.text();

    expect(html).not.toMatch(/\b\d[\d,]*\s+(registered|claimed|joined)\b/i);
    expect(html).not.toContain('registeredCount');
    expect(html).not.toContain('"capacity"');
  });

  test('the About page states no register coverage and no unconfirmed college facts', async ({
    request,
    baseURL,
  }) => {
    const about = direct(baseURL, '/about');
    const res = await request.get(about.url, { headers: about.headers, maxRedirects: 0 });
    expect(res.status()).toBe(200);
    // Visible text only: the RSC payload carries component names that are not copy.
    const text = (await res.text()).replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ');

    // "620 records are still unclaimed" was registration coverage by subtraction.
    expect(text).not.toMatch(/unclaimed/i);
    expect(text).not.toMatch(/\b\d[\d,]*\s+records\b/i);
    // Year of establishment and sanctioned intake are still awaited from the college.
    expect(text).not.toMatch(/established \d{4}/i);
    expect(text).not.toMatch(/sanctioned intake/i);
  });

  test('no other college’s pages name DIET’s campus', async ({ request, baseURL }) => {
    for (const host of ['srivarsity.localhost', 'ifbash.localhost']) {
      const contact = direct(baseURL, '/contact', host);
      const res = await request.get(contact.url, { headers: contact.headers, maxRedirects: 0 });
      expect(res.status()).toBe(200);
      expect(await res.text(), `${host}/contact`).not.toContain('Ganguru');
    }
  });

  test('a photo hero keeps both doors above the fold on a phone', async ({ page, baseURL }) => {
    // Tamarind Grove is the demo pack with a hero photograph: on phones it is a
    // strip above the band, and the doors must still clear the fold.
    const port = new URL(baseURL ?? 'http://localhost:3300').port;
    await page.setViewportSize(PHONE);
    await page.goto(`http://srivarsity.localhost:${port}/`, { waitUntil: 'networkidle' });

    const hero = page.locator('section[aria-labelledby="hero-title"]');
    for (const name of ['Register', 'Sign in']) {
      const box = await hero.getByRole('link', { name, exact: true }).boundingBox();
      expect(box, `${name} has no box`).not.toBeNull();
      expect(box!.y + box!.height, `${name} ends below the fold`).toBeLessThanOrEqual(FOLD);
    }
  });

  test('the footer links to the public events page, never the session-only one', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const footer = page.locator('footer');
    await expect(footer).toBeVisible();
    // None at all, rendered or hidden: the session-only list is never linked.
    await expect(footer.locator('a[href="/events"]')).toHaveCount(0);
    // Exactly one on screen. The footer renders its groups twice — phone
    // disclosures and desktop columns — with the other copy display:none.
    await expect(footer.locator('a[href="/campus-events"]:visible')).toHaveCount(1);
  });

  test('a college without a public landing page gets no links into one', async ({ request, baseURL }) => {
    const aboutReq = direct(baseURL, '/about', 'northgate.localhost');
    const about = await request.get(aboutReq.url, { headers: aboutReq.headers, maxRedirects: 0 });
    expect(about.status()).toBe(200);
    const html = await about.text();
    // The control: this really is Northgate, not DIET answering for it.
    expect(html).toContain('Northgate');
    expect(html).not.toContain('href="/#get-involved"');
    expect(html).not.toContain('href="/campus-events"');

    // `/` still redirects. The marketing group has a loading boundary, so the
    // shell may already be streaming when the page calls redirect(): Next then
    // answers 200 with a refresh to /login instead of a 307. Either is a
    // redirect; what must never come back is the landing page itself.
    const homeReq = direct(baseURL, '/', 'northgate.localhost');
    const home = await request.get(homeReq.url, { headers: homeReq.headers, maxRedirects: 0 });
    if (home.status() === 200) {
      const body = await home.text();
      expect(body).toMatch(/http-equiv="refresh" content="\d+;url=\/login"/);
      expect(body).not.toContain('id="hero-title"');
    } else {
      expect([307, 308]).toContain(home.status());
      expect(home.headers()['location'] ?? '').toMatch(/\/login(\?|$)/);
    }
  });

  test('and in a browser, that college’s front door is the sign-in page', async ({ page, baseURL }) => {
    const port = new URL(baseURL ?? 'http://localhost:3300').port;
    await page.goto(`http://northgate.localhost:${port}/`);
    await page.waitForURL(/\/login(\?|$)/);
  });

  test('the phone menu opens from the keyboard and closes the ways a menu should', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.goto('/', { waitUntil: 'networkidle' });

    const menu = page.locator('header details');
    const summary = menu.locator('summary');
    const isOpen = () => menu.evaluate((d) => (d as HTMLDetailsElement).open);

    // Enter opens it; Escape closes it and hands focus back to the button.
    await summary.focus();
    await page.keyboard.press('Enter');
    await expect.poll(isOpen).toBe(true);
    await page.keyboard.press('Escape');
    await expect.poll(isOpen).toBe(false);
    await expect(summary).toBeFocused();

    // Space opens it too.
    await page.keyboard.press('Space');
    await expect.poll(isOpen).toBe(true);

    // A tap outside closes it.
    await page.mouse.click(200, 700);
    await expect.poll(isOpen).toBe(false);

    // A link inside closes it — including a hash link that keeps the pathname.
    await summary.click();
    await expect.poll(isOpen).toBe(true);
    await menu.getByRole('link', { name: 'Get involved' }).click();
    await expect.poll(isOpen).toBe(false);

    // Navigating away closes it.
    await summary.click();
    await expect.poll(isOpen).toBe(true);
    await menu.getByRole('link', { name: 'About the portal' }).click();
    await page.waitForURL('**/about');
    await expect.poll(isOpen).toBe(false);
  });
});
