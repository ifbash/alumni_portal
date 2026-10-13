# Builds sales/html/alumni-portal-deck.html on the ifBash deck engine. This file is the deck's source:
# edit the copy, the notes or the layout here, then run
#   python sales/html/tools/build-deck.py
#   node sales/html/tools/render-slides.cjs          (PNGs, to look at every changed slide)
# and rebuild the PowerPoint twin with sales/pptx-tools (see sales/README.md).
# Every slide is inline-styled static HTML, as the kit's "9 - Deck Template.dc.html" does.
import html
import os

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'alumni-portal-deck.html')

# ---- tokens (brand/tokens/ifbash-tokens.json) --------------------------------
PAPER, CARD, FIELD = '#FBF8F4', '#FFFFFF', '#22132A'
INK, INK70 = '#2A1830', '#54455C'
LINE, LINE_DARK = '#E8DED6', '#3A2842'
ROSE, ROSE_D = '#9E2A4B', '#E88AA3'
MINT, MINT_D = '#2E6A55', '#7FC4A8'
PEACH, CLAY, SILVER = '#F2865A', '#C2856A', '#A9B0B8'

DISPLAY = "font-family:'Bricolage Grotesque','Aptos Display','Helvetica Neue',Arial,sans-serif;font-weight:700"
TEXT = "font-family:'Hanken Grotesk','Aptos','Helvetica Neue',Arial,sans-serif"
MONO = "font-family:'IBM Plex Mono',Consolas,ui-monospace,monospace"

PAD = 'padding:88px 120px'


def esc(s):
    return html.escape(s, quote=True)


def notes(*paras):
    return '\n\n'.join(p.strip() for p in paras)


# ---- small parts ------------------------------------------------------------
def eyebrow(text, dark=False, size=24):
    c = ROSE_D if dark else ROSE
    return f'<div style="{MONO};font-size:{size}px;letter-spacing:.2em;text-transform:uppercase;color:{c}">{text}</div>'


def headline(text, size=64, dark=False, maxw=None, lh=1.05):
    c = PAPER if dark else INK
    mw = f'max-width:{maxw};' if maxw else ''
    track = '-.042em' if size < 90 else '-.046em'
    return (f'<div style="{DISPLAY};font-size:{size}px;letter-spacing:{track};line-height:{lh};'
            f'color:{c};{mw}text-wrap:balance">{text}</div>')


def tag(text, dark=False, tone='plain'):
    if tone == 'built':
        border, color = (MINT_D, MINT_D) if dark else (MINT, MINT)
    else:
        border, color = (SILVER, SILVER) if dark else (INK70, INK70)
    return (f'<span style="{MONO};display:inline-block;font-size:18px;letter-spacing:.14em;text-transform:uppercase;'
            f'line-height:1;padding:7px 10px 6px;border:1px solid {border};color:{color};vertical-align:3px;white-space:nowrap">{text}</span>')


def tagline(text, dark=False, tone='plain'):
    """A tag on its own line under the text it qualifies."""
    return '<br/>' + tag(text, dark, tone).replace('vertical-align:3px', 'vertical-align:0;margin-top:8px')


def footer(n, dark=False):
    if dark:
        return (f'<div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid {LINE_DARK};padding-top:20px">'
                f'<img src="brand/svg/logo-reversed-paper.svg" alt="ifBash" style="width:150px;height:auto;display:block" />'
                f'<div style="{MONO};font-size:22px;color:{SILVER}">{n:02d}</div></div>')
    return (f'<div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid {LINE};padding-top:20px">'
            f'<img src="brand/svg/mark-aubergine.svg" alt="ifBash" style="width:40px;height:auto;display:block" />'
            f'<div style="{MONO};font-size:22px;color:{INK70}">{n:02d}</div></div>')


def frame(src, w, h, crop=None, base=1440, dark=False, alt=''):
    """A 1px hairline frame, no shadow, square corners. `crop` = (x0, y0, width) in the
    screenshot's CSS pixels; the visible height follows from the frame's aspect ratio."""
    border = LINE_DARK if dark else LINE
    iw, ih = w - 2, h - 2
    if crop is None:
        crop = (0, 0, base)
    x0, y0, cw = crop
    k = iw / cw
    img_w = base * k
    return (f'<div style="width:{iw}px;height:{ih}px;overflow:hidden;border:1px solid {border};background:{CARD};flex:none">'
            f'<img src="screens/{src}" alt="{esc(alt)}" style="display:block;width:{img_w:.1f}px;max-width:none;'
            f'margin:{-y0 * k:.1f}px 0 0 {-x0 * k:.1f}px" /></div>')


def bullets(items, size=23, dark=False, gap=16, lead_color=None):
    """A hairline list. Each item is (lead, rest) or a plain string."""
    rule = LINE_DARK if dark else LINE
    body = SILVER if dark else INK70
    strong = PAPER if dark else INK
    out = []
    for i, it in enumerate(items):
        if isinstance(it, tuple):
            lead, rest = it
            inner = f'<span style="font-weight:600;color:{strong}">{lead}</span> {rest}'
        else:
            inner = it
        out.append(f'<div style="border-top:1px solid {rule};padding-top:{gap - 2}px;padding-bottom:{gap}px;'
                   f'{TEXT};font-size:{size}px;line-height:1.42;color:{body};text-wrap:pretty">{inner}</div>')
    return '<div style="display:flex;flex-direction:column">' + ''.join(out) + '</div>'


def caption(text, dark=False, size=22):
    c = SILVER if dark else INK70
    return (f'<div style="{TEXT};font-size:{size}px;line-height:1.45;color:{c};text-wrap:pretty">'
            f'<span style="{MONO};font-size:18px;letter-spacing:.16em;text-transform:uppercase;color:{ROSE_D if dark else ROSE}">Demo college</span><br/>'
            f'{text}</div>')


DEMO = 'Tamarind Grove University is a fictional demo college.'
PHOTO = 'The photos are illustrative stock from Pexels and Unsplash. The people in them do not endorse the portal.'
PEOPLE = 'All people, companies and numbers are demo data.'


def section(label, n, body, notes_text, dark=False, pad=PAD, extra=''):
    bg = FIELD if dark else PAPER
    return (f'  <section data-label="{esc(label)}" data-screen-label="{n:02d} {esc(label)}" data-speaker-notes="{esc(notes_text)}" '
            f'style="background:{bg};{pad};display:flex;flex-direction:column;justify-content:space-between;{TEXT};{extra}">\n'
            f'{body}\n  </section>\n')


