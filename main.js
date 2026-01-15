// ============================================
// HEDGE MODULE - Frontend (Fetch API Version)
// ============================================

// 🔴 Google Apps Script Web App URL (used directly by Vercel API proxy)
const GAS_API_URL_RAW = 'https://script.google.com/macros/s/AKfycbwdm7GvLT81vvsWuhMQNWuZfYRT1S45-hju1YEpVKxcH-Qnzm91KJOtigBL-nV1JiTvTQ/exec';

// Detect environment and set API URL accordingly
const IS_LOCALHOST = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

// In production (Vercel): use /api/proxy serverless function
// In development (localhost): use local CORS proxy on port 8080
const GAS_API_URL = IS_LOCALHOST
    ? 'http://localhost:8080/' + GAS_API_URL_RAW  // Local CORS proxy
    : '/api/proxy';  // Vercel serverless function

// API Helper - Using GET for ALL operations (GAS CORS workaround)
// GAS Web Apps redirect, which causes CORS issues with POST. GET works reliably.
async function apiCall(action, data = {}) {
    // In production, GAS_API_URL is '/api/proxy' (relative), needs base URL
    // In development, GAS_API_URL is full URL with CORS proxy
    const url = IS_LOCALHOST
        ? new URL(GAS_API_URL)
        : new URL(GAS_API_URL, window.location.origin);
    url.searchParams.append('action', action);

    // For read operations, pass params directly
    if (action === 'getEntries') {
        // No extra params needed
    } else if (action === 'getOpenInventories') {
        if (data.commodity) url.searchParams.append('commodity', data.commodity);
        if (data.contract) url.searchParams.append('contract', data.contract);
    } else if (action === 'getInventoryPrices') {
        url.searchParams.append('codes', JSON.stringify(data.codes || []));
    } else {
        // For write operations, encode payload in URL
        url.searchParams.append('payload', JSON.stringify(data));
    }

    const response = await fetch(url.toString(), {
        method: 'GET',
        redirect: 'follow'
    });

    const result = await response.json();
    if (result.error) throw new Error(result.error);
    return result;
}

// DOM Helpers
const el = id => document.getElementById(id);
const qs = s => document.querySelector(s);

// Elements
const reasonSelect = el('reason');
const commodityInput = el('commodity');
const contractSelect = el('contract');
const nextContractRow = el('nextContractRow');
const nextContractSelect = el('nextContract');
const lotsInput = el('lotsInput');
const supplierRow = el('supplierRow');
const inventoryRow = el('inventoryRow');
const buyerRow = el('buyerRow');
const supplierInput = el('supplierName');
const validationMsg = el('validationMsg');
const submitBtn = el('submitBtn');
const btnText = el('btnText');
const avgPriceInput = el('avgPrice');
const rolloverGainsInput = el('rolloverGains');
const rolloverInfoDiv = el('rolloverInfo');

// ============================================
// CALCULATOR FUNCTIONS
// ============================================

function openCalculator() {
    el('calcModal').style.display = 'block';
    calculateAverage();
}

function closeCalculator() {
    el('calcModal').style.display = 'none';
}

function addCalcRow() {
    const c = el('calcRows');
    const d = document.createElement('div');
    d.className = 'calc-row';
    d.innerHTML = '<input type="number" class="calc-lots" placeholder="Lots" min="0" step="1" oninput="calculateAverage()"><input type="number" class="calc-price" placeholder="Price ₹" min="0" step="0.01" oninput="calculateAverage()"><button type="button" onclick="removeRow(this)">×</button>';
    c.appendChild(d);
}

function removeRow(btn) {
    if (document.querySelectorAll('.calc-row').length > 1) {
        btn.parentElement.remove();
        calculateAverage();
    }
}

