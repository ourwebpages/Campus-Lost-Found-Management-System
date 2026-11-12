/* ============================================================
   Campus Lost & Found — Lovely Professional University
   script.js · Vanilla ES6+ · LocalStorage only · No dependencies

   Contents
   01 State, keys & constants
   02 Storage adapter
   03 Utilities
   04 Seed data
   05 Domain: filtering & status
   06 Home view
   07 Browse view
   08 Item details
   09 Claim requests
   10 Report form & drafts
   11 My Reports
   12 Navigation & mobile menu
   13 FAQ
   14 Toasts
   15 Boot
   ============================================================ */

(() => {
  'use strict';

  /* ---------- 01 State, keys & constants ---------- */

  const KEYS = {
    items: 'clf.items.v1',
    claims: 'clf.claims.v1',
    profile: 'clf.profile.v1',
    draft: 'clf.draft.v1'
  };

  const CATEGORIES = [
    'Electronics',
    'ID Cards',
    'Books/Notes',
    'Keys',
    'Personal Accessories',
    'Other'
  ];

  const LOCATIONS = [
    'Uni Mall',
    'Main Library',
    'Student Welfare',
    'Science Hall',
    'Recreation Center',
    'Arts Building',
    'Other'
  ];

  const STATUS_LABELS = {
    still_looking: 'Still looking',
    matched: 'Matched',
    returned: 'Returned',
    ready_to_claim: 'Ready to claim',
    claimed: 'Claimed',
    pending_verification: 'Pending verification',
    approved: 'Approved',
    rejected: 'Rejected'
  };

  const STATUS_TONES = {
    still_looking: 'status--looking',
    ready_to_claim: 'status--ready',
    matched: 'status--matched',
    claimed: 'status--claimed',
    returned: 'status--returned',
    pending_verification: 'status--looking',
    approved: 'status--ready',
    rejected: 'status--returned'
  };

  /** @type {Array<object>} all item reports (seed + user) */
  let items = [];
  /** @type {Array<object>} all claim requests */
  let claims = [];
  /** @type {{currentEmail: string}} local demo profile */
  let profile = { currentEmail: '' };

  const browseFilters = { tab: 'lost', category: 'all', location: 'all', keyword: '' };
  const myReportsState = { email: '', tab: 'lost' };

  let reportType = 'lost';
  let pendingImage = null;      // { dataUrl, name, size }
  let activeDetailId = null;
  let activeClaimItemId = null;
  let pendingDeleteId = null;
  let pendingDeleteFromAdmin = false;
  let lastFocused = null;

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

  /* ---------- 02 Storage adapter ---------- */

  function loadFromStorage(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null || raw === '') return fallback;
      const parsed = JSON.parse(raw);

      // Validate the parsed value against the shape the caller expects.
      if (Array.isArray(fallback)) {
        return Array.isArray(parsed) ? parsed : fallback;
      }
      if (fallback !== null && typeof fallback === 'object') {
        return (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed))
          ? parsed
          : fallback;
      }
      return parsed;
    } catch (error) {
      console.warn('[CLF] Could not read', key, error);
      return fallback;
    }
  }

  function saveToStorage(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.warn('[CLF] Could not write', key, error);
      return false;
    }
  }

  /* ---------- 03 Utilities ---------- */

  function h(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    Object.entries(attrs).forEach(([name, value]) => {
      if (value === null || value === undefined || value === false) return;
      if (name === 'class') node.className = value;
      else if (name === 'dataset') Object.assign(node.dataset, value);
      else if (name === 'text') node.textContent = value;
      else if (name.startsWith('on') && typeof value === 'function') {
        node.addEventListener(name.slice(2).toLowerCase(), value);
      } else if (value === true) node.setAttribute(name, '');
      else node.setAttribute(name, value);
    });
    children.flat().forEach(child => {
      if (child === null || child === undefined || child === false) return;
      node.append(child instanceof Node ? child : document.createTextNode(String(child)));
    });
    return node;
  }

  function icon(paths, size) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('class', 'icon');
    if (size) {
      svg.setAttribute('width', size);
      svg.setAttribute('height', size);
    }
    (Array.isArray(paths) ? paths : [paths]).forEach(d => {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', d);
      svg.append(path);
    });
    return svg;
  }

  const ICONS = {
    pin: icon(['M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z', 'M12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z']),
    calendar: icon(['M8 3v3M16 3v3M4 9h16', 'M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z']),
    arrow: icon('M5 12h13M13 6l6 6-6 6'),
    shield: icon(['M12 21s7-3.6 7-9V5.5L12 2.5 5 5.5V12c0 5.4 7 9 7 9Z', 'm9 11.5 2 2 4-4'])
  };

  function formatDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function todayISO() {
    const now = new Date();
    const offset = now.getTimezoneOffset();
    return new Date(now.getTime() - offset * 60000).toISOString().slice(0, 10);
  }

  function isFutureDate(value) {
    return value > todayISO();
  }

  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((value || '').trim());
  }

  function statusLabel(status) {
    return STATUS_LABELS[status] || status;
  }

  function statusTone(status) {
    return STATUS_TONES[status] || 'status--returned';
  }

  function typeLabel(type) {
    return type === 'lost' ? 'Lost' : 'Found';
  }

  function countByType(type) {
    return items.filter(item => item.type === type).length;
  }

  function imageFor(item) {
    return item.imageDataUrl || item.image || 'assets/images/item-glasses.svg';
  }

  /* ---------- 04 Seed data ---------- */

  function seedSampleItems() {
    const base = Date.UTC(2026, 10, 10, 9, 30);
    const stamp = minutesBefore => new Date(base - minutesBefore * 60000).toISOString();

    return [
      {
        id: 'F-2026-1042', type: 'found', itemName: 'Black wireless headphones',
        category: 'Electronics',
        description: 'Over-ear headphones left on a bench near the food court. Small scratch on the left ear cup and a silver star sticker inside the band.',
        location: 'Uni Mall', specificSpot: 'Food court bench near the east entrance',
        itemDate: '2026-11-10', contactName: 'Aarav Mehta', contactEmail: 'aarav.mehta@lpu.in',
        contactPhone: '', image: 'assets/images/item-headphones.svg', imageDataUrl: null,
        status: 'ready_to_claim', createdAt: stamp(20), updatedAt: stamp(20), isSample: true
      },
      {
        id: 'L-2026-1041', type: 'lost', itemName: 'Orange leather wallet',
        category: 'Personal Accessories',
        description: 'Slim orange wallet with the initials RS embossed on the front. Holds my student card and a library slip.',
        location: 'Main Library', specificSpot: 'Second floor quiet reading area',
        itemDate: '2026-11-09', contactName: 'Riya Sharma', contactEmail: 'riya.sharma@lpu.in',
        contactPhone: '', image: 'assets/images/item-wallet.svg', imageDataUrl: null,
        status: 'still_looking', createdAt: stamp(150), updatedAt: stamp(150), isSample: true
      },
      {
        id: 'F-2026-1040', type: 'found', itemName: 'Student ID card with blue lanyard',
        category: 'ID Cards',
        description: 'LPU student card found on the staircase, first year, name partly covered by the lanyard clip. Kept safely at the department desk.',
        location: 'Science Hall', specificSpot: 'Staircase between floors 2 and 3',
        itemDate: '2026-11-09', contactName: 'Kabir Anand', contactEmail: 'kabir.anand@lpu.in',
        contactPhone: '', image: 'assets/images/item-id-card.svg', imageDataUrl: null,
        status: 'ready_to_claim', createdAt: stamp(300), updatedAt: stamp(300), isSample: true
      },
      {
        id: 'L-2026-1039', type: 'lost', itemName: 'Silver key ring, four keys',
        category: 'Keys',
        description: 'Four keys on a silver ring with a small red carabiner. One key has a blue rubber cover, one is a padlock key.',
        location: 'Arts Building', specificSpot: 'Corridor outside room 201',
        itemDate: '2026-11-08', contactName: 'Sneha Iyer', contactEmail: 'sneha.iyer@lpu.in',
        contactPhone: '', image: 'assets/images/item-keys.svg', imageDataUrl: null,
        status: 'still_looking', createdAt: stamp(520), updatedAt: stamp(520), isSample: true
      },
      {
        id: 'F-2026-1038', type: 'found', itemName: 'Sage green insulated bottle',
        category: 'Personal Accessories',
        description: '750 ml bottle with a flip lid and a small mountain sticker near the base. Slight dent at the bottom.',
        location: 'Recreation Center', specificSpot: 'Courtside bench, indoor arena',
        itemDate: '2026-11-08', contactName: 'Dev Patel', contactEmail: 'dev.patel@lpu.in',
        contactPhone: '', image: 'assets/images/item-bottle.svg', imageDataUrl: null,
        status: 'ready_to_claim', createdAt: stamp(700), updatedAt: stamp(700), isSample: true
      },
      {
        id: 'L-2026-1037', type: 'lost', itemName: 'Biology lecture notebook',
        category: 'Books/Notes',
        description: 'A5 spiral notebook, dark green cover, unit 3 and 4 notes inside. My name is written on the inside cover.',
        location: 'Science Hall', specificSpot: 'Room 204, last bench',
        itemDate: '2026-11-07', contactName: 'Ananya Rao', contactEmail: 'ananya.rao@lpu.in',
        contactPhone: '', image: 'assets/images/item-notebook.svg', imageDataUrl: null,
        status: 'matched', createdAt: stamp(900), updatedAt: stamp(60), isSample: true
      },
      {
        id: 'F-2026-1036', type: 'found', itemName: 'Casio scientific calculator',
        category: 'Electronics',
        description: 'Black Casio fx-991, name sticker peeled off the back. Found after the evening lab session.',
        location: 'Main Library', specificSpot: 'Group study room 2',
        itemDate: '2026-11-06', contactName: 'Ishaan Verma', contactEmail: 'ishaan.verma@lpu.in',
        contactPhone: '', image: 'assets/images/item-calculator.svg', imageDataUrl: null,
        status: 'ready_to_claim', createdAt: stamp(1150), updatedAt: stamp(1150), isSample: true
      },
      {
        id: 'L-2026-1035', type: 'lost', itemName: 'LPU navy hoodie',
        category: 'Personal Accessories',
        description: 'Navy blue hoodie, size M, university crest on the chest. Left it after the morning lecture.',
        location: 'Uni Mall', specificSpot: 'Café seating on the first floor',
        itemDate: '2026-11-06', contactName: 'Meera Nair', contactEmail: 'meera.nair@lpu.in',
        contactPhone: '', image: 'assets/images/item-hoodie.svg', imageDataUrl: null,
        status: 'still_looking', createdAt: stamp(1400), updatedAt: stamp(1400), isSample: true
      },
      {
        id: 'F-2026-1034', type: 'found', itemName: 'Reading glasses in a brown case',
        category: 'Other',
        description: 'Thin metal frame glasses inside a brown hard case. Found on a table at the welfare waiting area.',
        location: 'Student Welfare', specificSpot: 'Waiting area, near the notice board',
        itemDate: '2026-11-05', contactName: 'Farah Khan', contactEmail: 'farah.khan@lpu.in',
        contactPhone: '', image: 'assets/images/item-glasses.svg', imageDataUrl: null,
        status: 'returned', createdAt: stamp(1800), updatedAt: stamp(400), isSample: true
      },
      {
        id: 'L-2026-1033', type: 'lost', itemName: 'University Physics, 15th edition',
        category: 'Books/Notes',
        description: 'Young and Freedman textbook with highlighted chapters 3 to 5. My roll number is written on the first page.',
        location: 'Student Welfare', specificSpot: 'Left on a chair outside the help desk',
        itemDate: '2026-11-04', contactName: 'Rohan Das', contactEmail: 'rohan.das@lpu.in',
        contactPhone: '', image: 'assets/images/item-book.svg', imageDataUrl: null,
        status: 'still_looking', createdAt: stamp(2200), updatedAt: stamp(2200), isSample: true
      },
      {
        id: 'F-2026-1032', type: 'found', itemName: 'Black wireless earbuds case',
        category: 'Electronics',
        description: 'Charging case with both earbuds inside, no cable. Found under a bench at the arts block.',
        location: 'Arts Building', specificSpot: 'Open air theatre seating',
        itemDate: '2026-11-03', contactName: 'Zoya Ahmed', contactEmail: 'zoya.ahmed@lpu.in',
        contactPhone: '', image: 'assets/images/item-headphones.svg', imageDataUrl: null,
        status: 'returned', createdAt: stamp(2600), updatedAt: stamp(500), isSample: true
      },
      {
        id: 'L-2026-1031', type: 'lost', itemName: 'Set of hostel room keys',
        category: 'Keys',
        description: 'Two keys with a green tag, room number written on the tag in marker. Lost somewhere between the mess and the hostel gate.',
        location: 'Other', specificSpot: 'Path between the mess and hostel block C',
        itemDate: '2026-11-02', contactName: 'Nikhil Bose', contactEmail: 'nikhil.bose@lpu.in',
        contactPhone: '', image: 'assets/images/item-keys.svg', imageDataUrl: null,
        status: 'returned', createdAt: stamp(3100), updatedAt: stamp(800), isSample: true
      }
    ];
  }

  /* ---------- 05 Domain: filtering & status ---------- */

  function getVisibleItems(list, filters) {
    const keyword = filters.keyword.trim().toLowerCase();

    return list.filter(item => {
      if (filters.tab && item.type !== filters.tab) return false;
      if (filters.category !== 'all' && item.category !== filters.category) return false;
      if (filters.location !== 'all' && item.location !== filters.location) return false;
      if (keyword) {
        const haystack = [item.itemName, item.description, item.specificSpot, item.location]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(keyword)) return false;
      }
      return true;
    });
  }

  function createUniqueId(prefix) {
    const year = new Date().getFullYear();
    const taken = new Set([...items.map(item => item.id), ...claims.map(claim => claim.id)]);
    let candidate;
    do {
      candidate = `${prefix}-${year}-${Math.floor(1000 + Math.random() * 9000)}`;
    } while (taken.has(candidate));
    return candidate;
  }

  /* ---------- 06 Home view ---------- */

  function renderHome() {
    const lost = countByType('lost');
    const found = countByType('found');
    const returned = items.filter(item => item.status === 'returned').length;

    const setText = (selector, value) => {
      const node = $(selector);
      if (node) node.textContent = value;
    };
    setText('#stat-lost', lost);
    setText('#stat-found', found);
    setText('#stat-returned', returned);
    const floatStat = $('[data-stat="returned-float"]');
    if (floatStat) floatStat.textContent = returned;

    renderCategoryShortcuts();
    renderRecentItems();
  }

  function categoryIcon(category) {
    switch (category) {
      case 'Electronics':
        return icon(['M3 5h18v10H3z', 'M8 19h8M12 15v4']);
      case 'ID Cards':
        return icon(['M3 6h18v12H3z', 'M3 10h18', 'M7 15h4']);
      case 'Books/Notes':
        return icon(['M5 4h11a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2Z', 'M9 8h6M9 12h6']);
      case 'Keys':
        return icon(['M14 7a4 4 0 1 0-3.5 4L9 12.5V15H6.5v2.5H4V20h4l6-6a4 4 0 0 0 0-7Z']);
      case 'Personal Accessories':
        return icon(['M6 8h12l1 12H5Z', 'M9 8V6a3 3 0 0 1 6 0v2']);
      default:
        return icon(['M4 7h16v13H4z', 'M9 7V4h6v3', 'M9 12h6']);
    }
  }

  function renderCategoryShortcuts() {
    const container = $('#category-shortcuts');
    if (!container) return;
    container.textContent = '';

    CATEGORIES.forEach(category => {
      const total = items.filter(item => item.category === category).length;
      const arrow = ICONS.arrow.cloneNode(true);
      arrow.classList.add('category-arrow');

      const card = h('button', {
        class: 'category-card',
        type: 'button',
        dataset: { category },
        'aria-label': `Show ${total} ${category} item${total === 1 ? '' : 's'}`
      },
        h('span', { class: 'category-icon' }, categoryIcon(category)),
        h('span', { class: 'category-text' },
          h('span', { class: 'category-name', text: category }),
          h('span', { class: 'category-count', text: `${total} item${total === 1 ? '' : 's'}` })
        ),
        arrow
      );

      card.addEventListener('click', () => {
        const lostHere = items.filter(i => i.type === 'lost' && i.category === category).length;
        const foundHere = items.filter(i => i.type === 'found' && i.category === category).length;
        browseFilters.category = category;
        browseFilters.location = 'all';
        browseFilters.keyword = '';
        browseFilters.tab = lostHere === 0 && foundHere > 0 ? 'found' : 'lost';
        syncBrowseControls();
        showView('browse');
      });

      container.append(card);
    });
  }

  function renderRecentItems() {
    const container = $('#recent-grid');
    if (!container) return;
    container.textContent = '';

    const recent = [...items]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 6);

    if (!recent.length) {
      container.append(h('p', { class: 'result-count', text: 'No items on the board yet.' }));
      return;
    }

    recent.forEach(item => container.append(buildItemCard(item)));
  }

  function buildItemCard(item) {
    const media = h('div', { class: 'item-media' },
      h('img', {
        src: imageFor(item),
        alt: item.imageDataUrl ? `Photo of ${item.itemName}` : `Illustration of ${item.itemName}`,
        loading: 'lazy'
      }),
      h('span', { class: `item-badge item-badge--${item.type}`, text: typeLabel(item.type) })
    );

    const meta = h('ul', { class: 'item-meta' },
      h('li', {}, ICONS.pin.cloneNode(true), `${item.location}${item.specificSpot ? ' · ' + item.specificSpot : ''}`),
      h('li', {}, ICONS.calendar.cloneNode(true), formatDate(item.itemDate))
    );

    const foot = h('div', { class: 'item-foot' },
      h('span', { class: `status ${statusTone(item.status)}`, text: statusLabel(item.status) }),
      h('button', {
        class: 'item-link',
        type: 'button',
        dataset: { id: item.id },
        'aria-label': `View details for ${item.itemName}`
      }, 'View details', ICONS.arrow.cloneNode(true))
    );

    const card = h('article', { class: 'item-card' },
      media,
      h('div', { class: 'item-content' },
        h('span', { class: 'item-category', text: item.category }),
        h('h3', { class: 'item-title', text: item.itemName }),
        h('p', { class: 'item-desc', text: item.description || 'No description provided.' }),
        meta,
        foot
      )
    );

    card.addEventListener('click', event => {
      if (event.target.closest('button')) return;
      openItemDetails(item.id);
    });
    foot.querySelector('.item-link').addEventListener('click', () => openItemDetails(item.id));

    return card;
  }

  /* ---------- 07 Browse view ---------- */

  function syncBrowseControls() {
    const search = $('#filter-search');
    const category = $('#filter-category');
    const location = $('#filter-location');
    if (search) search.value = browseFilters.keyword;
    if (category) category.value = browseFilters.category;
    if (location) location.value = browseFilters.location;

    $$('.board-tab[data-tab]').forEach(tab => {
      const isActive = tab.dataset.tab === browseFilters.tab;
      tab.classList.toggle('is-active', isActive);
      tab.setAttribute('aria-selected', String(isActive));
    });
    const panel = $('#browse-grid');
    if (panel) panel.setAttribute('aria-labelledby', browseFilters.tab === 'found' ? 'tab-found' : 'tab-lost');
  }

  function renderBrowse() {
    syncBrowseControls();

    const grid = $('#browse-grid');
    const empty = $('#browse-empty');
    const count = $('#browse-count');
    if (!grid) return;

    const visible = getVisibleItems(items, browseFilters);
    grid.textContent = '';

    $$('[data-tab-count]').forEach(node => {
      node.textContent = countByType(node.dataset.tabCount);
    });

    visible.forEach(item => grid.append(buildItemCard(item)));

    if (count) {
      const lostTotal = countByType('lost');
      const foundTotal = countByType('found');
      count.textContent = `${visible.length} ${visible.length === 1 ? 'item' : 'items'} matching your filters · ${lostTotal} lost · ${foundTotal} found`;
    }

    const isEmpty = visible.length === 0;
    grid.hidden = isEmpty;
    if (empty) empty.hidden = !isEmpty;

    if (isEmpty) {
      const otherTab = browseFilters.tab === 'lost' ? 'found' : 'lost';
      const otherVisible = getVisibleItems(items, { ...browseFilters, tab: otherTab });
      const title = $('#browse-empty-title');
      const text = $('#browse-empty-text');
      if (otherVisible.length > 0 && title && text) {
        title.textContent = `No ${browseFilters.tab} items match`;
        text.textContent = `${otherVisible.length} ${otherTab} item${otherVisible.length === 1 ? '' : 's'} match this search — try the ${otherTab} items tab.`;
      } else if (title && text) {
        title.textContent = 'No items match this search';
        text.textContent = 'Try a shorter keyword, choose another category or location, then search again.';
      }
    }
  }

  function initBrowse() {
    $$('.board-tab[data-tab]').forEach(tab => {
      tab.addEventListener('click', () => {
        browseFilters.tab = tab.dataset.tab;
        renderBrowse();
      });
    });

    const search = $('#filter-search');
    if (search) {
      let timer = null;
      search.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          browseFilters.keyword = search.value;
          renderBrowse();
        }, 180);
      });
    }

    const category = $('#filter-category');
    if (category) {
      category.addEventListener('change', () => {
        browseFilters.category = category.value;
        renderBrowse();
      });
    }

    const location = $('#filter-location');
    if (location) {
      location.addEventListener('change', () => {
        browseFilters.location = location.value;
        renderBrowse();
      });
    }

    const reset = () => {
      browseFilters.category = 'all';
      browseFilters.location = 'all';
      browseFilters.keyword = '';
      renderBrowse();
    };
    ['#clear-filters', '#empty-clear'].forEach(selector => {
      const button = $(selector);
      if (button) button.addEventListener('click', reset);
    });
  }

  /* ---------- 08 Item details ---------- */

  function openItemDetails(id) {
    const item = items.find(entry => entry.id === id);
    if (!item) return;

    activeDetailId = id;
    lastFocused = document.activeElement;

    const modal = $('#detail-modal');
    const image = $('#detail-image');
    const body = $('#detail-body');
    if (!modal || !image || !body) return;

    image.src = imageFor(item);
    image.alt = item.imageDataUrl ? `Photo of ${item.itemName}` : `Illustration of ${item.itemName}`;

    body.textContent = '';

    const badges = h('div', { class: 'detail-badges' },
      h('span', { class: `item-badge item-badge--${item.type}`, text: typeLabel(item.type) }),
      h('span', { class: `status ${statusTone(item.status)}`, text: statusLabel(item.status) })
    );

    const rows = [
      ['Category', item.category],
      [item.type === 'lost' ? 'Last seen at' : 'Found at', item.location],
      ['Specific spot', item.specificSpot || 'Not specified'],
      ['Date', formatDate(item.itemDate)],
      ['Report ID', item.id]
    ];

    const list = h('dl', { class: 'detail-list' },
      rows.map(([label, value]) => h('div', { class: 'detail-row' },
        h('dt', { text: label }),
        h('dd', { text: value })
      ))
    );

    const actions = h('div', { class: 'detail-actions' });

    if (item.type === 'found') {
      if (item.status === 'ready_to_claim') {
        actions.append(h('button', {
          class: 'btn btn-primary btn-large',
          type: 'button',
          onclick: () => openClaimForm(item.id)
        }, 'Claim this item', ICONS.arrow.cloneNode(true)));
      } else if (item.status === 'returned') {
        actions.append(h('p', { class: 'detail-note' }, ICONS.shield.cloneNode(true),
          'This item has already been returned to its owner.'));
      } else {
        actions.append(h('p', { class: 'detail-note' }, ICONS.shield.cloneNode(true),
          'A claim is already in progress for this item.'));
      }
    } else {
      actions.append(h('button', {
        class: 'btn btn-outline',
        type: 'button',
        onclick: () => {
          closeModal('detail-modal');
          openReportForm('found');
        }
      }, 'I found this item — report it', ICONS.arrow.cloneNode(true)));
    }

    actions.append(h('p', { class: 'detail-note' }, ICONS.shield.cloneNode(true),
      'Contact details are private. Claims are reviewed by the reporter; verification in this demo is simulated.'));

    body.append(
      badges,
      h('h2', { class: 'detail-title', id: 'detail-title', text: item.itemName }),
      h('p', { class: 'detail-desc', text: item.description || 'No description provided.' }),
      list,
      actions
    );

    openModal('detail-modal');
  }

  /* ---------- 09 Claim requests ---------- */

  function openClaimForm(itemId) {
    const item = items.find(entry => entry.id === itemId);
    if (!item) return;

    activeClaimItemId = itemId;
    const form = $('#claim-form');
    if (form) form.reset();
    clearFormErrors(form);

    const idField = $('#claim-item-id');
    if (idField) idField.value = itemId;
    const nameLine = $('#claim-item-name');
    if (nameLine) nameLine.textContent = item.itemName;

    closeModal('detail-modal', false);
    openModal('claim-modal');
  }

  function validateClaim() {
    const errors = {};
    const name = ($('#claim-name') || {}).value || '';
    const email = ($('#claim-email') || {}).value || '';
    const detail = ($('#claim-detail') || {}).value || '';

    if (!name.trim()) errors.claimantName = 'Please enter your name.';
    else if (name.trim().length < 2) errors.claimantName = 'Please enter your full name.';

    if (!email.trim()) errors.claimantEmail = 'Your campus email is required.';
    else if (!isValidEmail(email)) errors.claimantEmail = 'Enter a valid email address, e.g. your.name@lpu.in.';

    if (!detail.trim()) errors.identifyingDetail = 'Describe something only the owner would know.';
    else if (detail.trim().length < 12) errors.identifyingDetail = 'Add a little more detail (at least 12 characters).';

    return errors;
  }

  function submitClaim(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const errors = validateClaim();
    clearFormErrors(form);

    if (Object.keys(errors).length) {
      showFormErrors(form, errors, {
        claimantName: '#claim-name',
        claimantEmail: '#claim-email',
        identifyingDetail: '#claim-detail'
      });
      return;
    }

    if (!activeClaimItemId) {
      showToast('This item is no longer available.', 'error');
      return;
    }

    const now = new Date().toISOString();
    const claim = {
      id: createUniqueId('C'),
      itemId: activeClaimItemId,
      claimantName: $('#claim-name').value.trim(),
      claimantEmail: $('#claim-email').value.trim(),
      identifyingDetail: $('#claim-detail').value.trim(),
      proofDescription: ($('#claim-proof').value || '').trim(),
      status: 'pending_verification',
      createdAt: now,
      updatedAt: now
    };

    claims.push(claim);
    if (!saveToStorage(KEYS.claims, claims)) {
      claims.pop();
      showToast('Browser storage is full, so the claim could not be saved.', 'error');
      return;
    }

    const claimedEmail = claim.claimantEmail;
    form.reset();
    closeModal('claim-modal');
    activeClaimItemId = null;

    showToast(`Claim submitted. Reference ${claim.id} — status: pending verification (simulated).`, 'success');

    if (myReportsState.email && myReportsState.email.toLowerCase() === claimedEmail.toLowerCase()) {
      renderMyReports();
    }
  }

  /* ---------- 10 Report form & drafts ---------- */

  function setReportType(type) {
    reportType = type === 'found' ? 'found' : 'lost';

    $$('.type-option').forEach(option => {
      const isActive = option.dataset.type === reportType;
      option.classList.toggle('is-active', isActive);
      option.setAttribute('aria-pressed', String(isActive));
    });

    const label = $('#report-location-label');
    if (label) {
      label.textContent = reportType === 'lost' ? 'Location last seen' : 'Location found';
      label.append(h('span', { class: 'req', 'aria-hidden': 'true', text: '*' }));
    }
  }

  function openReportForm(type) {
    setReportType(type || 'lost');
    showReportForm();
    showView('report');
  }

  function showReportForm() {
    const body = $('#report-form-body');
    const success = $('#report-success');
    if (body) body.hidden = false;
    if (success) success.hidden = true;
  }

  function showReportSuccess(reportId) {
    const body = $('#report-form-body');
    const success = $('#report-success');
    const idNode = $('#report-success-id');
    if (body) body.hidden = true;
    if (success) success.hidden = false;
    if (idNode) idNode.textContent = reportId;
    const panel = $('#report-success');
    if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function readReportForm() {
    return {
      itemName: ($('#report-item-name') || {}).value || '',
      category: ($('#report-category') || {}).value || '',
      location: ($('#report-location') || {}).value || '',
      specificSpot: ($('#report-spot') || {}).value || '',
      itemDate: ($('#report-date') || {}).value || '',
      description: ($('#report-description') || {}).value || '',
      contactName: ($('#report-name') || {}).value || '',
      contactEmail: ($('#report-email') || {}).value || '',
      contactPhone: ($('#report-phone') || {}).value || ''
    };
  }

  function validateReport(data) {
    const errors = {};

    if (!data.itemName.trim()) errors.itemName = 'Give the item a short, recognisable name.';
    else if (data.itemName.trim().length < 3) errors.itemName = 'Use at least 3 characters.';
    else if (data.itemName.trim().length > 100) errors.itemName = 'Keep the name under 100 characters.';

    if (!data.category) errors.category = 'Choose the closest category.';
    else if (!CATEGORIES.includes(data.category)) errors.category = 'Choose a category from the list.';

    if (!data.location) errors.location = 'Choose the campus location.';
    else if (!LOCATIONS.includes(data.location)) errors.location = 'Choose a location from the list.';

    if (!data.itemDate) errors.itemDate = 'Pick the date you lost or found it.';
    else if (isFutureDate(data.itemDate)) errors.itemDate = 'The date cannot be in the future.';

    if (!data.contactName.trim()) errors.contactName = 'Please add your name.';

    if (!data.contactEmail.trim()) errors.contactEmail = 'Your campus email is required.';
    else if (!isValidEmail(data.contactEmail)) errors.contactEmail = 'Enter a valid email such as your.name@lpu.in.';

    if (data.description.length > 500) errors.description = 'Keep the description under 500 characters.';
    if (data.specificSpot.length > 80) errors.specificSpot = 'Keep the spot under 80 characters.';
    if (data.contactPhone && data.contactPhone.replace(/\D/g, '').length < 7) {
      errors.contactPhone = 'That phone number looks too short.';
    }

    return errors;
  }

  function submitReport(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const data = readReportForm();
    const errors = validateReport(data);

    clearFormErrors(form);
    if (Object.keys(errors).length) {
      showFormErrors(form, errors, {
        itemName: '#report-item-name',
        category: '#report-category',
        location: '#report-location',
        specificSpot: '#report-spot',
        itemDate: '#report-date',
        description: '#report-description',
        contactName: '#report-name',
        contactEmail: '#report-email',
        contactPhone: '#report-phone'
      });
      return;
    }

    const now = new Date().toISOString();
    const item = {
      id: createUniqueId(reportType === 'lost' ? 'L' : 'F'),
      type: reportType,
      itemName: data.itemName.trim(),
      category: data.category,
      description: data.description.trim(),
      location: data.location,
      specificSpot: data.specificSpot.trim(),
      itemDate: data.itemDate,
      contactName: data.contactName.trim(),
      contactEmail: data.contactEmail.trim(),
      contactPhone: data.contactPhone.trim(),
      image: null,
      imageDataUrl: pendingImage ? pendingImage.dataUrl : null,
      status: reportType === 'lost' ? 'still_looking' : 'ready_to_claim',
      createdAt: now,
      updatedAt: now,
      isSample: false
    };

    items.push(item);
    if (!saveToStorage(KEYS.items, items)) {
      // Retry without the photo before giving up: LocalStorage quota is tight.
      item.imageDataUrl = null;
      if (!saveToStorage(KEYS.items, items)) {
        items.pop();
        showToast('Browser storage is full. Remove the photo and try again.', 'error');
        return;
      }
      showToast('Report saved, but the photo was too large to store.', 'info');
    }

    // The report is safe: clear the draft, the form and the image preview.
    try { localStorage.removeItem(KEYS.draft); } catch (error) { /* ignore */ }
    form.reset();
    setReportType('lost');
    clearImage();
    updateDescriptionCount();
    setDateMax();

    renderHome();
    renderBrowse();
    if (myReportsState.email) renderMyReports();

    showReportSuccess(item.id);
    showToast(`Report published. Reference ${item.id}.`, 'success');
  }

  function updateDescriptionCount() {
    const field = $('#report-description');
    const output = $('#description-count');
    if (field && output) output.textContent = field.value.length;
  }

  function setDateMax() {
    const field = $('#report-date');
    if (field) field.max = todayISO();
  }

  function saveDraft() {
    const data = readReportForm();
    const draft = { ...data, type: reportType, savedAt: new Date().toISOString() };

    if (!saveToStorage(KEYS.draft, draft)) {
      showToast('Could not save the draft — browser storage is full.', 'error');
      return;
    }
    showToast('Draft saved just now — only you can see it.', 'success');
  }

  function restoreDraft() {
    const draft = loadFromStorage(KEYS.draft, null);
    if (!draft || typeof draft !== 'object') return;

    setReportType(draft.type);
    const map = {
      '#report-item-name': draft.itemName,
      '#report-category': draft.category,
      '#report-location': draft.location,
      '#report-spot': draft.specificSpot,
      '#report-date': draft.itemDate,
      '#report-description': draft.description,
      '#report-name': draft.contactName,
      '#report-email': draft.contactEmail,
      '#report-phone': draft.contactPhone
    };
    Object.entries(map).forEach(([selector, value]) => {
      const field = $(selector);
      if (field && value) field.value = value;
    });
    updateDescriptionCount();
  }

  async function handleImage(file) {
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png'];
    const allowedExt = /\.(jpe?g|png)$/i;
    if (!allowedTypes.includes(file.type) || !allowedExt.test(file.name)) {
      showToast('Choose a JPG or PNG image.', 'error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('That image is larger than 5 MB. Pick a smaller file.', 'error');
      return;
    }

    try {
      const dataUrl = await resizeImage(file);
      pendingImage = { dataUrl, name: file.name, size: file.size };

      const preview = $('#upload-preview');
      const empty = $('#upload-empty');
      const img = $('#preview-image');
      const name = $('#preview-name');
      if (img) img.src = dataUrl;
      if (name) {
        const kb = Math.round(file.size / 1024);
        name.textContent = `${file.name} · ${kb > 1024 ? (kb / 1024).toFixed(1) + ' MB' : kb + ' KB'}`;
      }
      if (preview) preview.hidden = false;
      if (empty) empty.hidden = true;
    } catch (error) {
      console.warn('[CLF] Image processing failed', error);
      showToast('That image could not be read. Try another file.', 'error');
    }
  }

  function resizeImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Could not read file'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('Could not decode image'));
        img.onload = () => {
          const maxEdge = 1200;
          const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          const context = canvas.getContext('2d');
          context.fillStyle = '#ffffff';
          context.fillRect(0, 0, canvas.width, canvas.height);
          context.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.82));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function clearImage() {
    pendingImage = null;
    const input = $('#report-image');
    const preview = $('#upload-preview');
    const empty = $('#upload-empty');
    const img = $('#preview-image');
    if (input) input.value = '';
    if (img) img.removeAttribute('src');
    if (preview) preview.hidden = true;
    if (empty) empty.hidden = false;
  }

  function initReport() {
    setDateMax();
    setReportType('lost');
    updateDescriptionCount();

    $$('.type-option').forEach(option => {
      option.addEventListener('click', () => {
        setReportType(option.dataset.type);
      });
    });

    const description = $('#report-description');
    if (description) description.addEventListener('input', updateDescriptionCount);

    const zone = $('#upload-zone');
    const input = $('#report-image');

    if (zone && input) {
      zone.addEventListener('click', event => {
        if (event.target.closest('#remove-image')) return;
        input.click();
      });
      zone.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          input.click();
        }
      });
      ['dragenter', 'dragover'].forEach(type => {
        zone.addEventListener(type, event => {
          event.preventDefault();
          zone.classList.add('is-dragging');
        });
      });
      ['dragleave', 'drop'].forEach(type => {
        zone.addEventListener(type, event => {
          event.preventDefault();
          zone.classList.remove('is-dragging');
        });
      });
      zone.addEventListener('drop', event => {
        const file = event.dataTransfer && event.dataTransfer.files[0];
        if (file) handleImage(file);
      });
      input.addEventListener('change', () => {
        if (input.files[0]) handleImage(input.files[0]);
      });
    }

    const remove = $('#remove-image');
    if (remove) {
      remove.addEventListener('click', event => {
        event.stopPropagation();
        clearImage();
      });
    }

    const form = $('#report-form');
    if (form) form.addEventListener('submit', submitReport);

    const draft = $('#save-draft');
    if (draft) draft.addEventListener('click', saveDraft);

    const another = $('#report-another');
    if (another) {
      another.addEventListener('click', () => {
        showReportForm();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }

    const viewPublished = $('#view-published');
    if (viewPublished) {
      viewPublished.addEventListener('click', () => {
        browseFilters.tab = reportType === 'found' ? 'found' : 'lost';
        browseFilters.category = 'all';
        browseFilters.location = 'all';
        browseFilters.keyword = '';
        showReportForm();
        showView('browse');
      });
    }

    restoreDraft();
  }

  /* ---------- 11 My Reports ---------- */

  function renderMyReports() {
    const email = myReportsState.email;
    const list = $('#myreports-list');
    const empty = $('#myreports-empty');
    if (!list) return;

    list.textContent = '';

    const lower = email.toLowerCase();
    const myLost = items.filter(item => item.contactEmail.toLowerCase() === lower && item.type === 'lost');
    const myFound = items.filter(item => item.contactEmail.toLowerCase() === lower && item.type === 'found');
    const myClaims = claims.filter(claim => claim.claimantEmail.toLowerCase() === lower);

    const counts = { lost: myLost.length, found: myFound.length, claims: myClaims.length };
    Object.entries(counts).forEach(([key, value]) => {
      const node = $(`[data-mtab-count="${key}"]`);
      if (node) node.textContent = value;
    });

    $$('.board-tab[data-mtab]').forEach(tab => {
      const isActive = tab.dataset.mtab === myReportsState.tab;
      tab.classList.toggle('is-active', isActive);
      tab.setAttribute('aria-selected', String(isActive));
    });

    let records = [];
    if (myReportsState.tab === 'claims') records = myClaims;
    else records = myReportsState.tab === 'lost' ? myLost : myFound;

    if (!records.length) {
      list.hidden = true;
      if (empty) empty.hidden = false;
      const title = $('#myreports-empty-title');
      const text = $('#myreports-empty-text');
      if (title && text) {
        if (myReportsState.tab === 'claims') {
          title.textContent = 'No claims yet';
          text.textContent = `No claim requests have been sent from ${email}.`;
        } else {
          title.textContent = `No ${myReportsState.tab} reports yet`;
          text.textContent = `Nothing has been reported with ${email}. Reports you publish with this email appear here.`;
        }
      }
      return;
    }

    list.hidden = false;
    if (empty) empty.hidden = true;

    records.forEach(record => {
      list.append(myReportsState.tab === 'claims' ? buildClaimRecord(record) : buildReportRecord(record));
    });
  }

  function buildReportRecord(item) {
    const thumb = h('div', { class: 'record-thumb' },
      h('img', { src: imageFor(item), alt: '', loading: 'lazy' })
    );

    const actions = h('div', { class: 'record-actions' },
      h('button', {
        class: 'btn btn-outline btn-small',
        type: 'button',
        onclick: () => openItemDetails(item.id)
      }, 'Open')
    );

    if (!item.isSample) {
      actions.append(h('button', {
        class: 'btn btn-ghost btn-small',
        type: 'button',
        onclick: () => askDelete(item.id)
      }, 'Delete'));
    }

    return h('article', { class: 'record-card' },
      thumb,
      h('div', { class: 'record-main' },
        h('div', { class: 'record-top' },
          h('span', { class: 'record-id', text: item.id }),
          h('span', { class: `status ${statusTone(item.status)}`, text: statusLabel(item.status) })
        ),
        h('h3', { class: 'record-title', text: item.itemName }),
        h('p', { class: 'record-meta', text: `${item.category} · ${item.location} · ${formatDate(item.itemDate)}` })
      ),
      actions
    );
  }

  function buildClaimRecord(claim) {
    const item = items.find(entry => entry.id === claim.itemId);
    return h('article', { class: 'record-card' },
      h('div', { class: 'record-thumb' },
        h('img', { src: item ? imageFor(item) : 'assets/images/item-glasses.svg', alt: '', loading: 'lazy' })
      ),
      h('div', { class: 'record-main' },
        h('div', { class: 'record-top' },
          h('span', { class: 'record-id', text: claim.id }),
          h('span', { class: `status ${statusTone(claim.status)}`, text: statusLabel(claim.status) })
        ),
        h('h3', { class: 'record-title', text: item ? item.itemName : 'Listing no longer available' }),
        h('p', { class: 'record-meta', text: `Claim for ${claim.itemId} · submitted ${formatDate(claim.createdAt)}` })
      ),
      h('div', { class: 'record-actions' },
        item ? h('button', {
          class: 'btn btn-outline btn-small',
          type: 'button',
          onclick: () => openItemDetails(item.id)
        }, 'View listing') : ''
      )
    );
  }

  function initMyReports() {
    const form = $('#myreports-form');
    const input = $('#myreports-email');

    if (input && profile.currentEmail) input.value = profile.currentEmail;

    if (form) {
      form.addEventListener('submit', event => {
        event.preventDefault();
        const email = (input.value || '').trim();

        if (!email) {
          showToast('Enter the campus email you used to report.', 'error');
          input.focus();
          return;
        }
        if (!isValidEmail(email)) {
          showToast('That email address does not look right.', 'error');
          input.focus();
          return;
        }

        myReportsState.email = email;
        myReportsState.tab = 'lost';
        profile = { currentEmail: email };
        saveToStorage(KEYS.profile, profile);

        const display = $('#myreports-email-display');
        if (display) display.textContent = email;
        const results = $('#myreports-results');
        if (results) results.hidden = false;

        renderMyReports();
        results.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }

    $$('.board-tab[data-mtab]').forEach(tab => {
      tab.addEventListener('click', () => {
        myReportsState.tab = tab.dataset.mtab;
        renderMyReports();
      });
    });

    const switchButton = $('#myreports-switch');
    if (switchButton) {
      switchButton.addEventListener('click', () => {
        const results = $('#myreports-results');
        if (results) results.hidden = true;
        if (input) {
          input.focus();
          input.select();
        }
      });
    }

    const confirmButton = $('#confirm-delete');
    if (confirmButton) confirmButton.addEventListener('click', confirmDelete);
  }

  function askDelete(itemId, fromAdmin = false) {
    const item = items.find(entry => entry.id === itemId);
    if (!item) return;

    pendingDeleteId = itemId;
    pendingDeleteFromAdmin = fromAdmin;
    const target = $('#delete-target');
    if (target) target.textContent = `${item.itemName} · ${item.id}`;
    openModal('delete-modal');
  }

  function confirmDelete() {
    if (!pendingDeleteId) return;
    const id = pendingDeleteId;
    const item = items.find(entry => entry.id === id);

    if (item && item.isSample && !pendingDeleteFromAdmin) {
      showToast('Seeded demonstration reports cannot be deleted. Reset the demo instead.', 'error');
      closeModal('delete-modal');
      return;
    }

    const previousItems = items;
    const previousClaims = claims;
    items = items.filter(entry => entry.id !== id);
    claims = claims.filter(claim => claim.itemId !== id);

    if (!saveToStorage(KEYS.items, items) || !saveToStorage(KEYS.claims, claims)) {
      items = previousItems;
      claims = previousClaims;
      showToast('Delete failed — browser storage could not be updated.', 'error');
      closeModal('delete-modal');
      return;
    }

    pendingDeleteId = null;
    pendingDeleteFromAdmin = false;
    closeModal('delete-modal');
    showToast('Report deleted.', 'success');
    if (myReportsState.email) renderMyReports();
    renderHome();
    renderBrowse();
    renderAdmin();
  }

  /* ---------- 11b Administrator workspace ---------- */

  const ADMIN_SESSION_KEY = 'clf.admin.session.v1';
  // Demonstration credentials only: a browser-only app cannot authenticate staff.
  const ADMIN_CREDENTIALS = { username: 'admin', password: 'lpu326' };

  const REPORT_STATUSES = {
    lost: ['still_looking', 'matched', 'returned'],
    found: ['ready_to_claim', 'claimed', 'returned']
  };
  const CLAIM_STATUSES = ['pending_verification', 'approved', 'rejected', 'returned'];

  const adminState = { tab: 'reports', search: '', status: 'all', type: 'all' };

  function isAdminSignedIn() {
    try {
      return sessionStorage.getItem(ADMIN_SESSION_KEY) === 'active';
    } catch (error) {
      return false;
    }
  }

  function setAdminSignedIn(active) {
    try {
      if (active) sessionStorage.setItem(ADMIN_SESSION_KEY, 'active');
      else sessionStorage.removeItem(ADMIN_SESSION_KEY);
    } catch (error) {
      /* sessionStorage unavailable: the dashboard simply stays on the sign-in screen */
    }
  }

  function renderAdmin() {
    const signedIn = isAdminSignedIn();
    const login = $('#admin-login');
    const dash = $('#admin-dash');
    if (login) login.hidden = signedIn;
    if (dash) dash.hidden = !signedIn;
    if (!signedIn) return;

    renderAdminStats();
    renderAdminList();
  }

  function renderAdminStats() {
    const container = $('#admin-stats');
    if (!container) return;
    container.textContent = '';

    const pendingClaims = claims.filter(claim => claim.status === 'pending_verification').length;
    const reunited = items.filter(item => item.status === 'returned').length;

    const stats = [
      ['Total reports', items.length, false],
      ['Lost items', countByType('lost'), false],
      ['Found items', countByType('found'), false],
      ['Pending claims', pendingClaims, true],
      ['Reunited', reunited, false]
    ];

    stats.forEach(([label, value, accent]) => {
      container.append(h('div', accent ? { class: 'is-accent' } : {},
        h('dt', { text: label }),
        h('dd', { text: String(value) })
      ));
    });
  }

  function adminStatusSelect(current, options, onChange) {
    const select = h('select', { class: 'status-select', 'aria-label': 'Change status' },
      options.map(status => h('option', { value: status }, statusLabel(status)))
    );
    select.value = current;
    select.addEventListener('change', () => onChange(select.value));
    return select;
  }

  function syncAdminStatusFilter() {
    const select = $('#admin-status');
    if (!select) return;

    const options = adminState.tab === 'claims' ? CLAIM_STATUSES : REPORT_STATUSES.lost.concat('ready_to_claim', 'claimed');
    const unique = [...new Set(options)];

    select.textContent = '';
    select.append(h('option', { value: 'all' }, 'All statuses'));
    unique.forEach(status => select.append(h('option', { value: status }, statusLabel(status))));

    if (!unique.includes(adminState.status)) adminState.status = 'all';
    select.value = adminState.status;
  }

  function renderAdminList() {
    const list = $('#admin-list');
    const empty = $('#admin-empty');
    if (!list) return;

    syncAdminStatusFilter();

    $$('[data-atab]').forEach(tab => {
      const isActive = tab.dataset.atab === adminState.tab;
      tab.classList.toggle('is-active', isActive);
      tab.setAttribute('aria-selected', String(isActive));
    });

    const reportCount = $('[data-acount="reports"]');
    const claimCount = $('[data-acount="claims"]');
    if (reportCount) reportCount.textContent = items.length;
    if (claimCount) claimCount.textContent = claims.length;

    const search = adminState.search.trim().toLowerCase();
    const contains = text => !search || String(text).toLowerCase().includes(search);

    list.textContent = '';
    let rows = [];
    let emptyTitle = 'Nothing to review';
    let emptyText = 'No records match these filters.';

    if (adminState.tab === 'claims') {
      const matching = claims.filter(claim => {
        const item = items.find(entry => entry.id === claim.itemId);
        if (adminState.status !== 'all' && claim.status !== adminState.status) return false;
        return contains([claim.id, claim.claimantName, claim.claimantEmail, claim.identifyingDetail, item ? item.itemName : ''].join(' '));
      }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      rows = matching.map(buildAdminClaimRow);
      emptyTitle = 'No claim requests';
      emptyText = 'Claims submitted from the public board appear here for review.';
    } else {
      const matching = items.filter(item => {
        if (adminState.type !== 'all' && item.type !== adminState.type) return false;
        if (adminState.status !== 'all' && item.status !== adminState.status) return false;
        return contains([item.id, item.itemName, item.category, item.location, item.contactEmail].join(' '));
      }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      rows = matching.map(buildAdminReportRow);
      emptyTitle = 'No reports found';
      emptyText = 'Try a different search, status or type.';
    }

    rows.forEach(row => list.append(row));

    const count = $('#admin-count');
    if (count) {
      count.textContent = adminState.tab === 'claims'
        ? `${rows.length} claim request${rows.length === 1 ? '' : 's'} shown`
        : `${rows.length} report${rows.length === 1 ? '' : 's'} shown`;
    }

    const isEmpty = rows.length === 0;
    list.hidden = isEmpty;
    if (empty) empty.hidden = !isEmpty;
    if (isEmpty) {
      const title = $('#admin-empty-title');
      const text = $('#admin-empty-text');
      if (title) title.textContent = emptyTitle;
      if (text) text.textContent = emptyText;
    }
  }

  function buildAdminReportRow(item) {
    const statusOptions = REPORT_STATUSES[item.type] || REPORT_STATUSES.lost;

    return h('article', { class: 'admin-row' },
      h('div', { class: 'admin-thumb' },
        h('img', { src: imageFor(item), alt: '', loading: 'lazy' })
      ),
      h('div', { class: 'admin-row-main' },
        h('div', { class: 'admin-row-top' },
          h('span', { class: 'record-id', text: item.id }),
          h('span', { class: `item-badge item-badge--${item.type}`, text: typeLabel(item.type) }),
          h('span', { class: `status ${statusTone(item.status)}`, text: statusLabel(item.status) }),
          item.isSample ? h('span', { class: 'record-id', text: 'sample' }) : null
        ),
        h('h3', { class: 'admin-row-title', text: item.itemName }),
        h('p', {
          class: 'admin-row-meta',
          text: `${item.category} · ${item.location} · ${formatDate(item.itemDate)} · ${item.contactEmail}`
        })
      ),
      h('div', { class: 'admin-row-actions' },
        adminStatusSelect(item.status, statusOptions, value => updateItemStatus(item.id, value)),
        h('button', {
          class: 'btn btn-ghost btn-small',
          type: 'button',
          onclick: () => askDelete(item.id, true)
        }, 'Delete')
      )
    );
  }

  function buildAdminClaimRow(claim) {
    const item = items.find(entry => entry.id === claim.itemId);

    return h('article', { class: 'admin-row' },
      h('div', { class: 'admin-thumb' },
        h('img', { src: item ? imageFor(item) : 'assets/images/item-glasses.svg', alt: '', loading: 'lazy' })
      ),
      h('div', { class: 'admin-row-main' },
        h('div', { class: 'admin-row-top' },
          h('span', { class: 'record-id', text: claim.id }),
          h('span', { class: `status ${statusTone(claim.status)}`, text: statusLabel(claim.status) })
        ),
        h('h3', { class: 'admin-row-title', text: item ? item.itemName : 'Listing no longer available' }),
        h('p', {
          class: 'admin-row-meta',
          text: `${claim.claimantName} · ${claim.claimantEmail} · ${formatDate(claim.createdAt)} · for ${claim.itemId}`
        }),
        h('p', { class: 'admin-row-detail', text: claim.identifyingDetail }),
        claim.proofDescription ? h('p', { class: 'admin-row-detail', text: claim.proofDescription }) : null
      ),
      h('div', { class: 'admin-row-actions' },
        adminStatusSelect(claim.status, CLAIM_STATUSES, value => updateClaimStatus(claim.id, value)),
        claim.status === 'pending_verification' ? h('button', {
          class: 'btn btn-primary btn-small',
          type: 'button',
          onclick: () => updateClaimStatus(claim.id, 'approved')
        }, 'Approve') : null,
        claim.status === 'pending_verification' ? h('button', {
          class: 'btn btn-outline btn-small',
          type: 'button',
          onclick: () => updateClaimStatus(claim.id, 'rejected')
        }, 'Reject') : null
      )
    );
  }

  function updateItemStatus(itemId, status) {
    const item = items.find(entry => entry.id === itemId);
    if (!item) return;

    const allowed = REPORT_STATUSES[item.type] || [];
    if (!allowed.includes(status)) return;

    item.status = status;
    item.updatedAt = new Date().toISOString();

    if (!saveToStorage(KEYS.items, items)) {
      showToast('Status could not be saved — browser storage is full.', 'error');
      return;
    }

    showToast(`${item.id} marked as ${statusLabel(status).toLowerCase()}.`, 'success');
    renderAdmin();
    renderHome();
    renderBrowse();
    if (myReportsState.email) renderMyReports();
  }

  function updateClaimStatus(claimId, status) {
    const claim = claims.find(entry => entry.id === claimId);
    if (!claim || !CLAIM_STATUSES.includes(status)) return;

    const now = new Date().toISOString();
    claim.status = status;
    claim.updatedAt = now;

    const item = items.find(entry => entry.id === claim.itemId);
    if (item) {
      if (status === 'approved') item.status = 'claimed';
      if (status === 'returned') item.status = 'returned';
      item.updatedAt = now;
    }

    const saved = saveToStorage(KEYS.claims, claims) && saveToStorage(KEYS.items, items);
    if (!saved) {
      showToast('Could not save the claim update.', 'error');
      return;
    }

    showToast(`Claim ${claim.id} marked as ${statusLabel(status).toLowerCase()}.`, 'success');
    renderAdmin();
    renderHome();
    renderBrowse();
    if (myReportsState.email) renderMyReports();
  }

  function handleAdminLogin(event) {
    event.preventDefault();

    const username = ($('#admin-username') || {}).value || '';
    const password = ($('#admin-password') || {}).value || '';
    const error = $('#admin-login-error');

    const fail = message => {
      if (error) {
        error.textContent = message;
        error.hidden = false;
      }
      const passwordField = $('#admin-password');
      if (passwordField) {
        passwordField.classList.add('input-invalid');
        passwordField.focus();
        passwordField.select();
      }
    };

    if (!username.trim() || !password) {
      fail('Enter both your username and password.');
      return;
    }

    if (username.trim().toLowerCase() !== ADMIN_CREDENTIALS.username || password !== ADMIN_CREDENTIALS.password) {
      fail('Those credentials do not match. Use the demonstration details below.');
      return;
    }

    if (error) error.hidden = true;
    const passwordField = $('#admin-password');
    if (passwordField) passwordField.classList.remove('input-invalid');

    setAdminSignedIn(true);
    adminState.tab = 'reports';
    adminState.search = '';
    adminState.status = 'all';
    adminState.type = 'all';

    const form = $('#admin-login-form');
    if (form) form.reset();
    resetAdminPasswordVisibility();

    const search = $('#admin-search');
    if (search) search.value = '';
    const type = $('#admin-type');
    if (type) type.value = 'all';

    renderAdmin();
    showToast('Signed in to the administrator workspace.', 'success');
  }

  function resetAdminPasswordVisibility() {
    const field = $('#admin-password');
    const toggle = $('#admin-password-toggle');
    if (field) field.type = 'password';
    if (toggle) {
      toggle.textContent = 'Show';
      toggle.setAttribute('aria-pressed', 'false');
    }
  }

  function initAdmin() {
    const form = $('#admin-login-form');
    if (form) form.addEventListener('submit', handleAdminLogin);

    const toggle = $('#admin-password-toggle');
    if (toggle) {
      toggle.addEventListener('click', () => {
        const field = $('#admin-password');
        if (!field) return;
        const show = field.type === 'password';
        field.type = show ? 'text' : 'password';
        toggle.textContent = show ? 'Hide' : 'Show';
        toggle.setAttribute('aria-pressed', String(show));
        field.focus();
      });
    }

    const signOut = $('#admin-signout');
    if (signOut) {
      signOut.addEventListener('click', () => {
        setAdminSignedIn(false);
        renderAdmin();
        showToast('Signed out of the administrator workspace.', 'info');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        const username = $('#admin-username');
        if (username) username.focus();
      });
    }

    const reset = $('#admin-reset');
    if (reset) reset.addEventListener('click', () => resetDemoData('admin'));

    $$('[data-atab]').forEach(tab => {
      tab.addEventListener('click', () => {
        adminState.tab = tab.dataset.atab === 'claims' ? 'claims' : 'reports';
        adminState.status = 'all';
        renderAdminList();
      });
    });

    const search = $('#admin-search');
    if (search) {
      let timer = null;
      search.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          adminState.search = search.value;
          renderAdminList();
        }, 160);
      });
    }

    const status = $('#admin-status');
    if (status) {
      status.addEventListener('change', () => {
        adminState.status = status.value;
        renderAdminList();
      });
    }

    const type = $('#admin-type');
    if (type) {
      type.addEventListener('change', () => {
        adminState.type = type.value;
        renderAdminList();
      });
    }

    renderAdmin();
  }

  /* ---------- 12 Navigation & mobile menu ---------- */

  const VIEWS = { home: 'view-home', browse: 'view-browse', report: 'view-report', myreports: 'view-myreports', admin: 'view-admin' };

  function showView(name) {
    const target = VIEWS[name] || VIEWS.home;

    Object.values(VIEWS).forEach(id => {
      const node = document.getElementById(id);
      if (node) node.hidden = id !== target;
    });

    $$('.nav-link').forEach(link => {
      link.classList.toggle('is-active', link.dataset.nav === name);
    });

    closeMobileMenu();

    if (name === 'browse') {
      renderBrowse();
    }

    if (name === 'myreports') {
      const results = $('#myreports-results');
      if (results && myReportsState.email) {
        results.hidden = false;
        renderMyReports();
      }
    }

    if (name === 'report') {
      showReportForm();
    }

    if (name === 'admin') {
      renderAdmin();
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
    const heading = document.querySelector(`#${target} h1, #${target} h2`);
    if (heading) {
      heading.setAttribute('tabindex', '-1');
    }
  }

  function scrollToSection(id) {
    const target = document.getElementById(id);
    if (!target) return;

    const home = document.getElementById('view-home');
    const onHome = home && !home.hidden;
    if (!onHome) {
      showView('home');
      window.setTimeout(() => {
        document.getElementById(id).scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 120);
      return;
    }
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function closeMobileMenu() {
    const menu = $('#mobile-menu');
    const toggle = $('#nav-toggle');
    if (menu) menu.hidden = true;
    if (toggle) {
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Open navigation menu');
    }
  }

  function initNavigation() {
    document.addEventListener('click', event => {
      const navTrigger = event.target.closest('[data-nav]');
      if (navTrigger) {
        event.preventDefault();
        const destination = navTrigger.dataset.nav;
        if (destination === 'report') {
          openReportForm(navTrigger.dataset.type || 'lost');
          return;
        }
        if (destination === 'browse' && navTrigger.dataset.tab) {
          browseFilters.tab = navTrigger.dataset.tab;
          browseFilters.category = 'all';
          browseFilters.location = 'all';
          browseFilters.keyword = '';
        }
        showView(destination);
        return;
      }

      const scrollTrigger = event.target.closest('[data-scroll]');
      if (scrollTrigger) {
        event.preventDefault();
        scrollToSection(scrollTrigger.dataset.scroll);
      }
    });

    const toggle = $('#nav-toggle');
    const menu = $('#mobile-menu');
    if (toggle && menu) {
      toggle.addEventListener('click', () => {
        const isOpen = toggle.getAttribute('aria-expanded') === 'true';
        if (isOpen) {
          closeMobileMenu();
        } else {
          menu.hidden = false;
          toggle.setAttribute('aria-expanded', 'true');
          toggle.setAttribute('aria-label', 'Close navigation menu');
        }
      });
    }

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') closeMobileMenu();
    });
  }

  /* ---------- Modals ---------- */

  function openModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;

    lastFocused = lastFocused || document.activeElement;
    modal.hidden = false;
    document.body.classList.add('is-locked');

    const focusTarget = modal.querySelector('input, textarea, button.modal-close, button');
    if (focusTarget) window.setTimeout(() => focusTarget.focus(), 40);
  }

  function closeModal(id, restoreFocus = true) {
    const modal = document.getElementById(id);
    if (!modal) return;

    modal.hidden = true;
    if (!document.querySelector('.modal:not([hidden])')) {
      document.body.classList.remove('is-locked');
    }
    if (id === 'delete-modal') {
      pendingDeleteId = null;
      pendingDeleteFromAdmin = false;
    }

    if (restoreFocus && lastFocused && typeof lastFocused.focus === 'function') {
      lastFocused.focus();
    }
    lastFocused = null;
  }

  function initModals() {
    $$('[data-close]').forEach(trigger => {
      trigger.addEventListener('click', () => closeModal(trigger.dataset.close));
    });

    document.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      const open = $$('.modal').filter(modal => !modal.hidden);
      if (open.length) {
        event.preventDefault();
        closeModal(open[open.length - 1].id, false);
        if (lastFocused && lastFocused.focus) lastFocused.focus();
      }
    });

    const claimForm = $('#claim-form');
    if (claimForm) claimForm.addEventListener('submit', submitClaim);
  }

  /* ---------- Form error helpers ---------- */

  function clearFormErrors(scope) {
    if (!scope) return;
    $$('.field-error', scope).forEach(node => node.remove());
    $$('.input-invalid', scope).forEach(node => node.classList.remove('input-invalid'));
  }

  function showFormErrors(scope, errors, selectorMap) {
    let firstField = null;

    Object.entries(errors).forEach(([field, message]) => {
      const selector = selectorMap[field];
      const input = selector ? $(selector, scope) : null;
      if (!input) return;

      input.classList.add('input-invalid');
      input.setAttribute('aria-invalid', 'true');

      const wrapper = input.closest('.form-field') || input.parentElement;
      if (wrapper && !wrapper.querySelector('.field-error')) {
        wrapper.append(h('p', { class: 'field-error', id: `${input.id}-error`, text: message }));
        input.setAttribute('aria-describedby', `${input.id}-error`);
      }
      if (!firstField) firstField = input;
    });

    if (firstField) {
      firstField.focus();
      firstField.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  /* ---------- 13 FAQ ---------- */

  function initFaq() {
    const questions = $$('.faq-question');

    questions.forEach(question => {
      question.addEventListener('click', () => {
        const isOpen = question.getAttribute('aria-expanded') === 'true';

        questions.forEach(other => {
          const answer = document.getElementById(other.getAttribute('aria-controls'));
          const shouldOpen = other === question && !isOpen;
          other.setAttribute('aria-expanded', String(shouldOpen));
          if (answer) answer.hidden = !shouldOpen;
        });
      });
    });
  }

  /* ---------- 14 Toasts ---------- */

  function showToast(message, type = 'success') {
    const container = $('#toast-container');
    if (!container) return;

    const glyph = type === 'error'
      ? ['M12 8v5M12 16.5v.01', 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z']
      : ['m5 12.5 4.5 4.5L19 7'];

    const toast = h('div', { class: `toast toast--${type}`, role: 'status' },
      h('span', { class: 'toast-icon' }, icon(glyph)),
      h('p', { class: 'toast-message', text: message }),
      h('button', {
        class: 'toast-close',
        type: 'button',
        'aria-label': 'Dismiss notification',
        text: '×'
      })
    );

    const remove = () => {
      toast.classList.add('is-hiding');
      window.setTimeout(() => toast.remove(), 220);
    };

    toast.querySelector('.toast-close').addEventListener('click', remove);
    container.append(toast);
    window.setTimeout(remove, type === 'error' ? 6500 : 4500);
  }

  /* ---------- 15 Boot ---------- */

  function loadData() {
    const storedItems = loadFromStorage(KEYS.items, null);

    if (Array.isArray(storedItems) && storedItems.length) {
      items = storedItems.filter(item => item && typeof item === 'object' && item.id && item.itemName);
    }
    if (!Array.isArray(storedItems) || !items.length) {
      // First launch (or a cleared / malformed store): seed once and persist.
      items = seedSampleItems();
      saveToStorage(KEYS.items, items);
    }

    const storedClaims = loadFromStorage(KEYS.claims, []);
    claims = Array.isArray(storedClaims)
      ? storedClaims.filter(claim => claim && claim.id && claim.itemId)
      : [];

    const storedProfile = loadFromStorage(KEYS.profile, { currentEmail: '' });
    profile = { currentEmail: typeof storedProfile.currentEmail === 'string' ? storedProfile.currentEmail : '' };

    if (myReportsState.email === '' && profile.currentEmail) {
      myReportsState.email = profile.currentEmail;
      const display = $('#myreports-email-display');
      if (display) display.textContent = profile.currentEmail;
    }
  }

  function resetDemoData(destination = 'home') {
    const confirmed = window.confirm(
      'Reset the demonstration? All reports, drafts and claims saved in this browser will be deleted and the sample board restored.'
    );
    if (!confirmed) return;

    [KEYS.items, KEYS.claims, KEYS.profile, KEYS.draft].forEach(key => {
      try { localStorage.removeItem(key); } catch (error) { /* ignore */ }
    });

    items = seedSampleItems();
    claims = [];
    profile = { currentEmail: '' };
    myReportsState.email = '';
    myReportsState.tab = 'lost';

    saveToStorage(KEYS.items, items);

    const results = $('#myreports-results');
    if (results) results.hidden = true;
    const emailInput = $('#myreports-email');
    if (emailInput) emailInput.value = '';

    const reportForm = $('#report-form');
    if (reportForm) reportForm.reset();
    clearImage();
    setReportType('lost');
    updateDescriptionCount();
    showReportForm();

    renderHome();
    renderBrowse();
    renderAdmin();
    showView(destination);
    showToast('Demonstration data reset. The sample board is back.', 'success');
  }

  function init() {
    loadData();

    initNavigation();
    initModals();
    initBrowse();
    initReport();
    initMyReports();
    initAdmin();
    initFaq();

    renderHome();
    renderBrowse();

    const year = $('#footer-year');
    if (year) year.textContent = new Date().getFullYear();

    const reset = $('#reset-data');
    if (reset) reset.addEventListener('click', resetDemoData);

    // Hero search hands the keyword to the board.
    const heroSearch = $('#hero-search');
    const heroInput = $('#hero-search-input');
    if (heroSearch) {
      heroSearch.addEventListener('submit', event => {
        event.preventDefault();
        const keyword = (heroInput.value || '').trim();
        browseFilters.keyword = keyword;
        browseFilters.category = 'all';
        browseFilters.location = 'all';

        // A hero search spans the whole board, so open the tab that has matches.
        const matches = type => getVisibleItems(items, {
          tab: type, category: 'all', location: 'all', keyword
        }).length;
        browseFilters.tab = matches('lost') === 0 && matches('found') > 0 ? 'found' : 'lost';

        showView('browse');
      });
    }

    // A different email in the report form should not silently reuse the old one.
    const storedEmail = $('#report-email');
    if (storedEmail && profile.currentEmail) storedEmail.value = profile.currentEmail;
    const claimEmail = $('#claim-email');
    if (claimEmail && profile.currentEmail) claimEmail.value = profile.currentEmail;

    if (profile.currentEmail) {
      const results = $('#myreports-results');
      const emailInput = $('#myreports-email');
      if (emailInput) emailInput.value = profile.currentEmail;
      if (results && myReportsState.email) {
        results.hidden = false;
        renderMyReports();
      }
    }

    if (!('localStorage' in window)) {
      showToast('This browser blocks LocalStorage, so reports cannot be saved.', 'error');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
