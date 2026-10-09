// Run once in DevTools Console on https://superrareshop.com/appointment.
// Uses your existing login only with the same site. Submits a real booking.
(async () => {
  const config = /*__BOOKING_CONFIG__*/;
  const { eventName, eventDate, allowedStartTimes } = config;
  const opensAt = Date.parse(config.opensAt);
  const closesAt = Date.parse(config.closesAt);
  const guardKey = 'superRareBooking:pending:' + eventDate;
  if (!eventName || !Number.isFinite(opensAt) || !Number.isFinite(closesAt) || closesAt <= opensAt) {
    throw new Error('Invalid booking configuration.');
  }
  if (location.origin !== 'https://superrareshop.com' ||
      location.pathname !== '/appointment') {
    throw new Error('Run this on https://superrareshop.com/appointment.');
  }
  if (window.superRareBooking?.running) {
    throw new Error('A booking script is already running in this tab.');
  }
  if (Date.now() >= closesAt) throw new Error('Booking window has ended.');
  const preference = allowedStartTimes.length ? 'earliest among ' + allowedStartTimes.join(', ') : 'earliest available';
  if (!confirm(`Submit ONE real appointment for ${eventName} on ${eventDate}, ${preference}? Opens ${config.opensAt}; closes ${config.closesAt}. Run in only one tab.`)) return;

  const control = window.superRareBooking = { running: true, stopped: false };
  control.stop = () => { control.stopped = true; console.log('Stopping; any request already submitted may still complete.'); };
  const check = () => {
    if (control.stopped) throw new Error('Stopped by you.');
    if (Date.now() >= closesAt) throw new Error('Booking window has ended.');
  };
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const log = (...args) => console.log('[Super Rare]', ...args);

  async function api(path, method = 'GET', body) {
    check();
    const saved = JSON.parse(localStorage.getItem('bb_auth_USER') || '{}');
    const token = saved.token || localStorage.getItem('bb_token');
    const device = localStorage.getItem('bb_device_id');
    if (!token || !device) throw new Error('Sign in and load the booking page first.');
    const response = await fetch('/api' + path, {
      method,
      credentials: 'same-origin',
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
      headers: {
        Authorization: 'Bearer ' + token,
        'X-Device-Id': device,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' })
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    const result = await response.json();
    if (!result || typeof result !== 'object' || typeof result.code !== 'number') {
      throw new Error('Unexpected API envelope. Stopping.');
    }
    if (!response.ok || result.code !== 0) {
      const error = new Error(result.message || ('HTTP ' + response.status));
      // Only a successful HTTP response with an explicit business rejection
      // can establish that the requested slot was rejected as full.
      error.slotFull = response.ok && typeof result.code === 'number' &&
        result.code !== 0 && result.message === '该时段已约满';
      error.notOpen = response.ok && typeof result.code === 'number' &&
        result.code !== 0 && ['该日预约未开放', '不在该日预约时间内'].includes(result.message);
      throw error;
    }
    return result.data;
  }
  function list(data) {
    if (!Array.isArray(data)) throw new Error('Unexpected API response. Stopping.');
    return data;
  }
  async function existing() {
    return list(await api('/appointments/mine?locale=en')).find(b =>
      String(b.slotDate).slice(0, 10) === eventDate &&
      !['CANCELLED', 'EXPIRED'].includes(b.status));
  }
  function showBooking(booking) {
    log('Booking record found:', booking);
    log('Verify your date, time and QR/booking code at https://superrareshop.com/appointment/codes');
    alert(`Booking record found for ${eventDate}. Open My booking codes to verify the event and time.`);
  }
  async function loadDay() {
    const matches = list(await api('/appointments/days?locale=en')).filter(d =>
      String(d.slotDate).slice(0, 10) === eventDate &&
      ((d.activityName || '') + ' ' + (d.venue || '')).toLowerCase().includes(eventName.toLowerCase()));
    if (matches.length !== 1 || matches[0].id == null) {
      throw new Error('Could not identify exactly one matching event day: ' + eventName);
    }
    if (!['BEFORE', 'OPEN'].includes(matches[0].bookState)) {
      throw new Error('Booking unavailable: ' + matches[0].bookState);
    }
    return matches[0];
  }
  async function waitUntil(time) {
    while (Date.now() < time) {
      check();
      await sleep(Math.max(1, Math.min(1000, time - Date.now())));
    }
    check();
  }

  try {
    const prior = await existing();
    if (prior) { sessionStorage.removeItem(guardKey); showBooking(prior); return; }
    if (sessionStorage.getItem(guardKey)) {
      throw new Error('An earlier submission is unresolved. Check My booking codes before any new attempt.');
    }
    // Resolve the day before opening, so joining does not wait on another GET.
    let day = await loadDay();
    log('Ready for', eventName, eventDate, 'opening', config.opensAt, '. Keep this tab visible and computer awake.');
    if (Date.now() < opensAt - 30000) {
      await waitUntil(opensAt - 30000);
      day = await loadDay();
      log('Event details refreshed. Ready to join at opening.');
    }
    await waitUntil(opensAt);

    // Only join at/after the published opening time. The server still decides
    // admission. Retry only an explicit not-open rejection, never an uncertain POST.
    let queue;
    for (let attempt = 0; attempt < 30; attempt++) {
      try {
        log('Joining queue at', new Date().toISOString());
        queue = await api(`/appointments/days/${encodeURIComponent(day.id)}/join`, 'POST');
        break;
      } catch (error) {
        if (!error.notOpen || attempt === 29) throw error;
        log('Server says booking is not open yet. Checking again in 4 seconds.');
        await sleep(4000);
      }
    }
    while (queue?.state !== 'ADMITTED') {
      if (!['QUEUING', 'HOLD'].includes(queue?.state)) {
        throw new Error('Queue ended or needs attention: ' + queue?.state);
      }
      log('Queue state:', queue.state);
      await sleep(4000);
      queue = await api(`/appointments/days/${encodeURIComponent(day.id)}/heartbeat`, 'POST');
    }
    log('Admitted. Looking for the', preference, 'slot.');
    const rejected = new Set();
    while (true) {
      const slots = list(await api(`/appointments/days/${encodeURIComponent(day.id)}/slots?locale=en`));
      const validCount = n => (typeof n === 'number' || (typeof n === 'string' && n.trim() !== '')) && Number.isFinite(Number(n)) && Number(n) >= 0;
      const validTime = t => typeof t === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(t);
      if (slots.some(s => !s || s.id == null || !validTime(s.startTime) || !validTime(s.endTime) || !validCount(s.quota) || !validCount(s.booked))) {
        throw new Error('Unexpected slot data. Stopping.');
      }
      const slot = slots.filter(s => Number(s.quota) > Number(s.booked) && !rejected.has(s.id) &&
        (!allowedStartTimes.length || allowedStartTimes.includes(s.startTime.slice(0, 5))))
        .sort((a, b) => String(a.startTime).localeCompare(String(b.startTime)))[0];
      if (!slot) throw new Error('No matching available slots remain for ' + eventDate);
      log('Submitting:', eventDate, slot.startTime, '–', slot.endTime);
      check();
      sessionStorage.setItem(guardKey, JSON.stringify({ slotId: slot.id, attemptedAt: new Date().toISOString() }));
      try {
        await api('/appointments', 'POST', { slotId: slot.id });
      } catch (error) {
        if (error.slotFull) {
          sessionStorage.removeItem(guardKey);
          rejected.add(slot.id);
          log('That slot filled. Trying the next earliest.');
          continue;
        }
        // Never repeat an uncertain submission; check for an existing booking.
        log('Submission not confirmed. Checking your bookings before stopping.');
        const found = await existing();
        if (found) { sessionStorage.removeItem(guardKey); showBooking(found); return; }
        throw new Error('Submission outcome uncertain or rejected: ' + error.message + '. Check My booking codes; this script will not resubmit.');
      }
      log('Server accepted the booking. Verifying the saved record.');
      const found = await existing();
      if (found) { sessionStorage.removeItem(guardKey); showBooking(found); }
      else log('Booking accepted, but record not yet visible. Check My booking codes. Do not submit again.');
      return;
    }
  } catch (error) {
    console.error('[Super Rare] Stopped:', error.message);
    console.log('Check the booking page and My booking codes before any new attempt.');
  } finally {
    control.running = false;
  }
})();
