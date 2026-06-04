/* ============================================================
   CÜZDANIM — app.js
   Vanilla JS, localStorage, Chart.js
   ============================================================ */

'use strict';

/* ──────────────────────────────────────────────
   CONSTANTS
────────────────────────────────────────────── */
const STORAGE_KEY = 'cüzdanim_transactions';
const SEED_KEY    = 'cüzdanim_seeded';

const INCOME_CATEGORIES = [
  { label: 'Maaş',           emoji: '💼' },
  { label: 'Serbest Çalışma',emoji: '💻' },
  { label: 'Kira Geliri',    emoji: '🏠' },
  { label: 'Diğer',          emoji: '💰' },
];

const EXPENSE_CATEGORIES = [
  { label: 'Yemek',     emoji: '🍔' },
  { label: 'Kira',      emoji: '🏡' },
  { label: 'Ulaşım',    emoji: '🚌' },
  { label: 'Alışveriş', emoji: '🛍️' },
  { label: 'Fatura',    emoji: '📄' },
  { label: 'Sağlık',    emoji: '💊' },
  { label: 'Eğlence',   emoji: '🎬' },
  { label: 'Diğer',     emoji: '📦' },
];

const CATEGORY_COLORS = [
  '#6C63FF','#EF4444','#22C55E','#F59E0B',
  '#3B82F6','#EC4899','#10B981','#8B5CF6',
  '#F97316','#06B6D4',
];

const MONTH_NAMES = [
  'Ocak','Şubat','Mart','Nisan','Mayıs','Haziran',
  'Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'
];

/* ──────────────────────────────────────────────
   STATE
────────────────────────────────────────────── */
let transactions   = [];      // all persisted transactions
let currentYear    = new Date().getFullYear();
let currentMonthIdx= new Date().getMonth();   // 0-based
let activeTab      = 'home';
let currentFilter  = 'all';   // all | income | expense
let currentType    = 'income';// form type
let pendingDeleteId= null;
let pieChartInst   = null;
let barChartInst   = null;

/* ──────────────────────────────────────────────
   STORAGE
────────────────────────────────────────────── */
function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    transactions = raw ? JSON.parse(raw) : [];
  } catch (e) {
    transactions = [];
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}