def head_block(eb, hl, dark=False, size=64, maxw='30ch', gap=22):
    return (f'<div style="display:flex;flex-direction:column;gap:{gap}px">{eyebrow(eb, dark)}'
            f'{headline(hl, size, dark, maxw)}</div>')


# ---- screen slides: text column left, frames right ---------------------------
LEFT_W, GAP, RIGHT_W, CONTENT_H = 600, 36, 1044, 820


def screen_slide(label, n, eb, hl, items, cap, visuals, notes_text, hl_size=50, cap_under=False):
    foot = '' if cap_under else cap
    left = (f'<div style="width:{LEFT_W}px;flex:none;height:{CONTENT_H}px;display:flex;flex-direction:column;justify-content:space-between">'
            f'<div style="display:flex;flex-direction:column;gap:26px">'
            f'<div style="display:flex;flex-direction:column;gap:18px">{eyebrow(eb)}{headline(hl, hl_size, maxw=None, lh=1.06)}</div>'
            f'{bullets(items, size=24, gap=14)}</div>'
            f'{foot}</div>')
    right = f'<div style="display:flex;flex-direction:column;gap:18px">{visuals}{cap}</div>' if cap_under else visuals
    body = (f'<div style="display:flex;gap:{GAP}px;align-items:flex-start">{left}'
            f'<div style="width:{RIGHT_W}px;flex:none">{right}</div></div>{footer(n)}')
    return section(label, n, body, notes_text)


def main_and_strip(main, strip, mh=520, strip_h=None):
    strip_h = strip_h or CONTENT_H - mh - 20
    return f'<div style="display:flex;flex-direction:column;gap:20px">{main(RIGHT_W, mh)}{strip(RIGHT_W, strip_h)}</div>'


def phone_and_two(phone, a, b):
    ph = CONTENT_H
    pw = round(ph * 390 / 844) + 2
    cw = RIGHT_W - pw - 20
    chh = (CONTENT_H - 20) // 2
    return (f'<div style="display:flex;gap:20px">{phone(pw, ph)}'
            f'<div style="display:flex;flex-direction:column;gap:20px">{a(cw, chh)}{b(cw, chh)}</div></div>')


def sh(src, crop=None, base=1440, alt=''):
    return lambda w, h: frame(src, w, h, crop, base, alt=alt)


slides = []

# ============================================================== 1 Cover (dark)
slides.append(section('Cover', 1, f'''
    <img src="brand/svg/logo-reversed-paper.svg" alt="ifBash" style="width:280px;height:auto;display:block;margin-top:10px" />
    <div style="display:flex;flex-direction:column;gap:38px">
      <div style="{MONO};font-size:26px;letter-spacing:.24em;text-transform:uppercase;color:{ROSE_D}">Alumni portal for Indian engineering colleges</div>
      {headline('The alumni network your college actually owns.', 112, True, '18ch', 1.0)}
      <div style="{TEXT};font-size:34px;line-height:1.5;color:{SILVER};max-width:46ch;text-wrap:pretty">One network for your final-year students and alumni, in your college&rsquo;s name and colours, checked against your degree register.</div>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:flex-end;border-top:1px solid {LINE_DARK};padding-top:32px">
      <div style="{MONO};font-size:22px;letter-spacing:.16em;text-transform:uppercase;color:{SILVER}">Built by ifBash, Vijayawada &middot; [Presenter, role] &middot; [DD Mon YYYY]</div>
      <div style="{MONO};font-size:22px;letter-spacing:.16em;text-transform:uppercase;color:{SILVER}">ifbash.com</div>
    </div>''', notes(
    'Name ifBash once. Then give the promise and do not read the slide.',
    '"Owns" means three concrete things, and each gets its own slide later:\n'
    '- The college\'s name is on every screen.\n'
    '- The college\'s degree register decides who counts as an alumnus.\n'
    '- The college\'s administrator holds the member-data permissions. ifBash\'s own account cannot search, open or export member profiles. It can read the audit log, and slide 10 says exactly what that shows.',
    'Say that everything they will see runs today on sample data, in a fictional demo college. Then say that you will be exact about what is still to come.',
), dark=True, pad='padding:110px 130px'))

# ============================================================== 2 Problem
rows = [
    ('Alumni drift.', 'After convocation the college keeps a roll number and an old email address. Nothing brings the graduate back.'),
    ('Final-years need referrals.', 'The people best placed to give them are recent graduates the college can no longer reach.'),
    ('Hosted platforms lapse.', 'When the subscription ends, the member list stays with the vendor unless someone exported it in time.'),
    ('An open directory is a liability.', 'A public list of names, batches and employers is easy to scrape. Under the DPDP Act, the college answers for it.'),
]
rows_html = ''.join(
    f'<div style="display:grid;grid-template-columns:560px 1fr;gap:48px;align-items:baseline;border-top:1px solid {LINE};padding:24px 0 26px">'
    f'<div style="{DISPLAY};font-size:38px;letter-spacing:-.036em;line-height:1.1;color:{INK}">{a}</div>'
    f'<div style="{TEXT};font-size:27px;line-height:1.5;color:{INK70};text-wrap:pretty">{b}</div></div>'
    for a, b in rows)
slides.append(section('The problem', 2, f'''
    {head_block('The problem', 'A college loses touch with each batch at convocation, and the usual fixes do not hold it.', size=64, maxw='36ch')}
    <div style="display:flex;flex-direction:column;border-bottom:1px solid {LINE}">{rows_html}</div>
    {footer(2)}''', notes(
    'Ask the room three questions before you move on:\n'
    '1. Does the college use an alumni platform today, or did it use one before?\n'
    '2. Does anyone hold an export of that member list?\n'
    '3. Who in the college could find a 2015 graduate\'s current email this week?',
    'Keep the DPDP point plain and do not give legal advice. The college decides why member data is collected, so the college is accountable for it. Do not name competitors on this slide.',
)))

