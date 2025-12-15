// CONFIGURATION
// ⬇️ THIS IS THE IMPORTANT CHANGE ⬇️
const SERVER_URL = "https://stock-broker-dashboard-zqyr.onrender.com"; 
const STOCKS = ['GOOG', 'TSLA', 'AMZN', 'META', 'NVDA'];
const MAX_POINTS = 50;

// STATE
let state = {
    user: null,
    cash: 10000.00,
    portfolio: {},     // { 'GOOG': { qty: 5, avg: 140.20 } }
    transactions: [],  // History log
    subscriptions: new Set(),
    charts: {},
    prices: {},        
    history: {}        
};

const socket = io(SERVER_URL);

// --- DOM ELEMENTS ---
const dom = {
    loginOverlay: document.getElementById('login-overlay'),
    app: document.getElementById('app-container'),
    emailInput: document.getElementById('email-input'),
    loginForm: document.getElementById('login-form'),
    logoutBtn: document.getElementById('logout-btn'),
    
    cash: document.getElementById('cash-display'),
    netWorth: document.getElementById('net-worth-display'),
    userId: document.getElementById('user-id'),
    watchlist: document.getElementById('watchlist-container'),
    chartsGrid: document.getElementById('charts-grid'),
    emptyState: document.getElementById('empty-state'), // The box we need to hide
    portfolioBody: document.getElementById('portfolio-body'),
    transactionList: document.getElementById('transaction-list'),
    
    // Modal
    modal: document.getElementById('trade-modal'),
    modalTitle: document.getElementById('modal-title'),
    modalPrice: document.getElementById('modal-price'),
    tradeQty: document.getElementById('trade-qty'),
    btnBuy: document.getElementById('btn-buy-confirm'),
    btnSell: document.getElementById('btn-sell-confirm')
};

let activeTicker = null;

// --- 1. INITIALIZATION & LOGIN ---
dom.loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if(dom.emailInput.value) {
        state.user = dom.emailInput.value;
        dom.userId.innerText = state.user;
        dom.loginOverlay.classList.remove('active');
        dom.app.classList.add('active');
        initSidebar();
        updateWallet();
    }
});

// --- LOGOUT / EXIT BUTTON ---
dom.logoutBtn.addEventListener('click', () => {
    state.user = null;
    state.cash = 10000.00;
    state.portfolio = {};
    state.transactions = [];
    state.subscriptions.clear();
    
    dom.watchlist.innerHTML = '';
    
    // Reset charts area to show empty state
    dom.chartsGrid.innerHTML = `
        <div id="empty-state" class="placeholder-box">
            Select assets from the sidebar to initialize live feeds.
        </div>`;
    // Re-bind emptyState element after innerHTML change
    dom.emptyState = document.getElementById('empty-state');
    
    dom.portfolioBody.innerHTML = '';
    dom.transactionList.innerHTML = '';
    
    Object.values(state.charts).forEach(chart => chart.destroy());
    state.charts = {};

    dom.app.classList.remove('active');
    dom.loginOverlay.classList.add('active');
    dom.emailInput.value = '';
});

function initSidebar() {
    dom.watchlist.innerHTML = '';
    STOCKS.forEach(ticker => {
        const btn = document.createElement('div');
        btn.className = 'stock-btn';
        btn.id = `btn-${ticker}`;
        btn.innerHTML = `<span>${ticker}</span> <span>+</span>`;
        btn.onclick = () => toggleSub(ticker);
        dom.watchlist.appendChild(btn);
    });
}

// --- 2. SOCKET LISTENERS ---
socket.on('market-update', (data) => {
    state.prices = data;
    if(state.user) {
        updateCharts(data);
        updatePortfolioTable();
        updateWallet();

        if(dom.modal.classList.contains('active') && activeTicker) {
            dom.modalPrice.innerText = `$${data[activeTicker].toFixed(2)}`;
        }
    }
});

// --- 3. SUBSCRIPTION & CHARTS ---
function toggleSub(ticker) {
    const btn = document.getElementById(`btn-${ticker}`);
    
    if(state.subscriptions.has(ticker)) {
        state.subscriptions.delete(ticker);
        btn.classList.remove('selected');
        btn.innerHTML = `<span>${ticker}</span> <span>+</span>`;
        removeChart(ticker);
    } else {
        state.subscriptions.add(ticker);
        btn.classList.add('selected');
        btn.innerHTML = `<span>${ticker}</span> <span style="color:var(--accent)">●</span>`;
        addChart(ticker);
    }
    
    // --- FIX: Logic to toggle the Empty State Box ---
    // If we have at least 1 subscription, hide the box. Else, show it.
    if (dom.emptyState) {
        dom.emptyState.style.display = state.subscriptions.size > 0 ? 'none' : 'flex';
    }
}

function addChart(ticker) {
    const card = document.createElement('div');
    card.className = 'chart-card';
    card.id = `card-${ticker}`;
    card.innerHTML = `
        <div class="card-top">
            <span class="ticker">${ticker}</span>
            <span class="live-price" id="price-${ticker}">...</span>
        </div>
        <div style="height: 200px; padding:10px;">
            <canvas id="canvas-${ticker}"></canvas>
        </div>
        <div class="action-bar">
            <button class="btn-trade" onclick="openTradeModal('${ticker}')">TRADE</button>
        </div>
    `;
    dom.chartsGrid.appendChild(card);

    const ctx = document.getElementById(`canvas-${ticker}`).getContext('2d');
    state.history[ticker] = [];
    state.charts[ticker] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                data: [],
                borderColor: '#00E396',
                backgroundColor: 'rgba(0, 227, 150, 0.1)',
                borderWidth: 2,
                fill: true,
                pointRadius: 0,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { x: { display: false }, y: { position: 'right', grid: { color: '#263238' } } },
            animation: false
        }
    });
}