function calculateAverage() {
    let total = 0, sum = 0;
    document.querySelectorAll('.calc-row').forEach(row => {
        const lots = parseFloat(row.querySelector('.calc-lots').value) || 0;
        const price = parseFloat(row.querySelector('.calc-price').value) || 0;
        total += lots;
        sum += lots * price;
    });
    const avg = total > 0 ? (sum / total).toFixed(2) : 0;
    el('totalLots').textContent = total;
    el('avgPriceCalc').textContent = avg;
    el('calcResult').style.display = total > 0 ? 'block' : 'none';
}

function usePriceAndClose() {
    const price = el('avgPriceCalc').textContent;
    if (parseFloat(price) > 0) {
        avgPriceInput.value = price;
        closeCalculator();
    } else {
        alert('Please enter valid lots and prices');
    }
}

// ============================================
// POPUP FUNCTIONS
// ============================================

function showPopup(message, type) {
    const popup = el('formPopup');
    const title = el('formPopupTitle');
    el('formPopupBody').innerHTML = message;
    title.textContent = type === 'success' ? 'Success' : 'Attention';
    popup.style.display = 'block';
    if (type === 'success') setTimeout(hidePopup, 2000);
}

function hidePopup() {
    el('formPopup').style.display = 'none';
}

// ============================================
// FORM LOGIC
// ============================================

function updateNextContractOptions() {
    if (reasonSelect.value !== 'Rollover') return;
    const curr = contractSelect.value;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    nextContractSelect.innerHTML = '<option value="">Select next contract month...</option>';

    if (!curr) {
        months.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m;
            opt.textContent = m;
            nextContractSelect.appendChild(opt);
        });
        return;
    }

    const idx = months.indexOf(curr);
    for (let i = 1; i < months.length; i++) {
        const nextIdx = (idx + i) % months.length;
        const month = months[nextIdx];
        const opt = document.createElement('option');
        opt.value = month;
        opt.textContent = month;
        nextContractSelect.appendChild(opt);
    }
}

function updateReasonFields() {
    const val = reasonSelect.value;
    validationMsg.innerHTML = '';
    avgPriceInput.value = '';
    rolloverGainsInput.value = '';
    const avgPriceRow = el('avgPriceRow');
    const rolloverGainsRow = el('rolloverGainsRow');

    if (val === 'Sell') {
        supplierRow.style.display = 'block';
        inventoryRow.style.display = 'none';
        buyerRow.style.display = 'none';
        nextContractRow.style.display = 'none';
        avgPriceRow.style.display = 'block';
        rolloverGainsRow.style.display = 'none';
        supplierInput.required = true;
        avgPriceInput.required = true;
        nextContractSelect.required = false;
        submitBtn.disabled = true;
        validationMsg.innerHTML = '<div class="warning-text">⚠️ Please fill Supplier Name and Average Price</div>';
    } else if (val === 'Buy') {
        supplierRow.style.display = 'none';
        inventoryRow.style.display = 'block';
        buyerRow.style.display = 'block';
        nextContractRow.style.display = 'none';
        avgPriceRow.style.display = 'block';
        rolloverGainsRow.style.display = 'none';
        supplierInput.required = false;
        avgPriceInput.required = true;
        nextContractSelect.required = false;
        if (commodityInput.value && contractSelect.value) {
            validateAndLoadInventories();
        } else {
            validationMsg.innerHTML = '<div class="warning-text">⚠️ Please select Commodity & Contract first</div>';
            submitBtn.disabled = true;
        }
    } else if (val === 'Rollover') {
        supplierRow.style.display = 'none';
        inventoryRow.style.display = 'block';
        buyerRow.style.display = 'block';
        nextContractRow.style.display = 'block';
        avgPriceRow.style.display = 'none';
        rolloverGainsRow.style.display = 'block';
        supplierInput.required = false;
        avgPriceInput.required = false;
        nextContractSelect.required = true;
        el('rolloverGains').required = true;
        updateNextContractOptions();
        if (commodityInput.value && contractSelect.value) {
            validateAndLoadInventories();
        } else {
            validationMsg.innerHTML = '<div class="warning-text">⚠️ Please select Commodity & Contract first</div>';
            submitBtn.disabled = true;
        }
    } else {
        supplierRow.style.display = 'none';
        inventoryRow.style.display = 'none';
        buyerRow.style.display = 'none';
        nextContractRow.style.display = 'none';
        avgPriceRow.style.display = 'block';
        rolloverGainsRow.style.display = 'none';
        supplierInput.required = false;
        avgPriceInput.required = true;
        nextContractSelect.required = false;
        submitBtn.disabled = false;
    }
}