# ============================================================== 3 Two cohorts (dark)
stops = [
    ('01', 'Final-year roll list', 'From the placement cell', None, 'Import: coming next'),
    ('02', 'Final-year student', 'Mentoring, referrals and jobs', None, None),
    ('03', 'Convocation', 'The yearly rollover, with a dry run first', 'Once a year', None),
    ('04', 'Alumni', 'The same account and the same record', None, None),
]
stop_html = ''
for num, title, sub, peach, note in stops:
    if peach:
        marker = (f'<div style="height:38px;display:flex;align-items:center"><span style="background:{PEACH};color:{INK};{MONO};font-size:20px;'
                  f'letter-spacing:.16em;text-transform:uppercase;padding:9px 13px 8px;line-height:1">{peach}</span></div>')
    else:
        marker = f'<div style="height:38px;display:flex;align-items:center"><span style="display:block;width:16px;height:16px;background:{PAPER}"></span></div>'
    note_html = f'<div>{tag(note, dark=True)}</div>' if note else ''
    stop_html += (f'<div style="flex:1;display:flex;flex-direction:column;gap:14px;padding-right:28px">{marker}'
                  f'<div style="{MONO};font-size:26px;color:{MINT_D}">{num}</div>'
                  f'<div style="{DISPLAY};font-size:40px;letter-spacing:-.036em;line-height:1.05;color:{PAPER}">{title}</div>'
                  f'<div style="{TEXT};font-size:24px;line-height:1.45;color:{SILVER}">{sub}</div>{note_html}</div>')
diagram = (f'<div style="position:relative">'
           f'<div style="position:absolute;left:0;right:28px;top:19px;height:1px;background:{SILVER}"></div>'
           f'<div style="position:relative;display:flex">{stop_html}</div></div>')
pts = [
    ('One record per person.', 'A final-year student&rsquo;s account becomes an alumni account after convocation. Nobody registers twice.'),
    ('One reviewed step, once a year.', 'After convocation it moves the batch across. A dry run comes first, and the step never runs on its own.'),
    ('A reason for alumni to sign in:', 'a student from their own branch who is asking for help.'),
    ('Limits protect alumni.', 'Each student can have five open requests at a time and send ten a month.'),
]
pts_html = ''.join(
    f'<div style="border-top:1px solid {LINE_DARK};padding-top:18px;{TEXT};font-size:25px;line-height:1.45;color:{SILVER};text-wrap:pretty">'
    f'<span style="font-weight:600;color:{PAPER}">{a}</span> {b}</div>' for a, b in pts)
slides.append(section('Two cohorts, one network', 3, f'''
    {head_block('Two cohorts, one network', 'Start with the final-year batch, and your graduates are already on the network when they leave.', dark=True, size=62, maxw='32ch')}
    {diagram}
    <div style="display:grid;grid-template-columns:1fr 1fr;column-gap:56px;row-gap:22px">{pts_html}</div>
    {footer(3, dark=True)}''', notes(
    'Most alumni portals only know about graduates. This one knows about the students who become them.',
    'The request limits are not decoration. Hundreds of students writing freely to thousands of alumni is how an alumni network goes quiet. The server checks the limits on every request, so the app cannot bypass them.',
    'If someone asks how students get their accounts, say it now: accounts come from the placement cell\'s final-year roll list, not from an open sign-up form. The tool that imports that list is not built yet, which is why step 01 carries the "Coming next" tag.',
), dark=True))

# ============================================================== 4 Who it is for
cells = [
    ('Alumni', 'Find batchmates by batch, branch, company or city. Decide who sees your email and phone. Post jobs, mentor, and register for reunions.'),
    ('Final-year students', 'Search alumni by branch, batch and company. Ask for mentoring or a referral. Apply to jobs that alumni post.'),
    ('Faculty, HODs and the placement cell', 'HODs review registrations from their own department only, and run department events. Faculty can search both cohorts. The placement cell approves every job before students see it, and CGPA stays on the placement side.'),
    ('Alumni cell', 'Works the verification queue, runs events and check-in, publishes news and galleries, and writes to batches.'),
]
cells_html = ''.join(
    f'<div style="border-top:1px solid {LINE};padding-top:24px;display:flex;flex-direction:column;gap:12px">'
    f'<div style="{DISPLAY};font-size:38px;letter-spacing:-.034em;line-height:1.1;color:{INK}">{t}</div>'
    f'<div style="{TEXT};font-size:25px;line-height:1.5;color:{INK70};text-wrap:pretty">{b}</div></div>' for t, b in cells)
slides.append(section('Who it is for', 4, f'''
    {head_block('Who it is for', 'Each group on campus gets the part of the network its job needs, and no more.', size=64, maxw='30ch')}
    <div style="display:flex;flex-direction:column;gap:30px">
      <div style="display:grid;grid-template-columns:1fr 1fr;column-gap:64px;row-gap:34px">{cells_html}</div>
      <div style="{TEXT};font-size:25px;line-height:1.5;color:{INK70};border-left:3px solid {CLAY};padding-left:22px"><span style="font-weight:600;color:{INK}">Nine roles, one permission table.</span> One person can hold several roles and gets exactly what each allows.</div>
    </div>
    {footer(4)}''', notes(
    'The roles can combine. An alumnus who now teaches and heads a department holds three roles and gets exactly the union of the three.',
    '- Finance reconciles giving and has no access to the directory at all.\n'
    '- The college administrator holds roles, branding, bulk export and the yearly rollover.\n'
    '- ifBash\'s own role gets its own slide (10).',
    'The point for this room is that nobody gets access just because they are staff. Each role has only the access its work needs.',
    'On "decide who sees your email and phone": the member\'s own setting governs every other member. The one exception is the college administrator, who can see contact details to keep the college\'s records. A bulk export by the administrator needs a written reason and is logged.',
)))

# ============================================================== 5 Screens, alumni
slides.append(screen_slide(
    'Screens: alumni', 5, 'Screens &middot; Alumni',
    'Alumni open the portal to someone who needs them, not to a feed.',
    ['The home screen leads with the requests waiting for their reply.',
     'The directory finds batchmates by batch, branch, company or city, and only after sign-in.',
     'On the same screen, the alumnus switches mentoring, referrals and speaking on or off.'],
    caption(f'{DEMO} The banner photo is illustrative stock (Pexels), and the people in it do not endorse the portal. {PEOPLE}'),
    main_and_strip(sh('v12-alumni-home-desktop.png', alt='Alumni home screen'),
                   sh('v17-directory-desktop.png', (586, 316, 836), alt='Directory shortcuts: your batch, your branch, near you, open to mentoring')),
    notes(
        'The screens are from Tamarind Grove University, a fictional demo college. Say so once, clearly. The photo in the banner is illustrative stock.',
        '- Top (home): the banner says "3 people are waiting for your reply" and has a Reply button. Below it are events, news and the "Give back to Tamarind" switches for mentoring, referrals and speaking. The alumnus\'s email and phone stay under their own privacy setting, whatever they switch on there.\n'
        '- Bottom (directory): the "Start here" shortcuts are your batch, your branch, near you, and open to mentoring. The 214 is demo data.',
        'Every page you see here also comes in dark mode, worked out from the same colours. Hold that for slide 8.',
    )))