function removeChart(ticker) {
    if(state.charts[ticker]) {
        state.charts[ticker].destroy();
        delete state.charts[ticker];
    }
    const el = document.getElementById(`card-${ticker}`);
    if(el) el.remove();
}

function updateCharts(prices) {
    const time = new Date().toLocaleTimeString();
    state.subscriptions.forEach(ticker => {
        const price = prices[ticker];
        const chart = state.charts[ticker];
        const priceEl = document.getElementById(`price-${ticker}`);
        
        if(priceEl) {
            const prev = state.history[ticker][state.history[ticker].length-1] || price;
            priceEl.innerText = price.toFixed(2);
            priceEl.className = `live-price ${price >= prev ? 'color-up' : 'color-down'}`;
            chart.data.datasets[0].borderColor = price >= prev ? '#00E396' : '#FF4560';
        }

        chart.data.labels.push(time);
        chart.data.datasets[0].data.push(price);
        if(chart.data.labels.length > MAX_POINTS) {
            chart.data.labels.shift();
            chart.data.datasets[0].data.shift();
        }
        chart.update();
        state.history[ticker].push(price);
    });
}

// --- 4. TRADING SYSTEM ---

window.openTradeModal = function(ticker) {
    activeTicker = ticker;
    dom.modalTitle.innerText = `TRADE ${ticker}`;
    dom.tradeQty.value = 1;
    dom.modal.classList.add('active');
}

window.closeModal = function() {
    dom.modal.classList.remove('active');
    activeTicker = null;
}

dom.btnBuy.onclick = () => executeTrade('BUY');
dom.btnSell.onclick = () => executeTrade('SELL');

function executeTrade(action) {
    const qty = parseInt(dom.tradeQty.value);
    const ticker = activeTicker;
    const price = state.prices[ticker];

    if(qty <= 0) return alert("Invalid Quantity");

    const totalCost = qty * price;

    if(action === 'BUY') {
        if(state.cash < totalCost) return alert("Insufficient Funds!");
        state.cash -= totalCost;
        if(!state.portfolio[ticker]) state.portfolio[ticker] = { qty: 0, avg: 0 };
        const oldQty = state.portfolio[ticker].qty;
        const oldAvg = state.portfolio[ticker].avg;
        const newAvg = ((oldQty * oldAvg) + totalCost) / (oldQty + qty);
        state.portfolio[ticker].qty += qty;
        state.portfolio[ticker].avg = newAvg;
    } else { // SELL
        if(!state.portfolio[ticker] || state.portfolio[ticker].qty < qty) {
            return alert("You don't own enough shares!");
        }
        state.cash += totalCost;
        state.portfolio[ticker].qty -= qty;
        if(state.portfolio[ticker].qty <= 0) delete state.portfolio[ticker];
    }
    
    addTransactionToLog(ticker, action, qty, price);
    updateWallet();
    updatePortfolioTable();
    closeModal();
}

function addTransactionToLog(ticker, action, qty, price) {
    state.transactions.unshift({
        time: new Date().toLocaleTimeString(),
        ticker, action, qty, price
    });
    renderTransactionList();
}

function renderTransactionList() {
    dom.transactionList.innerHTML = '';
    state.transactions.slice(0, 8).forEach(t => {
        const li = document.createElement('li');
        const color = t.action === 'BUY' ? 'color-up' : 'color-down';
        li.innerHTML = `
            <span><b class="${color}">${t.action}</b> ${t.qty} ${t.ticker}</span>
            <span style="color:#90A4AE; font-size: 0.8rem;">$${t.price.toFixed(2)}</span>
        `;
        dom.transactionList.appendChild(li);
    });
}

// --- 5. UI UPDATES ---
function updateWallet() {
    dom.cash.innerText = `$${state.cash.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
    let holdingsVal = 0;
    Object.keys(state.portfolio).forEach(t => {
        holdingsVal += state.portfolio[t].qty * (state.prices[t] || 0);
    });
    dom.netWorth.innerText = `$${(state.cash + holdingsVal).toLocaleString(undefined, {minimumFractionDigits: 2})}`;
}

function updatePortfolioTable() {
    dom.portfolioBody.innerHTML = '';
    Object.keys(state.portfolio).forEach(t => {
        const data = state.portfolio[t];
        const curr = state.prices[t] || 0;
        const mktVal = data.qty * curr;
        const pnl = mktVal - (data.qty * data.avg);
        const row = document.createElement('tr');
        row.innerHTML = `
            <td style="color:#fff; font-weight:bold">${t}</td>
            <td>${data.qty}</td>
            <td>${data.avg.toFixed(2)}</td>
            <td>${mktVal.toFixed(2)}</td>
            <td class="${pnl >= 0 ? 'color-up' : 'color-down'}">${pnl.toFixed(2)}</td>
            <td>
                <button class="btn-sell-small" onclick="activeTicker='${t}'; executeTrade('SELL')">SELL ALL</button>
            </td>
        `;
        dom.portfolioBody.appendChild(row);
    });
}