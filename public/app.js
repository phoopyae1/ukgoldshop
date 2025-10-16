const selectors = {
    loginSection: document.getElementById('login-section'),
    loginForm: document.getElementById('login-form'),
    role: document.getElementById('role'),
    username: document.getElementById('username'),
    password: document.getElementById('password'),
    loginError: document.getElementById('login-error'),
    adminDashboard: document.getElementById('admin-dashboard'),
    dataDashboard: document.getElementById('data-dashboard'),
    adminLogout: document.getElementById('admin-logout'),
    dataLogout: document.getElementById('data-logout'),
    goldForm: document.getElementById('gold-form'),
    goldName: document.getElementById('gold-name'),
    goldPrice: document.getElementById('gold-price'),
    goldImage: document.getElementById('gold-image'),
    goldError: document.getElementById('gold-error'),
    goldTable: document.getElementById('gold-table'),
    pawnForm: document.getElementById('pawn-form'),
    customerName: document.getElementById('customer-name'),
    principal: document.getElementById('principal'),
    interestRate: document.getElementById('interest-rate'),
    pawnDate: document.getElementById('pawn-date'),
    loanTerm: document.getElementById('loan-term'),
    monthlyInterestDisplay: document.getElementById('monthly-interest'),
    totalPayableDisplay: document.getElementById('total-payable'),
    pawnError: document.getElementById('pawn-error'),
    pawnTable: document.getElementById('pawn-table'),
    analysisDay: document.getElementById('analysis-day'),
    dailyCount: document.getElementById('daily-count'),
    dailyPrincipal: document.getElementById('daily-principal'),
    dailyInterest: document.getElementById('daily-interest'),
    analysisMonth: document.getElementById('analysis-month'),
    monthlyCount: document.getElementById('monthly-count'),
    monthlyPrincipal: document.getElementById('monthly-principal'),
    monthlyInterest: document.getElementById('monthly-interest'),
    year: document.getElementById('year')
};

const credentials = {
    admin: { username: 'admin', password: 'admin123' },
    'data-admin': { username: 'dataman', password: 'data123' }
};

let goldInventory = [];
let pawnRecords = [];
let activeRole = null;

function formatCurrency(amount) {
    return Number(amount || 0).toLocaleString('en-GB', {
        style: 'currency',
        currency: 'GBP'
    });
}

function formatDate(dateString) {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('en-GB', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function saveState() {
    localStorage.setItem('ukgoldshop_inventory', JSON.stringify(goldInventory));
    localStorage.setItem('ukgoldshop_pawn_records', JSON.stringify(pawnRecords));
}

function loadState() {
    try {
        const inventoryRaw = localStorage.getItem('ukgoldshop_inventory');
        const pawnRaw = localStorage.getItem('ukgoldshop_pawn_records');
        goldInventory = inventoryRaw ? JSON.parse(inventoryRaw) : [];
        pawnRecords = pawnRaw ? JSON.parse(pawnRaw) : [];
    } catch (error) {
        console.error('Failed to load state', error);
        goldInventory = [];
        pawnRecords = [];
    }
}

function renderGoldTable() {
    selectors.goldTable.innerHTML = '';
    if (!goldInventory.length) {
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.colSpan = 4;
        cell.textContent = 'No gold items uploaded yet.';
        cell.className = 'muted';
        row.appendChild(cell);
        selectors.goldTable.appendChild(row);
        return;
    }

    goldInventory
        .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))
        .forEach((item) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><img src="${item.image}" alt="${item.name}" /></td>
                <td>${item.name}</td>
                <td>${formatCurrency(item.price)}</td>
                <td>${formatDate(item.uploadedAt)}</td>
            `;
            selectors.goldTable.appendChild(row);
        });
}

function renderPawnTable() {
    selectors.pawnTable.innerHTML = '';
    if (!pawnRecords.length) {
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.colSpan = 7;
        cell.textContent = 'No pawn records yet. Add your first transaction above.';
        cell.className = 'muted';
        row.appendChild(cell);
        selectors.pawnTable.appendChild(row);
        return;
    }

    pawnRecords
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .forEach((record) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${record.customerName}</td>
                <td>${formatCurrency(record.principal)}</td>
                <td>${(Number(record.interestRate) * 100).toFixed(1)}%</td>
                <td>${formatCurrency(record.monthlyInterest)}</td>
                <td>${formatCurrency(record.totalPayable)}</td>
                <td>${formatDate(record.date)}</td>
                <td>${record.term}</td>
            `;
            selectors.pawnTable.appendChild(row);
        });
}