# ============================================================== 6 Screens, students
slides.append(screen_slide(
    'Screens: final-year students', 6, 'Screens &middot; Final-year students',
    'Final-years ask alumni for mentoring, referrals and jobs, within limits alumni can live with.',
    ['Built for the phone: home, mentorship, requests and jobs sit in a bottom tab bar.',
     f'Students see how many requests they have left. Alumni accept, decline or block. Closing unanswered requests on their own is coming next. {tagline("Coming next")}',
     'The placement cell checks every job before students see it. Applying sends a name, branch, batch and note, never a phone or email.'],
    caption(f'{DEMO} {PEOPLE}'),
    phone_and_two(lambda w, h: frame('v14-student-home-phone.png', w, h, (0, 0, 390), 390, alt='Student home on a phone'),
                  sh('v19-requests-desktop.png', (288, 300, 1152), alt='Requests waiting for an alumnus'),
                  sh('v26-job-detail-desktop.png', (272, 128, 1168), alt='A job posted by an alumnus')),
    notes(
        '- Phone (student home): "25 CSE alumni are open to mentoring. Ask before you apply." The allowance reads "4 requests available, 9 left this month". The limits come from the settings (five open, ten a month); the counts shown are demo data. The tab bar at the bottom holds Home, Mentorship, Requests, Jobs and More.\n'
        '- Top right (requests): the alumnus\'s side of the same requests. Each one shows the message, when it was sent and a closing date, with Accept, Decline and Block.\n'
        '- Bottom right (job): "Your way in" names the alumnus who posted the job. The apply panel says the poster sees the name, branch, batch and note, never the phone or email.',
        'Be exact about closing. Each request is stamped with a date 14 days out, but nothing closes it yet, so an unanswered request keeps one of the student\'s five open slots until someone answers. Automatic closing is on the "Coming next" slide. The requests page still says a request "closes by itself after 14 days"; that line is cropped out of this slide, so do not open that page live until the product matches it.',
        'The "Demo data" badge is hidden at phone width on purpose. If someone notices, say so. What a student sees about an alumnus\'s contact details is on slide 10.',
    ), hl_size=48))

# ============================================================== 7 Screens, events
slides.append(screen_slide(
    'Screens: events and reunions', 7, 'Screens &middot; Events and reunions',
    'A reunion runs from the invitation to the <span style="white-space:nowrap">check-in desk</span> in one place.',
    ['Events take seats, guests, ticket prices and alumni-only entry. A full event takes requests for a seat.',
     'Every registrant carries a pass with a check-in code. Door mode turns the roster into large check-in buttons.',
     f'One tap shares an event to WhatsApp. Online payment through Razorpay is coming next. {tagline("Coming next")}'],
    caption(f'{DEMO} Events, prices, people and counts are demo data.'),
    phone_and_two(lambda w, h: frame('v23-event-ticket-phone.png', w, h, (0, 0, 390), 390, alt='Event pass on a phone'),
                  sh('v21-events-list-desktop.png', (288, 187, 1152), alt='Event list with seat states'),
                  sh('v35-checkin-door-mode-desktop.png', (288, 80, 1152), alt='Door mode for check-in')),
    notes(
        '- Phone (pass): the pass carries the check-in code, with Add to calendar and Directions.\n'
        '- Top right (event list): each event shows its seat state: "Only 2 left", "Full, ask for a seat" and "Alumni only".\n'
        '- Bottom right (door mode): the screen for a volunteer at a registration table. Search by name, batch or pass code, then Check in.',
        'Ticket prices are shown and recorded today. Collecting money online needs Razorpay, which is on the "Coming next" list, so do not demo a payment. The event detail page and the full check-in desk are backups if anyone asks.',
    )))

# ============================================================== 8 White label
fw, fh = 800, 402
wl_pts = [
    ('One file per college.', 'Name, crest, colours, typefaces, photos, wording and which modules are on.'),
    ('Your colours in.', 'Hover states, dark mode and every text colour are worked out from them.'),
    ('A contrast check', 'blocks any colour pairing that would be hard to read.'),
    ('No photos yet?', 'A solid band in the college&rsquo;s own colour. The page looks designed, not empty.'),
    ('Giving stays off', 'until your FCRA status is confirmed.'),
]
wl_html = ''.join(
    f'<div style="flex:1;border-top:1px solid {LINE};padding-top:14px;{TEXT};font-size:24px;line-height:1.38;color:{INK70};text-wrap:pretty">'
    f'<span style="font-weight:600;color:{INK}">{a}</span> {b}</div>' for a, b in wl_pts)
cap_style = f'{TEXT};font-size:22px;line-height:1.4;color:{INK70};margin-top:12px;text-wrap:pretty'
slides.append(section('White label', 8, f'''
    {head_block('White label', 'Your college&rsquo;s name, colours, photos and video come from one file, not from custom code.', size=58, maxw='34ch', gap=18)}
    <div style="display:flex;gap:{1680 - 2 * fw}px">
      <div style="width:{fw}px">{frame('v09-signin-desktop.png', fw, fh, alt='Sign-in page, Tamarind Grove University (fictional)')}
        <div style="{cap_style}"><span style="font-weight:600;color:{INK}">Tamarind Grove University:</span> a fictional demo college. The photo is illustrative stock (Pexels), and the people in it do not endorse the portal.</div></div>
      <div style="width:{fw}px">{frame('n09-signin-northgate-desktop.png', fw, fh, alt='Sign-in page, Northgate Polytechnic (fictional)')}
        <div style="{cap_style}"><span style="font-weight:600;color:{INK}">Northgate Polytechnic:</span> also fictional. Its file has no photos, so the page falls back to a solid band in its own colour.</div></div>
    </div>
    <div style="display:flex;gap:28px">{wl_html}</div>
    {footer(8)}''', notes(
    'The code is the same in both frames. Only the college\'s file differs: colours, typefaces, corner shape, photos and wording.',
    'Both colleges are fictional. Tamarind Grove\'s photos are illustrative stock, and the people in them do not endorse the portal. Northgate\'s file has no photos, so its sign-in page shows a solid band in its own colour. That is what a real college sees before its photos arrive. Northgate\'s landing page is also switched off in the same file, which is why it opens straight on sign-in.',
    'Adding a college takes three things: that file, one line in a registry and a subdomain. No screen, component or stylesheet is touched. ifBash is named in only two places: a "Powered by" line, which is itself a field in the file, and the privacy page.',
    'On video: the file takes a 10 to 20 second silent loop, shown on desktop only. No demo college has one wired in yet. Show the slot, and do not promise a clip we have not shown.',
    'If the college admin role comes up, the branding studio lets them preview and publish changes.',
)))