// ============================================
// INVENTORY LOADING (Using Fetch)
// ============================================

async function validateAndLoadInventories() {
    const commodity = commodityInput.value;
    const contract = contractSelect.value;
    const reason = reasonSelect.value;
    const reqLots = parseFloat(lotsInput.value) || 0;

    if (!commodity || !contract || (reason !== 'Buy' && reason !== 'Rollover')) return;

    el('inventoryTable').style.display = 'none';
    el('inventoryTableBody').innerHTML = '<tr><td colspan="4" style="padding:10px;text-align:center;">Loading...</td></tr>';
    submitBtn.disabled = true;
    validationMsg.innerHTML = '';

    try {
        const inventories = await apiCall('getOpenInventories', { commodity, contract });

        if (inventories.length === 0) {
            el('inventoryTableBody').innerHTML = '<tr><td colspan="4" style="padding:10px;text-align:center;">No open SELL positions</td></tr>';
            el('inventoryTable').style.display = 'none';
            validationMsg.innerHTML = '<div class="warning-text">❌ No SELL position found for ' + commodity + ' ' + contract + '. Cannot ' + reason + ' without SELL position first.</div>';
            submitBtn.disabled = true;
        } else {
            const total = inventories.reduce((s, inv) => s + inv.openLots, 0);
            let html = '';
            inventories.forEach(inv => {
                html += '<tr style="border-bottom:1px solid #e8e8e8;"><td style="padding:8px;"><input type="checkbox" class="inv-checkbox" data-code="' + inv.code + '" data-available="' + inv.openLots + '" style="cursor:pointer;"></td><td style="padding:8px;font-size:12px;font-weight:500;">' + inv.code + '</td><td style="padding:8px;font-size:12px;">' + inv.openLots + ' lots</td><td style="padding:8px;"><input type="number" class="inv-qty" data-code="' + inv.code + '" min="0" max="' + inv.openLots + '" step="1" placeholder="0" style="width:60px;padding:5px;border:1px solid #e8e8e8;border-radius:4px;font-size:12px;" disabled></td></tr>';
            });
            el('inventoryTableBody').innerHTML = html;
            el('inventoryTable').style.display = 'block';

            document.querySelectorAll('.inv-checkbox').forEach(cb => {
                cb.addEventListener('change', function () {
                    const selector = '.inv-qty[data-code="' + this.dataset.code + '"]';
                    const qty = qs(selector);
                    if (this.checked) { qty.disabled = false; qty.focus(); }
                    else { qty.disabled = true; qty.value = ''; }
                    updateInventoryValidation();
                });
            });

            document.querySelectorAll('.inv-qty').forEach(inp => {
                inp.addEventListener('input', updateInventoryValidation);
            });

            if (reqLots > total) {
                validationMsg.innerHTML = '<div class="warning-text">❌ Cannot ' + reason + ' ' + reqLots + ' lots. Only ' + total + ' open lots available.</div>';
                submitBtn.disabled = true;
            } else {
                validationMsg.innerHTML = '<div class="success-text">✅ ' + inventories.length + ' open position(s) | Total available: ' + total + ' lots</div>';
                if (reason === 'Buy') {
                    const p = parseFloat(avgPriceInput.value);
                    submitBtn.disabled = avgPriceInput.value === '' || isNaN(p) || p <= 0;
                } else if (reason === 'Rollover') {
                    submitBtn.disabled = true;
                } else {
                    submitBtn.disabled = false;
                }
            }
        }
    } catch (err) {
        el('inventoryTableBody').innerHTML = '<tr><td colspan="4" style="padding:10px;text-align:center;color:#e74c3c;">Error loading positions</td></tr>';
        validationMsg.innerHTML = '<div class="warning-text">❌ Error: ' + err.message + '</div>';
        submitBtn.disabled = true;
    }
}