/* ──────────────────────────────────────────────
   SAMPLE DATA (seeded once on first launch)
────────────────────────────────────────────── */
function seedSampleData() {
  if (localStorage.getItem(SEED_KEY)) return;

  const now   = new Date();
  const y     = now.getFullYear();
  const m     = now.getMonth(); // 0-based

  // Helper: ISO date string for a given year/month/day
  function d(year, month, day) {
    return `${year}-${String(month + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  }

  const samples = [
    // Current month
    { id: uid(), type: 'income',  category: 'Maaş',           amount: 18500,  note: 'Ocak maaşı',          date: d(y, m,  1) },
    { id: uid(), type: 'income',  category: 'Serbest Çalışma', amount: 3200,   note: 'Web projesi',         date: d(y, m,  8) },
    { id: uid(), type: 'expense', category: 'Kira',            amount: 6500,   note: 'Aylık kira',          date: d(y, m,  3) },
    { id: uid(), type: 'expense', category: 'Yemek',           amount: 1850,   note: 'Market alışverişi',   date: d(y, m,  5) },
    { id: uid(), type: 'expense', category: 'Fatura',          amount: 420,    note: 'Elektrik & internet', date: d(y, m,  7) },
    { id: uid(), type: 'expense', category: 'Ulaşım',          amount: 650,    note: 'Aylık abonman',       date: d(y, m,  2) },
    { id: uid(), type: 'expense', category: 'Alışveriş',       amount: 980,    note: 'Giyim',               date: d(y, m, 12) },
    { id: uid(), type: 'expense', category: 'Eğlence',         amount: 350,    note: 'Sinema & yemek',      date: d(y, m, 15) },
    { id: uid(), type: 'expense', category: 'Sağlık',          amount: 200,    note: 'Eczane',              date: d(y, m, 10) },
    // Previous month
    { id: uid(), type: 'income',  category: 'Maaş',           amount: 18500,  note: 'Maaş',               date: d(y, m - 1,  1) },
    { id: uid(), type: 'income',  category: 'Kira Geliri',    amount: 4500,   note: 'Kiracıdan gelir',     date: d(y, m - 1,  5) },
    { id: uid(), type: 'expense', category: 'Kira',           amount: 6500,   note: 'Kira',                date: d(y, m - 1,  3) },
    { id: uid(), type: 'expense', category: 'Yemek',          amount: 2100,   note: 'Market',              date: d(y, m - 1, 10) },
    { id: uid(), type: 'expense', category: 'Fatura',         amount: 390,    note: 'Faturalar',           date: d(y, m - 1,  8) },
    { id: uid(), type: 'expense', category: 'Ulaşım',         amount: 580,    note: 'Ulaşım',              date: d(y, m - 1,  4) },
    { id: uid(), type: 'expense', category: 'Alışveriş',      amount: 1450,   note: 'Elektronik',          date: d(y, m - 1, 20) },
    // 2 months ago
    { id: uid(), type: 'income',  category: 'Maaş',           amount: 18500,  note: 'Maaş',               date: d(y, m - 2,  1) },
    { id: uid(), type: 'income',  category: 'Serbest Çalışma',amount: 5000,   note: 'Danışmanlık',         date: d(y, m - 2, 15) },
    { id: uid(), type: 'expense', category: 'Kira',           amount: 6500,   note: 'Kira',                date: d(y, m - 2,  3) },
    { id: uid(), type: 'expense', category: 'Yemek',          amount: 1750,   note: 'Market',              date: d(y, m - 2, 12) },
    { id: uid(), type: 'expense', category: 'Sağlık',         amount: 850,    note: 'Diş hekimi',          date: d(y, m - 2, 18) },
    { id: uid(), type: 'expense', category: 'Fatura',         amount: 410,    note: 'Faturalar',           date: d(y, m - 2,  7) },
    { id: uid(), type: 'expense', category: 'Eğlence',        amount: 600,    note: 'Konser bileti',       date: d(y, m - 2, 22) },
    // 3 months ago
    { id: uid(), type: 'income',  category: 'Maaş',           amount: 16000,  note: 'Maaş',               date: d(y, m - 3,  1) },
    { id: uid(), type: 'expense', category: 'Kira',           amount: 6000,   note: 'Kira',                date: d(y, m - 3,  3) },
    { id: uid(), type: 'expense', category: 'Yemek',          amount: 1900,   note: 'Market',              date: d(y, m - 3, 10) },
    { id: uid(), type: 'expense', category: 'Ulaşım',         amount: 500,    note: 'Ulaşım',              date: d(y, m - 3,  5) },
    { id: uid(), type: 'expense', category: 'Alışveriş',      amount: 750,    note: 'Ev eşyası',           date: d(y, m - 3, 16) },
    // 4 months ago
    { id: uid(), type: 'income',  category: 'Maaş',           amount: 16000,  note: 'Maaş',               date: d(y, m - 4,  1) },
    { id: uid(), type: 'income',  category: 'Kira Geliri',    amount: 4500,   note: 'Kira geliri',         date: d(y, m - 4,  5) },
    { id: uid(), type: 'expense', category: 'Kira',           amount: 6000,   note: 'Kira',                date: d(y, m - 4,  3) },
    { id: uid(), type: 'expense', category: 'Yemek',          amount: 1650,   note: 'Market',              date: d(y, m - 4, 11) },
    { id: uid(), type: 'expense', category: 'Fatura',         amount: 380,    note: 'Faturalar',           date: d(y, m - 4,  8) },
    // 5 months ago
    { id: uid(), type: 'income',  category: 'Maaş',           amount: 16000,  note: 'Maaş',               date: d(y, m - 5,  1) },
    { id: uid(), type: 'income',  category: 'Serbest Çalışma',amount: 2800,   note: 'Freelance iş',       date: d(y, m - 5, 20) },
    { id: uid(), type: 'expense', category: 'Kira',           amount: 6000,   note: 'Kira',                date: d(y, m - 5,  3) },
    { id: uid(), type: 'expense', category: 'Yemek',          amount: 2200,   note: 'Market',              date: d(y, m - 5, 14) },
    { id: uid(), type: 'expense', category: 'Sağlık',         amount: 450,    note: 'Muayene',             date: d(y, m - 5, 25) },
    { id: uid(), type: 'expense', category: 'Eğlence',        amount: 500,    note: 'Eğlence',             date: d(y, m - 5, 18) },
  ];

  // Normalize: negative month numbers get wrapped via JS Date
  const normalized = samples.map(tx => {
    const dt = new Date(tx.date);
    if (isNaN(dt.getTime())) return null;
    // Reformat date to always be valid ISO YYYY-MM-DD
    const iso = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
    return { ...tx, date: iso };
  }).filter(Boolean);

  transactions.push(...normalized);
  saveData();
  localStorage.setItem(SEED_KEY, '1');
}

/* ──────────────────────────────────────────────
   UTILITY
────────────────────────────────────────────── */
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/**
 * Format a number as Turkish Lira: "1.250,00 ₺"
 */
function formatTRY(amount) {
  const absVal = Math.abs(amount);
  const str = absVal.toFixed(2);
  const [intPart, decPart] = str.split('.');
  // thousands separator = "."  decimal = ","
  const intFormatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${intFormatted},${decPart} ₺`;
}

function todayISO() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
}