# ============================================================== 9 Verification
slides.append(screen_slide(
    'Verification', 9, 'Verification',
    'Every alumni registration is checked against the degree register your examinations branch already keeps.',
    ['Graduates register with their roll number, their name as printed, their branch and their year of passing.',
     'Clear matches go through. Close calls, such as a married surname, wait for a person at the college, with the application and the register row side by side.',
     'HODs can review registrations from their own department, and only theirs.'],
    caption(f'{DEMO} No college&rsquo;s real register is loaded: the registration and the register row are demo data. Contact details blurred.'),
    sh('v31-verification-claim-waiting-desktop.png', (272, 80, 1146), alt='A close call: a registration under a married surname beside its register row')(RIGHT_W, CONTENT_H),
    notes(
        'Without the register, every registration is a judgement call with no evidence behind it. With it, most registrations are a lookup.',
        'The screen is a close call. Ramya registered under her married surname, and the register holds the name on her mark sheet. Roll number, branch, year of passing and admission year all match; the name is marked "Close", and the score is 75%. A person at the college approves, asks for a document, or rejects. The matcher does not decide this one.',
        'A changed name, a supplementary exam or a lateral entry is not turned away. The college corrects the member record. The register itself is read-only: errors in it go back to the examinations branch, and come back as a corrected file.',
        'The register loads with a dry run first. The dry run shows what will be added and what will be rejected before anything is written.',
        'The matcher has been tested against married surnames, initials, transliteration, junk roll numbers, twins and an impostor. Its thresholds are provisional. They are tuned against each college\'s real register when it arrives.',
        'Tell them the register is the longest-lead item, and ask the examinations branch for it this week.',
    ), hl_size=46))

# ============================================================== 10 Privacy (dark)
# "cannot" opens the second line, so the clay ring sits at the start of a line in every font and in the PowerPoint twin.
cannot = (f'<span style="position:relative;display:inline-block;margin:0 .14em 0 0">cannot'
          f'<img src="art/circle-clay.svg" alt="" style="position:absolute;left:-12px;top:-6px;width:calc(100% + 24px);height:calc(100% + 14px);max-width:none;pointer-events:none" /></span>')
col1 = [
    'Nobody searches your alumni without signing in. There is no public list.',
    'Contact details need two yeses: the viewer must be entitled, and the owner&rsquo;s own setting must allow it. The one exception is your college administrator.',
    'A student sees an alumnus&rsquo;s email or phone only after that alumnus accepts the student&rsquo;s request.',
    'CGPA and placement status stay with the placement cell. Students never see giving.',
]
col2 = [
    'Only your college administrator can export contacts in bulk or act on DPDP requests. An export needs a written reason for the audit log. A request starts a <span style="white-space:nowrap">30-day</span> clock.',
    'ifBash&rsquo;s admin account sets up your college and its branding. It cannot open a profile, search the directory, export contacts or see a data request.',
    'It can read the audit log. An entry keeps the record the action changed, so it shows member details such as names and roll numbers.',
    'The portal is designed to keep data in India (AWS Mumbai). Hosting is not live yet.',
]


def col_block(title, items, width):
    return (f'<div style="width:{width}px;flex:none;display:flex;flex-direction:column;gap:14px">'
            f'<div style="{DISPLAY};font-size:30px;letter-spacing:-.03em;line-height:1.1;color:{PAPER}">{title}</div>'
            f'{bullets(items, size=24, dark=True, gap=12)}</div>')


priv_shots = (f'<div style="width:460px;flex:none;display:flex;flex-direction:column;gap:18px">'
              f'{frame("v18-member-profile-desktop.png", 460, 309, (1076, 405, 344), dark=True, alt="A contact card with its sharing rule")}'
              f'{caption(f"{DEMO} Contact details blurred. {PEOPLE}", dark=True)}</div>')
slides.append(section('Privacy and DPDP', 10, f'''
    <div style="display:flex;flex-direction:column;gap:18px">{eyebrow('Privacy and DPDP', True)}
      {headline(f'The privacy rules are enforced on the server, and ifBash<br/>{cannot} search or export your members.', 56, True, None, 1.1)}</div>
    <div style="display:flex;gap:40px;align-items:flex-start">
      {col_block('Between members', col1, 540)}
      {col_block('Between your college and us', col2, 600)}
      {priv_shots}
    </div>
    {footer(10, dark=True)}''', notes(
    'Hiding a button is presentation. These rules are permissions, checked on the server on every request. The database schema separates colleges with row-level security, so isolation does not depend on application code remembering to filter.',
    '- The contact card reads "Vandana shares this with Tamarind alumni and faculty". That is the two-yes rule on screen: the viewer is entitled, and the owner consented. The email and phone are blurred on the slide because they are generated demo values that could belong to a real person.',
    'The one exception to the two-yes rule is the college administrator, who sees every member\'s contact details. The administrator\'s bulk export needs a written reason and goes into the audit log.',
    'Be exact about ifBash. Our account has no permission to open a profile, search the directory, export contacts or see a data request, and automated tests hold that line. It can read the audit log, because someone has to be able to answer "who did what" during an incident. Audit entries keep the record an action changed: after an edit, a member\'s name, roll number, branch, batch, employer and city; for a registration, the applicant\'s email address. Say this before they find it. We found a gap here once and closed it, and the tests exist so it stays closed.',
    'Consent is recorded along with the version of the privacy notice the member agreed to.',
    'On data residency: the database and file storage are specified for AWS Mumbai (ap-south-1). The services that deliver email and WhatsApp messages, and where those services process them, are agreed with each college and named in its privacy notice.',
), dark=True))