function updateInventoryValidation() {
    const checked = Array.from(document.querySelectorAll('.inv-checkbox:checked'));
    let selected = 0;
    checked.forEach(cb => {
        const selector = '.inv-qty[data-code="' + cb.dataset.code + '"]';
        const inp = qs(selector);
        selected += parseFloat(inp.value) || 0;
    });

    const reqLots = parseFloat(lotsInput.value) || 0;
    const reason = reasonSelect.value;

    if (selected !== reqLots && selected > 0) {
        validationMsg.innerHTML = '<div class="warning-text">⚠️ Selected quantity (' + selected + ') does not match total lots (' + reqLots + ')</div>';
        submitBtn.disabled = true;
    } else if (selected === reqLots && selected > 0) {
        if (reason === 'Buy') {
            const p = parseFloat(avgPriceInput.value);
            if (avgPriceInput.value === '' || isNaN(p) || p <= 0) {
                validationMsg.innerHTML = '<div class="warning-text">⚠️ Please enter Average Price to proceed</div>';
                submitBtn.disabled = true;
                return;
            }
        }
        if (reason === 'Rollover') {
            const g = parseFloat(rolloverGainsInput.value);
            if (rolloverGainsInput.value === '' || isNaN(g)) {
                validationMsg.innerHTML = '<div class="warning-text">⚠️ Please enter Rollover Gains/Loss to proceed</div>';
                submitBtn.disabled = true;
                return;
            }
        }
        validationMsg.innerHTML = '<div class="success-text">✅ Allocation complete: ' + selected + ' lots from ' + checked.length + ' position(s)</div>';
        submitBtn.disabled = false;
        if (reason === 'Rollover' && checked.length > 0) { updateRolloverPriceInfo(); }
    } else if (selected === 0 && reqLots > 0) {
        validationMsg.innerHTML = '<div class="warning-text">⚠️ Please allocate ' + reqLots + ' lots across selected inventories</div>';
        submitBtn.disabled = true;
    } else {
        submitBtn.disabled = false;
    }
}

async function updateRolloverPriceInfo() {
    const codes = Array.from(document.querySelectorAll('.inv-checkbox:checked')).map(cb => cb.dataset.code);

    try {
        const data = await apiCall('getInventoryPrices', { codes });
        let text = 'Inventory Prices: ';
        const map = {};
        data.forEach(inv => {
            map[inv.code] = inv.avgPrice;
            text += inv.code + ': ₹' + inv.avgPrice + ' | ';
        });
        window.inventoryPriceMap = map;
        const gains = parseFloat(rolloverGainsInput.value) || 0;
        if (gains !== 0) {
            text += '<br/>With Rollover Gains: +₹' + Math.abs(gains).toFixed(2);
        }
        rolloverInfoDiv.innerHTML = text;
    } catch (err) {
        rolloverInfoDiv.innerHTML = '⚠️ Could not load inventory prices';
    }
}

const updateSellValidation = () => {
    const sup = supplierInput.value.trim();
    const price = parseFloat(avgPriceInput.value);
    if (sup && !isNaN(price) && price > 0) {
        validationMsg.innerHTML = '<div class="success-text">✅ Ready to submit Sell transaction</div>';
        submitBtn.disabled = false;
    } else {
        submitBtn.disabled = true;
        validationMsg.innerHTML = !sup ? '<div class="warning-text">⚠️ Please fill Supplier Name</div>' : '<div class="warning-text">⚠️ Please fill Average Price</div>';
    }
};

// ============================================
// EVENT LISTENERS
// ============================================

rolloverGainsInput.addEventListener('input', () => {
    if (reasonSelect.value === 'Rollover') { updateRolloverPriceInfo(); }
});