function updateDailyAnalysis(date = new Date()) {
    const target = new Date(date);
    const iso = target.toISOString().slice(0, 10);
    selectors.analysisDay.textContent = target.toLocaleDateString('en-GB', {
        weekday: 'long',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });

    const dayRecords = pawnRecords.filter((record) => record.date === iso);
    const totals = dayRecords.reduce(
        (acc, record) => {
            acc.principal += Number(record.principal);
            acc.interest += Number(record.monthlyInterest) * Number(record.term);
            return acc;
        },
        { principal: 0, interest: 0 }
    );

    selectors.dailyCount.textContent = dayRecords.length;
    selectors.dailyPrincipal.textContent = formatCurrency(totals.principal);
    selectors.dailyInterest.textContent = formatCurrency(totals.interest);
}

function updateMonthlyAnalysis(monthInput) {
    const targetMonth = monthInput || selectors.analysisMonth.value;
    if (!targetMonth) {
        selectors.monthlyCount.textContent = '0';
        selectors.monthlyPrincipal.textContent = formatCurrency(0);
        selectors.monthlyInterest.textContent = formatCurrency(0);
        return;
    }

    const [year, month] = targetMonth.split('-').map(Number);
    const monthlyRecords = pawnRecords.filter((record) => {
        const date = new Date(record.date);
        return date.getFullYear() === year && date.getMonth() + 1 === month;
    });

    const totals = monthlyRecords.reduce(
        (acc, record) => {
            acc.principal += Number(record.principal);
            acc.interest += Number(record.monthlyInterest) * Number(record.term);
            return acc;
        },
        { principal: 0, interest: 0 }
    );

    selectors.monthlyCount.textContent = monthlyRecords.length;
    selectors.monthlyPrincipal.textContent = formatCurrency(totals.principal);
    selectors.monthlyInterest.textContent = formatCurrency(totals.interest);
}

function resetForms() {
    selectors.goldForm.reset();
    selectors.pawnForm.reset();
    selectors.monthlyInterestDisplay.textContent = '0.00';
    selectors.totalPayableDisplay.textContent = '0.00';
    const todayISO = new Date().toISOString().slice(0, 10);
    selectors.pawnDate.value = todayISO;
}

function toggleDashboard(role) {
    selectors.loginSection.classList.add('hidden');
    selectors.adminDashboard.classList.toggle('hidden', role !== 'admin');
    selectors.dataDashboard.classList.toggle('hidden', role !== 'data-admin');
    activeRole = role;

    if (role === 'admin') {
        renderGoldTable();
    }

    if (role === 'data-admin') {
        renderPawnTable();
        updateDailyAnalysis(new Date());
        updateMonthlyAnalysis();
    }
}

function logout() {
    activeRole = null;
    selectors.loginSection.classList.remove('hidden');
    selectors.adminDashboard.classList.add('hidden');
    selectors.dataDashboard.classList.add('hidden');
    selectors.loginForm.reset();
}

function convertFileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Could not read file'));
        reader.readAsDataURL(file);
    });
}

function handleLogin(event) {
    event.preventDefault();
    selectors.loginError.classList.add('hidden');

    const role = selectors.role.value;
    const username = selectors.username.value.trim();
    const password = selectors.password.value.trim();

    if (!role) {
        selectors.loginError.textContent = 'Please select a role to continue.';
        selectors.loginError.classList.remove('hidden');
        return;
    }

    const validCredentials = credentials[role];
    if (
        !validCredentials ||
        validCredentials.username.toLowerCase() !== username.toLowerCase() ||
        validCredentials.password !== password
    ) {
        selectors.loginError.textContent = 'Invalid username or password for the selected role.';
        selectors.loginError.classList.remove('hidden');
        return;
    }

    toggleDashboard(role);
}