function txDate(tx) {
  return new Date(tx.date + 'T00:00:00');
}

/** Return { year, month } of a transaction (month is 0-based) */
function txYM(tx) {
  const d = txDate(tx);
  return { year: d.getFullYear(), month: d.getMonth() };
}

function monthLabel(year, monthIdx) {
  return `${MONTH_NAMES[monthIdx]} ${year}`;
}

/** Transactions for the currently displayed month */
function monthTransactions() {
  return transactions.filter(tx => {
    const ym = txYM(tx);
    return ym.year === currentYear && ym.month === currentMonthIdx;
  });
}

function getCategoryEmoji(type, label) {
  const list = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const found = list.find(c => c.label === label);
  return found ? found.emoji : '💰';
}

function formatDate(isoStr) {
  const d = new Date(isoStr + 'T00:00:00');
  return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`;
}

/* ──────────────────────────────────────────────
   NAVIGATION
────────────────────────────────────────────── */
function switchTab(tab) {
  activeTab = tab;

  // Pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(`page-${tab}`).classList.add('active');

  // Nav tabs
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.getElementById(`tab-${tab}`).classList.add('active');

  if (tab === 'charts') {
    renderCharts();
  }
}

/* ──────────────────────────────────────────────
   MONTH NAVIGATION
────────────────────────────────────────────── */
function updateMonthDisplay() {
  document.getElementById('currentMonth').textContent = monthLabel(currentYear, currentMonthIdx);
}

document.getElementById('prevMonth').addEventListener('click', () => {
  if (currentMonthIdx === 0) {
    currentMonthIdx = 11;
    currentYear--;
  } else {
    currentMonthIdx--;
  }
  updateMonthDisplay();
  renderHome();
});

document.getElementById('nextMonth').addEventListener('click', () => {
  if (currentMonthIdx === 11) {
    currentMonthIdx = 0;
    currentYear++;
  } else {
    currentMonthIdx++;
  }
  updateMonthDisplay();
  renderHome();
});

/* ──────────────────────────────────────────────
   RENDER — HOME PAGE
────────────────────────────────────────────── */
function renderHome() {
  const txs     = monthTransactions();
  const income  = txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const net     = income - expense;

  // Balance
  const balEl = document.getElementById('netBalance');
  balEl.textContent = formatTRY(net);
  balEl.className = 'balance-amount ' + (net >= 0 ? 'positive' : 'negative');

  // Summary cards
  document.getElementById('totalIncome').textContent  = formatTRY(income);
  document.getElementById('totalExpense').textContent = formatTRY(expense);

  // Category breakdown (expenses only)
  renderCategoryList(txs, expense);

  // Recent transactions (last 5)
  const recent = [...txs].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
  renderTxItems(document.getElementById('recentTxList'), recent, false);
}

function renderCategoryList(txs, totalExpense) {
  const expenseTxs = txs.filter(t => t.type === 'expense');
  const byCategory = {};

  expenseTxs.forEach(tx => {
    byCategory[tx.category] = (byCategory[tx.category] || 0) + tx.amount;
  });

  const container = document.getElementById('categoryList');

  if (Object.keys(byCategory).length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📭</div>
        <div class="empty-title">Gider yok</div>
        <div class="empty-sub">Bu ay henüz gider eklenmemiş.</div>
      </div>`;
    return;
  }

  const sorted = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
  const maxAmt = sorted[0][1];

  container.innerHTML = sorted.map(([cat, amt], i) => {
    const pct   = totalExpense > 0 ? (amt / totalExpense) * 100 : 0;
    const color = CATEGORY_COLORS[i % CATEGORY_COLORS.length];
    const emoji = getCategoryEmoji('expense', cat);
    return `
      <div class="category-item">
        <div class="cat-icon" style="background:${color}22;">${emoji}</div>
        <div class="cat-info">
          <div class="cat-name">${cat}</div>
          <div class="cat-bar-wrap">
            <div class="cat-bar" style="width:${(amt/maxAmt)*100}%; background:${color};"></div>
          </div>
        </div>
        <div class="cat-amount" style="color:${color};">${formatTRY(amt)}</div>
      </div>`;
  }).join('');
}

