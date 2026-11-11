/* CBC events calendar. Renders assets/cbc/events.json (built from the public
   Google Calendar ICS feed by .github/scripts/build_events.py) as a site-styled
   month grid and event list. All times are America/Chicago. */
(function () {
  var root = document.getElementById('cbc-calendar');
  if (!root) return;
  var SRC = root.getAttribute('data-src');
  var CAL = 'chicagobitcoincollective@gmail.com';
  var TZ = 'America/Chicago';
  var MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  var DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  var ICON = {
    prev: '<svg viewBox="0 -960 960 960" fill="currentColor"><path d="M560-240 320-480l240-240 56 56-184 184 184 184-56 56Z"/></svg>',
    next: '<svg viewBox="0 -960 960 960" fill="currentColor"><path d="M504-480 320-664l56-56 240 240-240 240-56-56 184-184Z"/></svg>',
    time: '<svg viewBox="0 -960 960 960" fill="currentColor"><path d="m612-292 56-56-148-148v-184h-80v216l172 172ZM480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q133 0 226.5-93.5T800-480q0-133-93.5-226.5T480-800q-133 0-226.5 93.5T160-480q0 133 93.5 226.5T480-160Z"/></svg>',
    pin: '<svg viewBox="0 -960 960 960" fill="currentColor"><path d="M480-480q33 0 56.5-23.5T560-560q0-33-23.5-56.5T480-640q-33 0-56.5 23.5T400-560q0 33 23.5 56.5T480-480Zm0 294q122-112 181-203.5T720-552q0-109-69.5-178.5T480-800q-101 0-170.5 69.5T240-552q0 71 59 162.5T480-186Zm0 106Q319-217 239.5-334.5T160-552q0-150 96.5-239T480-880q127 0 223.5 89T800-552q0 100-79.5 217.5T480-80Z"/></svg>'
  };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function ymd(y, m, d) { return y + '-' + pad(m + 1) + '-' + pad(d); }
  function todayYmd() { return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
  function hm(iso) { var t = iso.slice(11, 16).split(':'); var h = +t[0], m = t[1]; var ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; return h + (m === '00' ? '' : ':' + m) + ' ' + ap; }
  function dayOf(iso) { return iso.slice(0, 10); }
  function parts(d) { var p = d.split('-'); return { y: +p[0], m: +p[1] - 1, d: +p[2] }; }
  function weekday(d) { var p = parts(d); return new Date(Date.UTC(p.y, p.m, p.d)).getUTCDay(); }
  function addDays(d, n) { var p = parts(d); var x = new Date(Date.UTC(p.y, p.m, p.d + n)); return ymd(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate()); }
  function timeLabel(e) {
    if (e.allDay) return dayOf(e.end) !== dayOf(e.start) ? 'All day, through ' + longDate(dayOf(e.end)) : 'All day';
    var s = hm(e.start), en = e.end && e.end !== e.start ? hm(e.end) : '';
    return (en ? s + ' to ' + en : s) + ' CT';
  }
  function longDate(d) { var p = parts(d); return DOW[weekday(d)] + ', ' + MONTHS[p.m] + ' ' + p.d; }
  function gcalLink(e) {
    var f = function (iso) { return iso.slice(0, 16).replace(/[-:]/g, '') + (e.allDay ? '' : '00'); };
    var dates = e.allDay ? dayOf(e.start).replace(/-/g, '') + '/' + addDays(dayOf(e.end), 1).replace(/-/g, '')
                         : f(e.start) + '/' + f(e.end || e.start);
    var q = new URLSearchParams({ action: 'TEMPLATE', text: e.title, dates: dates, ctz: TZ, details: (e.description || '') + (e.url ? '\n' + e.url : ''), location: e.location || '' });
    return 'https://calendar.google.com/calendar/render?' + q.toString();
  }
  function ctaLabel(url) { return /meetup\.com|lu\.ma|luma\.com|eventbrite|rsvp/i.test(url) ? 'RSVP' : 'Details'; }

  var state = { events: [], byDay: {}, today: todayYmd(), y: 0, m: 0, view: window.matchMedia('(max-width: 767px)').matches ? 'list' : 'month', min: null, max: null };
  var t = parts(state.today); state.y = t.y; state.m = t.m;

  function card(e, inModal) {
    var d = parts(dayOf(e.start));
    var past = (e.allDay ? dayOf(e.end) : dayOf(e.start)) < state.today;
    return '<article class="cbc-cal-card' + (past && !inModal ? ' is-past' : '') + '">' +
      (inModal ? '<button class="cbc-cal-close" aria-label="Close">&times;</button>' : '') +
      '<div class="cbc-cal-date"><small>' + MONTHS[d.m].slice(0, 3) + '</small><strong>' + d.d + '</strong><em>' + DOW[weekday(dayOf(e.start))] + '</em></div>' +
      '<div class="cbc-cal-body"><h3>' + esc(e.title) + '</h3>' +
      '<div class="cbc-cal-meta">' + ICON.time + '<span>' + esc(longDate(dayOf(e.start))) + ' · ' + esc(timeLabel(e)) + '</span></div>' +
      (e.location ? '<div class="cbc-cal-meta">' + ICON.pin + '<a href="https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(e.location) + '" target="_blank" rel="noopener" style="color:inherit">' + esc(e.location) + '</a></div>' : '') +
      (e.description ? '<div class="cbc-cal-desc">' + esc(e.description) + '</div>' : '') +
      '<div class="cbc-cal-actions">' +
        (e.url ? '<a class="cbc-cal-cta" href="' + esc(e.url) + '" target="_blank" rel="noopener">' + ctaLabel(e.url) + '</a>' : '') +
        (!past ? '<a class="cbc-cal-cta is-ghost" href="' + esc(gcalLink(e)) + '" target="_blank" rel="noopener">Add to calendar</a>' : '') +
      '</div></div></article>';
  }

  function monthEvents() {
    var pre = state.y + '-' + pad(state.m + 1);
    return state.events.filter(function (e) { return dayOf(e.start).slice(0, 7) === pre || (e.allDay && dayOf(e.end).slice(0, 7) === pre); });
  }

  function render() {
    var key = state.y * 12 + state.m;
    var html = '<div class="cbc-cal-bar"><div class="cbc-cal-title">' +
      '<h3 class="cbc-cal-month">' + (state.view === 'list' && state.y + '-' + pad(state.m + 1) === state.today.slice(0, 7) ? 'Coming <span>up</span>' : MONTHS[state.m] + ' <span>' + state.y + '</span>') + '</h3></div>' +
      '<div class="cbc-cal-nav">' +
        '<button class="cbc-cal-btn" data-act="prev" aria-label="Previous month"' + (key <= state.min ? ' disabled' : '') + '>' + ICON.prev + '</button>' +
        '<button class="cbc-cal-btn" data-act="today">Today</button>' +
        '<button class="cbc-cal-btn" data-act="next" aria-label="Next month"' + (key >= state.max ? ' disabled' : '') + '>' + ICON.next + '</button>' +
        '<div class="cbc-cal-views" role="tablist">' +
          '<button class="cbc-cal-btn' + (state.view === 'month' ? ' is-active' : '') + '" data-view="month" role="tab">Month</button>' +
          '<button class="cbc-cal-btn' + (state.view === 'list' ? ' is-active' : '') + '" data-view="list" role="tab">List</button>' +
        '</div></div></div>';

    if (state.view === 'month') {
      html += '<div class="cbc-cal-grid">' + DOW.map(function (d) { return '<div class="cbc-cal-dow">' + d + '</div>'; }).join('');
      var first = ymd(state.y, state.m, 1);
      var day = addDays(first, -weekday(first));
      for (var i = 0; i < 42; i++) {
        var p = parts(day);
        if (i >= 35 && p.m !== state.m) break;
        var evs = state.byDay[day] || [];
        html += '<div class="cbc-cal-day' + (p.m !== state.m ? ' is-out' : '') + (day === state.today ? ' is-today' : '') + '">' +
          '<div class="cbc-cal-num">' + p.d + '</div><div class="cbc-cal-dots" style="display:contents">' +
          evs.map(function (idx) {
            var e = state.events[idx];
            var past = day < state.today;
            return '<button class="cbc-cal-chip' + (past ? ' is-past' : '') + '" data-ev="' + idx + '" title="' + esc(e.title) + '">' +
              (e.allDay ? '' : '<b>' + esc(hm(e.start).replace(':00', '').replace(' ', '').toLowerCase()) + '</b>') + esc(e.title) + '</button>';
          }).join('') + '</div></div>';
        day = addDays(day, 1);
      }
      html += '</div>';
    }

    if (state.view === 'list') {
      var list = monthEvents(), isNow = state.y + '-' + pad(state.m + 1) === state.today.slice(0, 7);
      if (isNow) {
        // current month: show what is still ahead, topped up from next month
        list = state.events.filter(function (e) { return (e.allDay ? dayOf(e.end) : dayOf(e.start)) >= state.today; });
        var inMonth = list.filter(function (e) { return dayOf(e.start).slice(0, 7) <= state.today.slice(0, 7); });
        list = inMonth.length >= 6 ? inMonth : list.slice(0, Math.max(6, inMonth.length));
      }
      html += '<div class="cbc-cal-list">' + (list.length ? list.map(function (e) { return card(e); }).join('')
        : '<div class="cbc-cal-empty">No events on the calendar for ' + MONTHS[state.m] + ' yet. Check back soon.</div>') + '</div>';
    }

    var cid = btoa(CAL);
    html += '<div class="cbc-cal-foot"><span>All times are Chicago time (CT).</span><div class="cbc-cal-actions">' +
      '<a class="cbc-cal-cta is-ghost" href="https://calendar.google.com/calendar/u/0?cid=' + cid + '" target="_blank" rel="noopener">Subscribe in Google Calendar</a>' +
      '<a class="cbc-cal-cta is-ghost" href="webcal://calendar.google.com/calendar/ical/' + encodeURIComponent(CAL) + '/public/basic.ics">Apple / Outlook</a>' +
      '</div></div>';
    root.innerHTML = html;
  }

  var modal = document.createElement('div');
  modal.className = 'cbc-cal cbc-cal-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  document.body.appendChild(modal);
  function closeModal() { modal.classList.remove('is-open'); modal.innerHTML = ''; }
  modal.addEventListener('click', function (ev) { if (ev.target === modal || ev.target.closest('.cbc-cal-close')) closeModal(); });
  document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') closeModal(); });

  root.addEventListener('click', function (ev) {
    var b = ev.target.closest('button');
    if (!b || !root.contains(b)) return;
    var act = b.getAttribute('data-act'), view = b.getAttribute('data-view'), idx = b.getAttribute('data-ev');
    if (act === 'prev' || act === 'next') {
      var k = state.y * 12 + state.m + (act === 'prev' ? -1 : 1);
      state.y = Math.floor(k / 12); state.m = k % 12; render();
    } else if (act === 'today') {
      var tp = parts(state.today); state.y = tp.y; state.m = tp.m; render();
    } else if (view) {
      state.view = view; render();
    } else if (idx != null) {
      modal.innerHTML = card(state.events[+idx], true);
      modal.classList.add('is-open');
    }
  });

  fetch(SRC, { cache: 'no-cache' }).then(function (r) { return r.json(); }).then(function (data) {
    state.events = (data.events || []).slice().sort(function (a, b) { return a.start < b.start ? -1 : 1; });
    state.events.forEach(function (e, i) {
      var d = dayOf(e.start), last = e.allDay ? dayOf(e.end) : d, guard = 0;
      while (d <= last && guard++ < 31) { (state.byDay[d] = state.byDay[d] || []).push(i); d = addDays(d, 1); }
    });
    var cur = state.y * 12 + state.m;
    if (state.events.length) {
      var a = parts(dayOf(state.events[0].start)), z = parts(dayOf(state.events[state.events.length - 1].start));
      state.min = Math.min(cur, a.y * 12 + a.m); state.max = Math.max(cur, z.y * 12 + z.m);
    } else { state.min = state.max = cur; }
    render();
  }).catch(function () {
    root.innerHTML = '<div class="cbc-cal-empty">The calendar could not load right now. <a href="https://calendar.google.com/calendar/embed?src=' + encodeURIComponent(CAL) + '&ctz=' + encodeURIComponent(TZ) + '" target="_blank" rel="noopener" style="color:var(--accent-yellow)">Open it in Google Calendar</a>.</div>';
  });
})();