# ============================================================== 11 Staff console
slides.append(screen_slide(
    'Staff console', 11, 'Staff console',
    'One console runs the portal, and every admin action is logged.',
    [('Today:', 'registrations to review, the next event, and how far each batch has joined.'),
     ('Messages:', f'write to a cohort, branch, city or batch range. Today it drafts copy for WhatsApp groups. Sending by email and the WhatsApp Business API is coming next. {tagline("Coming next")}'),
     ('Also here:', 'events and check-in, news and galleries. Your college administrator&rsquo;s roles, branding and DPDP queue are there too, behind their own permissions.')],
    caption(f'{DEMO} Every name and number is demo data.'),
    main_and_strip(sh('v29-staff-console-desktop.png', alt='Staff console, Today'),
                   sh('v36-comms-composer-desktop.png', (270, 522, 868), alt='Choosing who a message goes to'), mh=482),
    notes(
        '- Top (Today): the alumni cell operator\'s home. The reach grid shows, batch by batch, how much of the register has joined. Each batch that is furthest behind has a "Write to this batch" link.\n'
        '- Bottom (messages): the composer picks the audience by cohort, branch, city and batch range.',
        'Today the composer drafts copy for WhatsApp groups. Email delivery and sending through the WhatsApp Business API are coming next. Do not open this demo college\'s channel card live: its file switches WhatsApp on, so the card describes template sending that is not built yet.',
        'The alumni cell operator deliberately has no bulk export, no roles, no branding and no DPDP queue. Those belong to the college administrator. Staff leave, and an exportable directory would leave with them.',
        'The audit log records who changed what and when, with the record before and after. The administrator also has a coverage report: the register against who has joined, by year of passing.',
    ), hl_size=48))

# ============================================================== 12 Go live
supplies = [
    'The degree register from the examinations branch: roll number, name as printed, branch and year of passing, for every batch on record',
    'The crest in vector, and the official colour values',
    'Campus photos and a short video, if you have them',
    'The trust&rsquo;s FCRA registration status, before any giving is switched on',
    f'The export from any previous alumni platform {tagline("Import tool: coming next")}',
    'A named contact in the alumni cell',
]
phases = [
    ('Brand file and register import.', 'We write your college&rsquo;s file. You review the portal on its own address before anyone else sees it. The register loads with a dry run first.', None),
    ('Pilot with one batch.', 'One batch registers. The alumni cell works the queue and corrects member records. Errors in the register go back to the examinations branch as a corrected file.', None),
    ('Final-year invitation through the placement cell.', 'The placement cell&rsquo;s final-year roll list becomes the student accounts.', 'Import tool: coming next'),
    ('Alumni registration drive over WhatsApp groups.', 'Batch representatives share the registration link in their own groups.', 'API sending: coming next'),
]
ph_html = ''.join(
    f'<div style="display:grid;grid-template-columns:72px 1fr;border-top:1px solid {LINE};padding:14px 0 16px">'
    f'<div style="{MONO};font-size:30px;line-height:1.2;color:{MINT}">{i + 1:02d}</div>'
    f'<div style="{TEXT};font-size:24px;line-height:1.4;color:{INK70};text-wrap:pretty"><span style="font-weight:600;color:{INK}">{t}</span> {b}'
    + (tagline(x) if x else '') + '</div></div>'
    for i, (t, b, x) in enumerate(phases))
sup_html = ''.join(
    f'<div style="border-top:1px solid {LINE};padding:11px 0 13px;{TEXT};font-size:24px;line-height:1.38;color:{INK70};text-wrap:pretty">{s}</div>'
    for s in supplies)
slides.append(section('How a college goes live', 12, f'''
    {head_block('How a college goes live', 'Going live takes four phases, and the degree register is the one to ask for first.', size=56, maxw='36ch', gap=18)}
    <div style="display:flex;gap:64px;align-items:flex-start">
      <div style="width:640px;flex:none;display:flex;flex-direction:column;gap:12px">
        <div style="{DISPLAY};font-size:32px;letter-spacing:-.032em;color:{INK}">What your college supplies</div>
        <div style="display:flex;flex-direction:column;border-bottom:1px solid {LINE}">{sup_html}</div>
      </div>
      <div style="flex:1;display:flex;flex-direction:column;gap:12px">
        <div style="{DISPLAY};font-size:32px;letter-spacing:-.032em;color:{INK}">Four phases, no dates</div>
        <div style="display:flex;flex-direction:column;border-bottom:1px solid {LINE}">{ph_html}</div>
      </div>
    </div>
    {footer(12)}''', notes(
    'There are no dates on purpose. Two things set the pace: when the register arrives, and the college calendar. After that, once a year after convocation, the final-year batch moves to alumni in one reviewed step (slide 3).',
    '- Phase 2: pick a recent batch. Their contacts are fresh, and any errors in the register surface early and in small numbers. The register is read-only in the portal: the alumni cell corrects member records, and register errors go back to the examinations branch, which sends a corrected file.\n'
    '- Phase 4: WhatsApp groups are where Indian alumni actually read. Batch groups already exist, and the portal already makes share links and copy-ready messages for them.',
    'The export from a previous platform is urgent if that contract has lapsed, because a vendor may not keep data for long. Ask about it today. Say plainly that the tool to import it is not built yet: get the file now, and it is loaded when the importer is ready.',
)))

# ============================================================== 13 Deployment
options = [
    ('Option A', 'Hosted by ifBash', [
        'We run the portal and keep it up to date. Your IT team runs nothing.',
        'It is designed to keep data in India.',
        'Your college administrator holds the member-data permissions. ifBash&rsquo;s account reads the audit log, not the directory.',
        'Updates reach every college at once.']),
    ('Option B', 'On your own infrastructure', [
        'We hand the portal&rsquo;s front end to your IT team, to run against your college&rsquo;s own backend and servers.',
        'Your backend must enforce the same privacy rules (slide 10). We scope that work with your IT team before you choose.',
        'The same brand file sets your name and colours.']),
]
opt_html = ''
for i, (lab, title, pts_) in enumerate(options):
    side = 'padding-right:56px' if i == 0 else f'padding-left:56px;border-left:1px solid {LINE}'
    opt_html += (f'<div style="flex:1;{side};display:flex;flex-direction:column;gap:20px;padding-top:30px;padding-bottom:30px">'
                 f'<div style="display:flex;gap:16px;align-items:center"><span style="{MONO};font-size:22px;letter-spacing:.18em;text-transform:uppercase;color:{INK70}">{lab}</span>{tag("To discuss")}</div>'
                 f'<div style="{DISPLAY};font-size:48px;letter-spacing:-.038em;line-height:1.05;color:{INK}">{title}</div>'
                 f'{bullets(pts_, size=25, gap=14)}</div>')