async function handleGoldSubmit(event) {
    event.preventDefault();
    selectors.goldError.classList.add('hidden');

    const name = selectors.goldName.value.trim();
    const price = Number(selectors.goldPrice.value);
    const file = selectors.goldImage.files[0];

    if (!file) {
        selectors.goldError.textContent = 'Please select an image before uploading.';
        selectors.goldError.classList.remove('hidden');
        return;
    }

    if (file.size > 2 * 1024 * 1024) {
        selectors.goldError.textContent = 'Image is too large. Please upload a file under 2MB.';
        selectors.goldError.classList.remove('hidden');
        return;
    }

    try {
        const base64 = await convertFileToBase64(file);
        const item = {
            id: crypto.randomUUID(),
            name,
            price,
            image: base64,
            uploadedAt: new Date().toISOString()
        };
        goldInventory.push(item);
        saveState();
        renderGoldTable();
        selectors.goldForm.reset();
    } catch (error) {
        selectors.goldError.textContent = 'Something went wrong when processing the image.';
        selectors.goldError.classList.remove('hidden');
        console.error(error);
    }
}

function calculatePawnValues() {
    const principal = Number(selectors.principal.value);
    const interestRate = Number(selectors.interestRate.value);
    const term = Number(selectors.loanTerm.value || 0);

    if (!principal || !interestRate || !term) {
        selectors.monthlyInterestDisplay.textContent = '0.00';
        selectors.totalPayableDisplay.textContent = '0.00';
        return { monthlyInterest: 0, totalPayable: 0 };
    }

    const monthlyInterest = principal * interestRate;
    const totalPayable = principal + monthlyInterest * term;

    selectors.monthlyInterestDisplay.textContent = monthlyInterest.toFixed(2);
    selectors.totalPayableDisplay.textContent = totalPayable.toFixed(2);

    return { monthlyInterest, totalPayable };
}

function handlePawnInput() {
    calculatePawnValues();
}

function handlePawnSubmit(event) {
    event.preventDefault();
    selectors.pawnError.classList.add('hidden');

    const customerName = selectors.customerName.value.trim();
    const principal = Number(selectors.principal.value);
    const interestRate = Number(selectors.interestRate.value);
    const term = Number(selectors.loanTerm.value || 0);
    const date = selectors.pawnDate.value;

    if (!date) {
        selectors.pawnError.textContent = 'Please choose the pawn date.';
        selectors.pawnError.classList.remove('hidden');
        return;
    }

    const { monthlyInterest, totalPayable } = calculatePawnValues();

    if (!monthlyInterest || !totalPayable) {
        selectors.pawnError.textContent = 'Please enter a valid principal, rate and term.';
        selectors.pawnError.classList.remove('hidden');
        return;
    }

    const record = {
        id: crypto.randomUUID(),
        customerName,
        principal,
        interestRate,
        term,
        date,
        monthlyInterest,
        totalPayable
    };

    pawnRecords.push(record);
    saveState();
    renderPawnTable();
    updateDailyAnalysis(new Date(date));
    updateMonthlyAnalysis();
    selectors.pawnForm.reset();
    const todayISO = new Date().toISOString().slice(0, 10);
    selectors.pawnDate.value = todayISO;
    calculatePawnValues();
}

function init() {
    selectors.year.textContent = new Date().getFullYear();

    const todayISO = new Date().toISOString().slice(0, 10);
    selectors.pawnDate.value = todayISO;
    selectors.analysisMonth.value = todayISO.slice(0, 7);

    loadState();
    renderGoldTable();
    renderPawnTable();
    updateDailyAnalysis(new Date());
    updateMonthlyAnalysis(selectors.analysisMonth.value);

    selectors.loginForm.addEventListener('submit', handleLogin);
    selectors.adminLogout.addEventListener('click', logout);
    selectors.dataLogout.addEventListener('click', logout);
    selectors.goldForm.addEventListener('submit', handleGoldSubmit);

    [selectors.principal, selectors.interestRate, selectors.loanTerm].forEach((el) =>
        el.addEventListener('input', handlePawnInput)
    );

    selectors.pawnForm.addEventListener('submit', handlePawnSubmit);
    selectors.analysisMonth.addEventListener('change', (event) => {
        updateMonthlyAnalysis(event.target.value);
    });
}

window.addEventListener('DOMContentLoaded', init);