avgPriceInput.addEventListener('input', () => {
    if (reasonSelect.value === 'Buy') { updateInventoryValidation(); }
    else if (reasonSelect.value === 'Sell') { updateSellValidation(); }
});

supplierInput.addEventListener('input', () => {
    if (reasonSelect.value === 'Sell') { updateSellValidation(); }
});

commodityInput.addEventListener('blur', validateAndLoadInventories);

contractSelect.addEventListener('change', () => {
    validateAndLoadInventories();
    if (reasonSelect.value === 'Rollover') { updateNextContractOptions(); }
});

nextContractSelect.addEventListener('change', () => {
    if (reasonSelect.value === 'Rollover') { updateInventoryValidation(); }
});

lotsInput.addEventListener('input', validateAndLoadInventories);
reasonSelect.addEventListener('change', updateReasonFields);

window.onclick = function (e) {
    if (e.target === el('calcModal')) { closeCalculator(); }
};

// ============================================
// FORM SUBMISSION (Using Fetch)
// ============================================

el('hedgeForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    validationMsg.innerHTML = '';

    const formData = new FormData(this);
    const obj = {};
    formData.forEach((val, key) => obj[key] = val);

    // Validation
    const missing = [];
    if (!obj.date) missing.push('Date');
    if (!obj.commodity) missing.push('Commodity');
    if (!obj.productType) missing.push('Product Type');
    if (!obj.contract) missing.push('Contract Month');
    if (!obj.lots) missing.push('Lots');
    if (!obj.reason) missing.push('Transaction Type');
    if (!obj.trader) missing.push('Trader');

    if (missing.length > 0) {
        let msg = 'Please fill the following required field(s):<br><br>' + missing.map(f => '• ' + f).join('<br>');
        showPopup(msg, 'warning');
        return;
    }

    const checked = Array.from(document.querySelectorAll('.inv-checkbox:checked'));

    if ((obj.reason === 'Buy' || obj.reason === 'Rollover') && checked.length === 0) {
        validationMsg.innerHTML = '❌ Please select at least one inventory code';
        validationMsg.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
    }

    if (checked.length > 0) {
        obj.selectedInventories = checked.map(cb => {
            let price = parseFloat(obj.avgPrice) || 0;
            if (obj.reason === 'Rollover' && window.inventoryPriceMap) {
                const old = window.inventoryPriceMap[cb.dataset.code] || 0;
                const gains = parseFloat(obj.rolloverGains) || 0;
                price = old + gains;
            }
            const selector = '.inv-qty[data-code="' + cb.dataset.code + '"]';
            return {
                code: cb.dataset.code,
                quantity: parseFloat(qs(selector).value) || 0,
                avgPrice: price
            };
        });

        const total = obj.selectedInventories.reduce((s, inv) => s + inv.quantity, 0);
        if (total !== parseFloat(obj.lots)) {
            validationMsg.innerHTML = '❌ Total allocated quantity (' + total + ') must equal total lots (' + obj.lots + ')';
            validationMsg.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }
    }

    if (obj.reason === 'Buy') {
        const p = parseFloat(obj.avgPrice);
        if (!obj.avgPrice || isNaN(p) || p <= 0) {
            validationMsg.innerHTML = '❌ Please enter a valid Average Price for Buy transaction';
            validationMsg.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }
    }

    if (obj.reason === 'Rollover') {
        if (!obj.nextContract) {
            validationMsg.innerHTML = '❌ Please select Next Contract Month for Rollover transaction';
            validationMsg.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }
        const g = parseFloat(obj.rolloverGains);
        if (!obj.rolloverGains || isNaN(g)) {
            validationMsg.innerHTML = '❌ Please enter Rollover Gains/Loss value';
            validationMsg.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }
        obj.contractToSave = obj.nextContract;
    }

    if (obj.reason === 'Sell') {
        if (!obj.supplierName) {
            validationMsg.innerHTML = '❌ Please enter Supplier Name for Sell transaction';
            validationMsg.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }
        const p = parseFloat(obj.avgPrice);
        if (!obj.avgPrice || isNaN(p) || p <= 0) {
            validationMsg.innerHTML = '❌ Please enter a valid Average Price for Sell transaction';
            validationMsg.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }
    }

    // Submit
    submitBtn.disabled = true;
    submitBtn.classList.add('loading');
    btnText.textContent = 'Submitting...';

    try {
        await apiCall('submitHedgeForm', obj);
        showPopup('✅ Entry saved successfully!', 'success');
        this.reset();
        updateReasonFields();
        window.inventoryPriceMap = null;
    } catch (err) {
        showPopup('❌ Error: ' + err.message, 'warning');
    } finally {
        submitBtn.disabled = false;
        submitBtn.classList.remove('loading');
        btnText.textContent = 'Submit Entry';
    }
});