/* ──────────────────────────────────────────────
   RENDER — TRANSACTION ITEMS (shared helper)
────────────────────────────────────────────── */
function renderTxItems(container, txs, showEmpty = true) {
  if (txs.length === 0) {
    if (showEmpty) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🗂️</div>
          <div class="empty-title">İşlem bulunamadı</div>
          <div class="empty-sub">Seçili ay ve filtreye uygun işlem yok.</div>
        </div>`;
    } else {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">✨</div>
          <div class="empty-title">Henüz işlem yok</div>
          <div class="empty-sub">Aşağıdaki + butonuna tıklayarak işlem ekleyin.</div>
        </div>`;
    }
    return;
  }

  container.innerHTML = txs.map(tx => {
    const emoji  = getCategoryEmoji(tx.type, tx.category);
    const prefix = tx.type === 'income' ? '+' : '-';
    return `
      <div class="tx-item" data-id="${tx.id}">
        <div class="tx-icon ${tx.type}">${emoji}</div>
        <div class="tx-info">
          <div class="tx-category">${tx.category}</div>
          ${tx.note ? `<div class="tx-note">${escapeHtml(tx.note)}</div>` : ''}
          <div class="tx-date">${formatDate(tx.date)}</div>
        </div>
        <div class="tx-right">
          <div class="tx-amount ${tx.type}">${prefix}${formatTRY(tx.amount)}</div>
          <button class="tx-delete" onclick="askDelete('${tx.id}')" aria-label="Sil">🗑️</button>
        </div>
      </div>`;
  }).join('');
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ──────────────────────────────────────────────
   RENDER — TRANSACTIONS PAGE
────────────────────────────────────────────── */
function renderTransactions() {
  const txs = monthTransactions()
    .filter(tx => {
      if (currentFilter === 'income')  return tx.type === 'income';
      if (currentFilter === 'expense') return tx.type === 'expense';
      return true;
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  renderTxItems(document.getElementById('allTxList'), txs, true);
}

// Filter chip clicks
document.querySelectorAll('.filter-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    currentFilter = chip.dataset.filter;
    renderTransactions();
  });
});

/* ──────────────────────────────────────────────
   RENDER — CHARTS
────────────────────────────────────────────── */
function renderCharts() {
  renderPieChart();
  renderBarChart();
}