slides.append(section('Deployment options', 13, f'''
    {head_block('Deployment &middot; To decide together', 'Where the portal runs is a choice we make with you, not for you.', size=64, maxw='30ch')}
    <div style="display:flex;border-top:1px solid {LINE};border-bottom:1px solid {LINE}">{opt_html}</div>
    <div style="{TEXT};font-size:25px;line-height:1.5;color:{INK70};border-left:3px solid {CLAY};padding-left:22px"><span style="font-weight:600;color:{INK}">Hosting is not live yet for either option.</span></div>
    {footer(13)}''', notes(
    '- Option A suits a college without a team to run servers.\n'
    '- Option B suits a college whose policy keeps every system in-house.',
    'Say this plainly for Option B. Everything slide 10 promises runs on the server, in our code: the permission checks, the separation between colleges in the database, the contact rules, the request limits and the audit log. A front end on its own carries none of it. If your backend runs the portal, your backend has to enforce those same rules, so scope that with your IT team before choosing.',
    'The price depends on the option, which is why pricing comes after this slide.',
)))

# ============================================================== 14 Ready now, coming next (dark)
built = [
    'Directory, profiles and the contact-release rules',
    'Mentorship and referral requests, with limits',
    'Jobs, checked by the placement cell',
    'Events with seats, tickets and check-in at the door',
    'News and photo galleries',
    'Degree-register import and the verification queue',
    'Roles, audit log, DPDP requests and branding in the admin console',
    'The yearly batch rollover, with a dry run',
    'Giving with FCRA fields, switched off until your FCRA status is confirmed',
    'A demonstration mode that runs the whole portal without a database',
]
nextl = [
    'Production hosting, with the live database behind every form',
    'The portal on your college&rsquo;s own domain',
    'Final-year roll-list import and batch invitations',
    'Import from your previous alumni platform',
    'Email delivery, with bounce handling',
    'WhatsApp Business API messages',
    'Photo and file uploads to storage in India',
    'Online payments through Razorpay, UPI first',
    'Background jobs, such as closing unanswered requests',
    'The complete browser test suite for permission boundaries',
    'Database tests for the separation between colleges',
]


def status_list(items, color, mark):
    return ''.join(
        f'<div style="display:grid;grid-template-columns:34px 1fr;border-top:1px solid {LINE_DARK};padding:8px 0 9px;'
        f'{TEXT};font-size:24px;line-height:1.3;color:{color}"><span style="{MONO};font-size:22px;color:{MINT_D if mark == "+" else SILVER}">{mark}</span><span>{s}</span></div>'
        for s in items)


slides.append(section('Ready now, and coming next', 14, f'''
    {head_block('Where it stands', 'What you have seen runs today on sample data. These are the main pieces still to build before you go live.', dark=True, size=54, maxw='40ch', gap=18)}
    <div style="display:flex;gap:64px;align-items:flex-start">
      <div style="flex:1;display:flex;flex-direction:column;gap:14px">
        <div style="display:flex;gap:16px;align-items:center"><span style="{DISPLAY};font-size:32px;letter-spacing:-.032em;color:{PAPER}">In the product today</span>{tag('Built', True, 'built')}</div>
        <div style="border-bottom:1px solid {LINE_DARK}">{status_list(built, PAPER, '+')}</div>
      </div>
      <div style="flex:1;display:flex;flex-direction:column;gap:14px">
        <div style="display:flex;gap:16px;align-items:center"><span style="{DISPLAY};font-size:32px;letter-spacing:-.032em;color:{PAPER}">Coming next</span>{tag('Not built yet', True)}</div>
        <div style="border-bottom:1px solid {LINE_DARK}">{status_list(nextl, SILVER, '&ndash;')}</div>
      </div>
    </div>
    {footer(14, dark=True)}''', notes(
    'Demonstration mode is the portal running on sample data, and it is what they have been watching.',
    'Today, forms check permissions, apply the limits and write the audit entry. They do not yet save to a live database. That is the first item under "Coming next".',
    'The list is the main pieces, not a promise that nothing else will come up. Invite them to ask where each item stands against their own timeline. Do not give dates that ifBash has not committed to.',
), dark=True))

# ============================================================== 15 Pricing
prices = [
    ('Setup &middot; once', 'Setup', ['Your brand file and a preview on its own address', 'Degree-register import and checks', f'Your first final-year batch, loaded by us {tagline("Import tool: coming next")}']),
    ('Subscription &middot; every year, per college', 'Subscription', ['The portal for your college', 'Every update to it', 'Support for your alumni cell and placement cell']),
]
pr_html = ''
for i, (lab, title, covers) in enumerate(prices):
    side = 'padding-right:56px' if i == 0 else f'padding-left:56px;border-left:1px solid {LINE}'
    pr_html += (f'<div style="flex:1;{side};display:flex;flex-direction:column;gap:16px;padding-top:26px;padding-bottom:26px">'
                f'<div style="{MONO};font-size:22px;letter-spacing:.18em;text-transform:uppercase;color:{INK70}">{lab}</div>'
                f'<div style="{DISPLAY};font-size:72px;letter-spacing:-.03em;line-height:1;color:{ROSE}">&#8377;&nbsp;______</div>'
                f'<div style="margin-top:6px">{bullets(covers, size=25, gap=12)}</div></div>')
callout = f'{TEXT};font-size:25px;line-height:1.45;color:{INK70};border-left:3px solid {CLAY};padding-left:22px'
slides.append(section('Pricing', 15, f'''
    {head_block('Pricing', 'One setup fee, then one subscription a year for each college.', size=56, maxw='34ch', gap=18)}
    <div style="display:flex;border-top:1px solid {LINE};border-bottom:1px solid {LINE}">{pr_html}</div>
    <div style="display:flex;flex-direction:column;gap:18px">
      <div style="{callout}"><span style="font-weight:600;color:{INK}">Quoted for your college.</span> The numbers depend on its size and how it is hosted.</div>
      <div style="{callout}"><span style="font-weight:600;color:{INK}">If you stop, your members stay yours.</span> Your college administrator can export the member list, with contact details, at any time, and every export is logged. What we hand over when a subscription ends is agreed before you sign. {tagline("To discuss")}</div>
    </div>
    {footer(15)}''', notes(
    'Do not say a number until the owner has filled the blanks.',
    'The ifBash ops rate card is for consulting day rates. It does not apply here, so do not quote from it.',
    'If they press, repeat that the price is quoted after a conversation about two things: the college\'s size and the deployment option.',
    'Slide 2 said hosted platforms lapse and keep the member list. Answer it here before they ask. The administrator\'s export works today and is logged. The exit handover (what file, in what format, within how many days) is not agreed yet, so offer to write it into the contract rather than promising terms on the call.',
)))