// ============================================
// DASHBOARD (Using Fetch)
// ============================================

function renderDashboard(data) {
    if (!data || data.length < 2) return '<p>No data available</p>';

    const rows = data.slice(1); // Skip header
    const summary = {};
    const inventory = {};
    const inventorySuppliers = {};
    const buyTransactions = [];

    // 1. Process Data
    rows.forEach(row => {
        const comm = row[1];
        const product = row[2];
        const contract = row[7];
        const reason = row[4];
        const lots = parseFloat(row[3]) || 0;
        const invCode = row[8];
        const supplierBuyer = row[6];
        const avgPrice = parseFloat(row[9]) || 0;
        const date = row[0];

        if (!comm) return;

        // Summary Aggregation
        const summaryKey = `${comm}-${product}-${contract}`;
        if (!summary[summaryKey]) {
            summary[summaryKey] = { commodity: comm, product, contract, sold: 0, bought: 0 };
        }
        if (reason === 'Sell') summary[summaryKey].sold += lots;
        else if (reason === 'Buy' || reason === 'Rollover') summary[summaryKey].bought += lots;

        // Inventory Aggregation
        if (invCode) {
            if (!inventory[invCode]) {
                inventory[invCode] = {
                    code: invCode, commodity: comm, product, contract,
                    supplier: '', sold: 0, bought: 0, avgPrice: 0
                };
            }

            if (reason === 'Sell') {
                inventory[invCode].sold += lots;
                if (supplierBuyer) {
                    inventory[invCode].supplier = supplierBuyer;
                    inventorySuppliers[invCode] = supplierBuyer;
                }
                inventory[invCode].avgPrice = avgPrice;
            } else if (reason === 'Buy' || reason === 'Rollover') {
                inventory[invCode].bought += lots;
                buyTransactions.push({
                    code: invCode,
                    lots: lots,
                    buyer: supplierBuyer,
                    date: date,
                    avgPrice: avgPrice,
                    supplier: ''
                });
            }
        }
    });

    // 2. Generate HTML
    let html = '';

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 1: Summary By Commodity & Contract (GREEN HEADER)
    // ═══════════════════════════════════════════════════════════════════════
    html += '<div style="margin-bottom:30px; overflow-x:auto;">';
    html += '<table style="width:100%; border-collapse:collapse; font-family:sans-serif; font-size:12px;">';
    html += '<thead><tr style="background:#27ae60; color:white; text-align:center;">';
    html += '<th style="padding:10px; border:1px solid #1e8449;">Commodity</th>';
    html += '<th style="padding:10px; border:1px solid #1e8449;">Product Type</th>';
    html += '<th style="padding:10px; border:1px solid #1e8449;">Contract</th>';
    html += '<th style="padding:10px; border:1px solid #1e8449;">Sold Lots</th>';
    html += '<th style="padding:10px; border:1px solid #1e8449;">Bought Lots</th>';
    html += '<th style="padding:10px; border:1px solid #1e8449;">Open Lots</th>';
    html += '<th style="padding:10px; border:1px solid #1e8449;">Net Exposure</th>';
    html += '<th style="padding:10px; border:1px solid #1e8449;">Summary Status</th>';
    html += '</tr></thead><tbody>';

    Object.values(summary).forEach(s => {
        const open = s.sold - s.bought;
        const net = open;
        let statusIcon = open === 0 ? '✅' : (open > 0 ? '⚠️' : '❌');
        let statusText = open === 0 ? 'Perfect Hedge (Closed)' : (open > 0 ? `Open Short (${open} lots)` : `Over-hedged (${Math.abs(open)} lots)`);

        html += `<tr style="text-align:center; background:#f9f9f9;">
            <td style="padding:8px; border:1px solid #ddd;">${s.commodity}</td>
            <td style="padding:8px; border:1px solid #ddd;">${s.product}</td>
            <td style="padding:8px; border:1px solid #ddd;">${s.contract}</td>
            <td style="padding:8px; border:1px solid #ddd;">${s.sold}</td>
            <td style="padding:8px; border:1px solid #ddd;">${s.bought}</td>
            <td style="padding:8px; border:1px solid #ddd;">${open}</td>
            <td style="padding:8px; border:1px solid #ddd;">${net}</td>
            <td style="padding:8px; border:1px solid #ddd; text-align:left;">${statusIcon} ${statusText}</td>
        </tr>`;
    });
    html += '</tbody></table></div>';

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 2: Detailed Inventory (PURPLE HEADER)
    // ═══════════════════════════════════════════════════════════════════════
    html += '<div style="margin-bottom:30px; overflow-x:auto;">';
    html += '<table style="width:100%; border-collapse:collapse; font-family:sans-serif; font-size:12px;">';
    html += '<thead><tr style="background:#764ba2; color:white; text-align:center;">';
    html += '<th style="padding:10px; border:1px solid #5b3a7d;">Commodity</th>';
    html += '<th style="padding:10px; border:1px solid #5b3a7d;">Product Type</th>';
    html += '<th style="padding:10px; border:1px solid #5b3a7d;">Contract</th>';
    html += '<th style="padding:10px; border:1px solid #5b3a7d;">Inventory Code</th>';
    html += '<th style="padding:10px; border:1px solid #5b3a7d;">Supplier/Buyer</th>';
    html += '<th style="padding:10px; border:1px solid #5b3a7d;">Sold Lots</th>';
    html += '<th style="padding:10px; border:1px solid #5b3a7d;">Bought Lots</th>';
    html += '<th style="padding:10px; border:1px solid #5b3a7d;">Open Lots</th>';
    html += '<th style="padding:10px; border:1px solid #5b3a7d;">Avg Price</th>';
    html += '<th style="padding:10px; border:1px solid #5b3a7d;">Status</th>';
    html += '</tr></thead><tbody>';

    Object.values(inventory).forEach(inv => {
        const open = inv.sold - inv.bought;
        let statusColor = open === 0 ? '#d5f4e6' : (open > 0 ? '#fff9e6' : '#fadbd8');
        let statusTextColor = open === 0 ? '#27ae60' : (open > 0 ? '#e67e22' : '#c0392b');
        let statusMsg = open === 0 ? '✅ Closed' : (open > 0 ? `⚠️ Open (${open} lots)` : `❌ Over (${Math.abs(open)} lots)`);

        html += `<tr style="text-align:center; background:#f9f9f9;">
            <td style="padding:8px; border:1px solid #ddd;">${inv.commodity}</td>
            <td style="padding:8px; border:1px solid #ddd;">${inv.product}</td>
            <td style="padding:8px; border:1px solid #ddd;">${inv.contract}</td>
            <td style="padding:8px; border:1px solid #ddd;">${inv.code}</td>
            <td style="padding:8px; border:1px solid #ddd;">${inv.supplier}</td>
            <td style="padding:8px; border:1px solid #ddd;">${inv.sold}</td>
            <td style="padding:8px; border:1px solid #ddd;">${inv.bought}</td>
            <td style="padding:8px; border:1px solid #ddd;">${open}</td>
            <td style="padding:8px; border:1px solid #ddd;">${inv.avgPrice.toFixed(2)}</td>
            <td style="padding:8px; border:1px solid #ddd; background:${statusColor}; color:${statusTextColor}; font-weight:bold;">${statusMsg}</td>
        </tr>`;
    });
    html += '</tbody></table></div>';

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 3: Buy Transactions (Grouped by Inventory Code) (BLUE HEADER)
    // ═══════════════════════════════════════════════════════════════════════
    const groupedBuys = {};
    buyTransactions.forEach(bt => {
        if (!groupedBuys[bt.code]) groupedBuys[bt.code] = [];
        bt.supplier = inventorySuppliers[bt.code] || 'N/A';
        groupedBuys[bt.code].push(bt);
    });

    if (Object.keys(groupedBuys).length > 0) {
        Object.keys(groupedBuys).forEach(code => {
            const txs = groupedBuys[code];
            const invData = inventory[code] || { sold: 0, avgPrice: 0 };
            const totalBought = txs.reduce((sum, tx) => sum + tx.lots, 0);
            const avgBuyPrice = txs.length > 0 ? (txs.reduce((sum, tx) => sum + (tx.lots * tx.avgPrice), 0) / totalBought) : 0;

            html += '<div style="margin-bottom:20px; overflow-x:auto;">';
            html += '<table style="width:100%; border-collapse:collapse; font-family:sans-serif; font-size:12px;">';

            // Header row with aggregated info
            html += `<tr style="background:#3498db; color:white; text-align:left;">
                <th style="padding:8px; border:1px solid #2980b9;">Inventory Code</th>
                <th style="padding:8px; border:1px solid #2980b9;">Lots {${totalBought}}</th>
                <th style="padding:8px; border:1px solid #2980b9;">Buyer</th>
                <th style="padding:8px; border:1px solid #2980b9;">Supplier</th>
                <th style="padding:8px; border:1px solid #2980b9;">Avg Price {${avgBuyPrice.toFixed(2)}}</th>
                <th style="padding:8px; border:1px solid #2980b9;">Bought Date</th>
            </tr>`;

            // Transaction rows
            txs.forEach(tx => {
                html += `<tr style="background:#d6eaf8; border:1px solid #ddd;">
                    <td style="padding:8px; border:1px solid #bdc3c7;">${tx.code}</td>
                    <td style="padding:8px; border:1px solid #bdc3c7; text-align:center;">${tx.lots}</td>
                    <td style="padding:8px; border:1px solid #bdc3c7;">${tx.buyer}</td>
                    <td style="padding:8px; border:1px solid #bdc3c7;">${tx.supplier}</td>
                    <td style="padding:8px; border:1px solid #bdc3c7; text-align:center;">${tx.avgPrice.toFixed(2)}</td>
                    <td style="padding:8px; border:1px solid #bdc3c7; text-align:center;">${tx.date}</td>
                </tr>`;
            });

            html += '</table></div>';
        });
    }

    return html;
}

async function openDashboard() {
    document.getElementById('dashboardContent').innerHTML = '<div style="padding:20px; text-align:center;">Loading...</div>';
    document.getElementById('dashboardModal').style.display = 'block';

    try {
        const data = await apiCall('getEntries');
        const html = renderDashboard(data);
        document.getElementById('dashboardContent').innerHTML = html;
    } catch (err) {
        document.getElementById('dashboardContent').innerHTML = '<div style="color:red; padding:20px;">Error: ' + err.message + '</div>';
    }
}

// ============================================
// EXPOSE GLOBALS
// ============================================

window.openCalculator = openCalculator;
window.closeCalculator = closeCalculator;
window.addCalcRow = addCalcRow;
window.removeRow = removeRow;
window.calculateAverage = calculateAverage;
window.usePriceAndClose = usePriceAndClose;
window.hidePopup = hidePopup;
window.openDashboard = openDashboard;
window.renderDashboard = renderDashboard;
