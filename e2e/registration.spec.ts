import { expect, test } from '@playwright/test';

/**
 * Alumni registration (`/claim`), driven through the real page.
 *
 * Nothing here submits the form. `/api/auth/claim` allows ten
 * registrations per network per hour, and a local dev server puts every
 * caller in one bucket — a spec that posted would spend the budget the
 * person running it needs for their own manual checks. Everything below
 * is decided before the POST: the year a forwarded batch link preselects,
 * the roll-number help a footer link opens, where the final-year note
 * sits, and the words the page uses.
 */

test.describe('registration', () => {
  test('a batch link preselects its year and says so', async ({ page }) => {
    await page.goto('/claim?year=2016');

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Alumni registration');
    await expect(page.getByText('Batch of 2016', { exact: true })).toBeVisible();
    await expect(page).toHaveTitle(/Batch of 2016/);
    await expect(
      page.locator('#yearOfPassing'),
      'A link from a batch chip (/claim?year=2016) did not preselect the year. Every chip on the landing ' +
        'page, and every link forwarded round a batch group, now opens a form that asks again.',
    ).toHaveValue('2016');
  });

  test('a year that is not a register year is ignored silently', async ({ page }) => {
    await page.goto('/claim?year=abcd');

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Alumni registration');
    await expect(page.locator('#yearOfPassing')).toHaveValue('');
    await expect(page).not.toHaveTitle(/Batch of/);
  });

  test('#roll-number-help opens the roll-number help', async ({ page }) => {
    await page.goto('/claim#roll-number-help');

    await expect(
      page.locator('details#roll-number-help'),
      'The footer and landing links to /claim#roll-number-help land on a closed disclosure. The person ' +
        'who clicked "Find your roll number" sees a form, not the answer.',
    ).toHaveAttribute('open', '');
  });

  test('the page never says "claim"', async ({ page }) => {
    await page.goto('/claim');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Alumni registration');

    const text = await page.locator('body').innerText();
    expect(text).not.toContain('Claim your');
    expect(text).not.toContain('claim a profile');

    // The registration content itself, without the shared auth frame around it.
    const content = await page.locator('main').innerText();
    expect(content.toLowerCase(), 'The path stays /claim, but the word never reaches the page.').not.toMatch(/\bclaim/);
  });

  test('the final-year note comes before the first field', async ({ page }) => {
    await page.goto('/claim');
    await expect(page.locator('#rollNumber')).toBeVisible();

    const noteFirst = await page.evaluate(() => {
      const note = Array.from(document.querySelectorAll('[role="status"], [role="alert"]')).find((el) =>
        el.textContent?.includes('Final-year student?'),
      );
      const roll = document.getElementById('rollNumber');
      if (!note || !roll) return null;
      return Boolean(note.compareDocumentPosition(roll) & Node.DOCUMENT_POSITION_FOLLOWING);
    });
    expect(
      noteFirst,
      'Final-year students do not register — the placement cell invites them. The note telling them so ' +
        'has to come before the roll-number field, or they fill in the form first.',
    ).toBe(true);
  });

  test('"My year is not listed" explains itself and never posts', async ({ page }) => {
    await page.goto('/claim');
    await expect(page.locator('#yearOfPassing')).toBeVisible();

    let posted = false;
    page.on('request', (req) => {
      if (req.method() === 'POST' && req.url().includes('/api/auth/claim')) posted = true;
    });

    // Fill everything else validly, so the year is the only thing that can stop the POST.
    await page.locator('#rollNumber').fill('ABC123456');
    await page.locator('#fullName').fill('Venkata Sai Krishna');
    await page.locator('#departmentCode').selectOption({ index: 1 });
    await page.locator('#yearOfPassing').selectOption('unlisted');
    await expect(page.getByText('Your year is not on the register yet')).toBeVisible();

    await page.locator('#email').fill('someone@example.com');
    await page.locator('#consent').check();
    await page.getByRole('button', { name: 'Submit registration' }).click();

    await expect(page.getByText('The register does not include that year yet.')).toBeVisible();
    await expect(page.locator('#yearOfPassing')).toBeFocused();
    expect(posted, 'An unlisted year reached /api/auth/claim, which can only answer it with a refusal.').toBe(false);
  });

  test('an empty submit lists every missing detail and keeps what was typed', async ({ page }) => {
    await page.goto('/claim');
    await expect(page.locator('#rollNumber')).toBeVisible();

    await page.locator('#fullName').fill('Venkata Sai Krishna');
    await page.getByRole('button', { name: 'Submit registration' }).click();

    await expect(page.getByText('Check 5 details')).toBeVisible();
    await expect(page.locator('#rollNumber')).toBeFocused();
    await expect(page.getByText('Enter your roll number. It is on your degree certificate and marks memos.')).toBeVisible();
    await expect(page.locator('#fullName')).toHaveValue('Venkata Sai Krishna');
  });
});