function renderPieChart() {
  const txs = monthTransactions().filter(t => t.type === 'expense');
  const canvas = document.getElementById('pieChart');
  const wrap   = canvas.parentElement;

  if (pieChartInst) {
    pieChartInst.destroy();
    pieChartInst = null;
  }

  if (txs.length === 0) {
    canvas.style.display = 'none';
    // Remove old placeholder if any
    let ph = wrap.querySelector('.no-data-chart');
    if (!ph) {
      ph = document.createElement('div');
      ph.className = 'no-data-chart';
      ph.innerHTML = '<div class="no-data-chart-icon">📊</div><div>Bu ay gider verisi yok</div>';
      wrap.appendChild(ph);
    }
    return;
  }

  // Remove placeholder if present
  const ph = wrap.querySelector('.no-data-chart');
  if (ph) ph.remove();
  canvas.style.display = '';

  const byCategory = {};
  txs.forEach(tx => {
    byCategory[tx.category] = (byCategory[tx.category] || 0) + tx.amount;
  });

  const labels = Object.keys(byCategory);
  const data   = Object.values(byCategory);
  const colors = labels.map((_, i) => CATEGORY_COLORS[i % CATEGORY_COLORS.length]);

  pieChartInst = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        borderWidth: 2,
        borderColor: '#fff',
        hoverOffset: 8,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '62%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            font: { size: 11, weight: '600' },
            padding: 12,
            boxWidth: 12,
            color: '#1A1A2E',
          }
        },
        tooltip: {
          callbacks: {
            label(ctx) {
              const val = ctx.parsed;
              const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
              const pct = ((val / total) * 100).toFixed(1);
              return ` ${formatTRY(val)} (${pct}%)`;
            }
          }
        }
      }
    }
  });
}

function renderBarChart() {
  const canvas = document.getElementById('barChart');
  const wrap   = canvas.parentElement;

  if (barChartInst) {
    barChartInst.destroy();
    barChartInst = null;
  }

  // Build last 6 months data
  const months = [];
  for (let i = 5; i >= 0; i--) {
    let y = currentYear;
    let m = currentMonthIdx - i;
    while (m < 0)  { m += 12; y--; }
    while (m > 11) { m -= 12; y++; }
    months.push({ year: y, month: m });
  }

  const labels   = months.map(({ year, month }) => `${MONTH_NAMES[month].slice(0, 3)} ${String(year).slice(2)}`);
  const incomes  = months.map(({ year, month }) =>
    transactions
      .filter(tx => { const ym = txYM(tx); return ym.year === year && ym.month === month && tx.type === 'income'; })
      .reduce((s, tx) => s + tx.amount, 0)
  );
  const expenses = months.map(({ year, month }) =>
    transactions
      .filter(tx => { const ym = txYM(tx); return ym.year === year && ym.month === month && tx.type === 'expense'; })
      .reduce((s, tx) => s + tx.amount, 0)
  );

  const hasData = incomes.some(v => v > 0) || expenses.some(v => v > 0);
  if (!hasData) {
    canvas.style.display = 'none';
    let ph = wrap.querySelector('.no-data-chart');
    if (!ph) {
      ph = document.createElement('div');
      ph.className = 'no-data-chart';
      ph.innerHTML = '<div class="no-data-chart-icon">📅</div><div>Henüz veri yok</div>';
      wrap.appendChild(ph);
    }
    return;
  }

  const ph2 = wrap.querySelector('.no-data-chart');
  if (ph2) ph2.remove();
  canvas.style.display = '';

  barChartInst = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Gelir',
          data: incomes,
          backgroundColor: 'rgba(34, 197, 94, 0.80)',
          borderColor: '#22C55E',
          borderWidth: 1.5,
          borderRadius: 6,
          borderSkipped: false,
        },
        {
          label: 'Gider',
          data: expenses,
          backgroundColor: 'rgba(239, 68, 68, 0.80)',
          borderColor: '#EF4444',
          borderWidth: 1.5,
          borderRadius: 6,
          borderSkipped: false,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          labels: {
            font: { size: 11, weight: '600' },
            padding: 12,
            boxWidth: 12,
            color: '#1A1A2E',
          }
        },
        tooltip: {
          callbacks: {
            label(ctx) {
              return ` ${ctx.dataset.label}: ${formatTRY(ctx.parsed.y)}`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { size: 10, weight: '600' }, color: '#6B7280' },
        },
        y: {
          grid: { color: 'rgba(0,0,0,0.05)' },
          ticks: {
            font: { size: 10 },
            color: '#6B7280',
            callback(value) {
              if (value >= 1000) return (value / 1000).toFixed(0) + 'K ₺';
              return value + ' ₺';
            }
          }
        }
      }
    }
  });
}