# ============================================================== 16 Next step (dark)
slides.append(section('Next step', 16, f'''
    <img src="brand/svg/logo-reversed-paper.svg" alt="ifBash" style="width:280px;height:auto;display:block;margin-top:10px" />
    <div style="display:flex;flex-direction:column;gap:34px">
      <div style="{MONO};font-size:26px;letter-spacing:.24em;text-transform:uppercase;color:{ROSE_D}">Next step</div>
      {headline('See the portal in your college&rsquo;s colours.', 100, True, '20ch', 1.0)}
      <div style="{TEXT};font-size:32px;line-height:1.55;color:{SILVER};max-width:52ch;text-wrap:pretty">Send us your college&rsquo;s name, crest and colours. We will write its brand file and show you your own portal on the call. In the meantime, ask your examinations branch for the degree register.</div>
      <div style="display:flex;gap:40px;align-items:center;margin-top:6px">
        <span style="background:{PEACH};color:{INK};{TEXT};font-weight:600;font-size:30px;line-height:1;padding:24px 34px;display:inline-block">Request a demo &rarr;</span>
        <span style="{MONO};font-size:26px;letter-spacing:.06em;color:{PAPER}">hello@ifbash.com &middot; ifbash.com</span>
      </div>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:flex-end;border-top:1px solid {LINE_DARK};padding-top:32px">
      <div style="{MONO};font-size:22px;letter-spacing:.16em;text-transform:uppercase;color:{SILVER}">[Presenter, role] &middot; [DD Mon YYYY]</div>
      <div style="{MONO};font-size:22px;letter-spacing:.16em;text-transform:uppercase;color:{SILVER}">ifbash.com</div>
    </div>''', notes(
    'Name the next step and who owns each part:\n'
    '- Who sends the crest and colours.\n'
    '- Who asks the examinations branch for the register.\n'
    '- When the demo in their own colours happens.',
    'When they write, three facts are enough: the college\'s name, their role, and roughly how many alumni the college has. Then stop talking.',
), dark=True, pad='padding:110px 130px'))

# ---- page -----------------------------------------------------------------
KEYS = r'''<script>
/* Presenter keys, outside the engine: P prints (Save as PDF gives one slide per page),
   N opens the speaker notes in a separate window that follows the current slide,
   F toggles full screen. In full screen the engine is told it is presenting, which hides
   the thumbnail rail and keeps the slide counter off the audience's screen. */
(function () {
  var win = null, cur = null;
  function esc(s) { return String(s).replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }); }
  function active() {
    if (cur && cur.slide) return cur;
    var st = document.querySelector('deck-stage');
    if (!st) return null;
    var all = Array.prototype.slice.call(st.querySelectorAll(':scope > section'));
    var s = st.querySelector(':scope > section[data-deck-active]') || all[0];
    return s ? { slide: s, index: all.indexOf(s), total: all.length } : null;
  }
  function render() {
    if (!win || win.closed) return;
    var a = active();
    if (!a) return;
    var n = a.slide.getAttribute('data-speaker-notes') || '';
    var label = a.slide.getAttribute('data-label') || '';
    win.document.title = 'Notes ' + (a.index + 1) + ' / ' + a.total;
    win.document.body.innerHTML = '<p class="k">' + (a.index + 1) + ' / ' + a.total + ' &middot; ' + esc(label) + '</p>' +
      n.split(/\n\s*\n/).map(function (p) { return '<p>' + esc(p).replace(/\n/g, '<br>') + '</p>'; }).join('');
  }
  function openNotes() {
    win = window.open('', 'alumni-deck-notes', 'width=760,height=640');
    if (!win) return;
    win.document.open();
    win.document.write('<!doctype html><meta charset="utf-8"><title>Notes</title><style>body{margin:28px 36px;background:#FBF8F4;color:#2A1830;font:20px/1.55 "Hanken Grotesk",Arial,sans-serif}p{margin:0 0 14px}.k{font:14px "IBM Plex Mono",Consolas,monospace;letter-spacing:.14em;text-transform:uppercase;color:#9E2A4B}</style><body></body>');
    win.document.close();
    render();
  }
  document.addEventListener('slidechange', function (e) { cur = e.detail; render(); });
  window.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var t = e.composedPath ? e.composedPath()[0] : e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    if (e.key === 'p' || e.key === 'P') { e.preventDefault(); window.print(); }
    else if (e.key === 'n' || e.key === 'N') { e.preventDefault(); openNotes(); }
    else if (e.key === 'f' || e.key === 'F') {
      e.preventDefault();
      if (document.fullscreenElement) document.exitFullscreen();
      else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(function () {});
    }
  });
  document.addEventListener('fullscreenchange', function () {
    window.postMessage({ __omelette_presenting: !!document.fullscreenElement }, '*');
  });
})();
</script>'''

page = f'''<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Alumni portal deck</title>
<!-- Standalone mode, so the deck opens straight from disk and offline:
     - support.js fetch()es deck-stage.js and the page itself, and fetch() does not work on file://.
       deck-stage.js is loaded by its own script tag instead; the empty blob stands in for the engine's
       fetch of it, and an empty __resources map tells the engine not to re-fetch the page.
     - React 18.3.1 UMD is vendored, byte-identical to the unpkg files support.js would load (same SRI hashes). -->
<script>
  window.__resources = window.__resources || {{}};
  window.__resourceBlobs = Object.assign(window.__resourceBlobs || {{}}, {{ './deck-stage.js': new Blob(['']) }});
</script>
<script src="./vendor/react.production.min.js"></script>
<script src="./vendor/react-dom.production.min.js"></script>
<script src="./deck-stage.js"></script>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link rel="stylesheet" href="brand/fonts/fonts.css" />
<style>
  body {{ margin: 0; background: #22132A; font-family: 'Hanken Grotesk', 'Aptos', 'Helvetica Neue', Arial, sans-serif; }}
  a {{ color: #F2865A; }}
  a:hover {{ color: #FBF8F4; }}
</style>
</helmet>
<div style="width:100%;height:100vh;min-height:540px;display:block;background:#22132A">
<x-import component-from-global-scope="deck-stage" from="./deck-stage.js" width="1920" height="1080" hint-size="100%,100%" style="width:100%;height:100%;display:block">

{''.join(slides)}
</x-import>
</div>
</x-dc>
{KEYS}
</body>
</html>
'''

with open(OUT, 'w', encoding='utf-8', newline='\n') as f:
    f.write(page)
print('wrote', OUT, len(page), 'bytes,', len(slides), 'slides')