/* ──────────────────────────────────────────────
   MODAL — OPEN / CLOSE
────────────────────────────────────────────── */
function openModal() {
  // Reset form
  document.getElementById('inputAmount').value  = '';
  document.getElementById('inputNote').value    = '';
  document.getElementById('inputDate').value    = todayISO();
  setType(currentType);   // refresh categories but keep last selected type

  const overlay = document.getElementById('modalOverlay');
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';

  // Focus amount field after animation
  setTimeout(() => document.getElementById('inputAmount').focus(), 350);
}

function closeModal() {
  const overlay = document.getElementById('modalOverlay');
  overlay.classList.remove('open');
  document.body.style.overflow = '';
}

function handleOverlayClick(e) {
  if (e.target === e.currentTarget) closeModal();
}

/* ──────────────────────────────────────────────
   MODAL — TYPE TOGGLE
────────────────────────────────────────────── */
function setType(type) {
  currentType = type;

  const incBtn = document.getElementById('typeIncome');
  const expBtn = document.getElementById('typeExpense');

  incBtn.classList.toggle('active', type === 'income');
  expBtn.classList.toggle('active', type === 'expense');

  // Refresh category dropdown
  const select = document.getElementById('inputCategory');
  const list   = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  select.innerHTML = list.map(c => `<option value="${c.label}">${c.emoji} ${c.label}</option>`).join('');
}

/* ──────────────────────────────────────────────
   MODAL — SUBMIT
────────────────────────────────────────────── */
function submitTransaction() {
  const amountRaw = document.getElementById('inputAmount').value.trim();
  const category  = document.getElementById('inputCategory').value;
  const note      = document.getElementById('inputNote').value.trim();
  const date      = document.getElementById('inputDate').value;

  // Validate
  const amount = parseFloat(amountRaw);
  if (!amountRaw || isNaN(amount) || amount <= 0) {
    showToast('Lütfen geçerli bir tutar girin.');
    document.getElementById('inputAmount').focus();
    return;
  }

  if (!date) {
    showToast('Lütfen bir tarih seçin.');
    return;
  }

  const tx = {
    id:       uid(),
    type:     currentType,
    category,
    amount:   Math.round(amount * 100) / 100,
    note,
    date,
  };

  transactions.unshift(tx);
  saveData();
  closeModal();

  // Re-render current views
  renderHome();
  renderTransactions();
  if (activeTab === 'charts') renderCharts();

  const typeLabel = currentType === 'income' ? 'Gelir' : 'Gider';
  showToast(`${typeLabel} başarıyla eklendi! ✓`);
}

/* ──────────────────────────────────────────────
   DELETE
────────────────────────────────────────────── */
function askDelete(id) {
  pendingDeleteId = id;
  document.getElementById('confirmOverlay').classList.add('open');
}

function cancelDelete() {
  pendingDeleteId = null;
  document.getElementById('confirmOverlay').classList.remove('open');
}

function confirmDelete() {
  if (!pendingDeleteId) return;
  transactions = transactions.filter(tx => tx.id !== pendingDeleteId);
  saveData();
  pendingDeleteId = null;
  document.getElementById('confirmOverlay').classList.remove('open');

  renderHome();
  renderTransactions();
  if (activeTab === 'charts') renderCharts();

  showToast('İşlem silindi.');
}

/* ──────────────────────────────────────────────
   TOAST
────────────────────────────────────────────── */
let toastTimer = null;

function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3000);
}

/* ──────────────────────────────────────────────
   KEYBOARD
────────────────────────────────────────────── */
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeModal();
    cancelDelete();
  }
  if (e.key === 'Enter' && document.getElementById('modalOverlay').classList.contains('open')) {
    submitTransaction();
  }
});

/* ──────────────────────────────────────────────
   SERVICE WORKER REGISTRATION
────────────────────────────────────────────── */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(err => {
      console.warn('SW registration failed:', err);
    });
  });
}

/* ──────────────────────────────────────────────
   INIT
────────────────────────────────────────────── */
function init() {
  loadData();
  seedSampleData();

  // If seedSampleData added data, reload from storage
  loadData();

  updateMonthDisplay();
  setType('income');  // initialise category dropdown

  renderHome();
  renderTransactions();
}

init();
