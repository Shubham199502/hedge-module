const el = id => document.getElementById(id), qs = s => document.querySelector(s);
const reasonSelect = el('reason'), commodityInput = el('commodity'), contractSelect = el('contract'), nextContractRow = el('nextContractRow'), nextContractSelect = el('nextContract'), lotsInput = el('lotsInput'), supplierRow = el('supplierRow'), inventoryRow = el('inventoryRow'), buyerRow = el('buyerRow'), supplierInput = el('supplierName'), validationMsg = el('validationMsg'), submitBtn = el('submitBtn'), btnText = el('btnText'), avgPriceInput = el('avgPrice'), rolloverGainsInput = el('rolloverGains'), rolloverInfoDiv = el('rolloverInfo');

function openCalculator() { el('calcModal').style.display = 'block'; calculateAverage() }
function closeCalculator() { el('calcModal').style.display = 'none' }
function addCalcRow() { const c = el('calcRows'), d = document.createElement('div'); d.className = 'calc-row'; d.innerHTML = '<input type="number" class="calc-lots" placeholder="Lots" min="0" step="1" oninput="calculateAverage()"><input type="number" class="calc-price" placeholder="Price ₹" min="0" step="0.01" oninput="calculateAverage()"><button type="button" onclick="removeRow(this)">×</button>'; c.appendChild(d) }
function removeRow(btn) { if (document.querySelectorAll('.calc-row').length > 1) { btn.parentElement.remove(); calculateAverage() } }
function calculateAverage() { let total = 0, sum = 0; document.querySelectorAll('.calc-row').forEach(row => { const lots = parseFloat(row.querySelector('.calc-lots').value) || 0, price = parseFloat(row.querySelector('.calc-price').value) || 0; total += lots; sum += lots * price }); const avg = total > 0 ? (sum / total).toFixed(2) : 0; el('totalLots').textContent = total; el('avgPriceCalc').textContent = avg; el('calcResult').style.display = total > 0 ? 'block' : 'none' }
function usePriceAndClose() { const price = el('avgPriceCalc').textContent; if (parseFloat(price) > 0) { avgPriceInput.value = price; closeCalculator() } else alert('Please enter valid lots and prices') }
function showPopup(message, type) { const popup = el('formPopup'), title = el('formPopupTitle'); el('formPopupBody').innerHTML = message; title.textContent = type === 'success' ? 'Success' : 'Attention'; popup.style.display = 'block'; if (type === 'success') setTimeout(hidePopup, 2000) }
function hidePopup() { el('formPopup').style.display = 'none' }
function updateNextContractOptions() {
    if (reasonSelect.value !== 'Rollover') return; const curr = contractSelect.value, months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']; nextContractSelect.innerHTML = '<option value="">Select next contract month...</option>'; if (!curr) { months.forEach(m => { const opt = document.createElement('option'); opt.value = m; opt.textContent = m; nextContractSelect.appendChild(opt) }); return }
    const idx = months.indexOf(curr); for (let i = 1; i < months.length; i++) { const nextIdx = (idx + i) % months.length, month = months[nextIdx], opt = document.createElement('option'); opt.value = month; opt.textContent = month; nextContractSelect.appendChild(opt) }
}
function updateReasonFields() {
    const val = reasonSelect.value; validationMsg.innerHTML = ''; avgPriceInput.value = ''; rolloverGainsInput.value = ''; const avgPriceRow = el('avgPriceRow'), rolloverGainsRow = el('rolloverGainsRow'); if (val === 'Sell') { supplierRow.style.display = 'block'; inventoryRow.style.display = 'none'; buyerRow.style.display = 'none'; nextContractRow.style.display = 'none'; avgPriceRow.style.display = 'block'; rolloverGainsRow.style.display = 'none'; supplierInput.required = true; avgPriceInput.required = true; nextContractSelect.required = false; submitBtn.disabled = true; validationMsg.innerHTML = '<div class="warning-text">⚠️ Please fill Supplier Name and Average Price</div>' } else if (val === 'Buy') { supplierRow.style.display = 'none'; inventoryRow.style.display = 'block'; buyerRow.style.display = 'block'; nextContractRow.style.display = 'none'; avgPriceRow.style.display = 'block'; rolloverGainsRow.style.display = 'none'; supplierInput.required = false; avgPriceInput.required = true; nextContractSelect.required = false; if (commodityInput.value && contractSelect.value) { validateAndLoadInventories() } else { validationMsg.innerHTML = '<div class="warning-text">⚠️ Please select Commodity & Contract first</div>'; submitBtn.disabled = true } } else if (val === 'Rollover') { supplierRow.style.display = 'none'; inventoryRow.style.display = 'block'; buyerRow.style.display = 'block'; nextContractRow.style.display = 'block'; avgPriceRow.style.display = 'none'; rolloverGainsRow.style.display = 'block'; supplierInput.required = false; avgPriceInput.required = false; nextContractSelect.required = true; el('rolloverGains').required = true; updateNextContractOptions(); if (commodityInput.value && contractSelect.value) { validateAndLoadInventories() } else { validationMsg.innerHTML = '<div class="warning-text">⚠️ Please select Commodity & Contract first</div>'; submitBtn.disabled = true } } else { supplierRow.style.display = 'none'; inventoryRow.style.display = 'none'; buyerRow.style.display = 'none'; nextContractRow.style.display = 'none'; avgPriceRow.style.display = 'block'; rolloverGainsRow.style.display = 'none'; supplierInput.required = false; avgPriceInput.required = true; nextContractSelect.required = false; submitBtn.disabled = false }
}
function validateAndLoadInventories() {
    const commodity = commodityInput.value, contract = contractSelect.value, reason = reasonSelect.value, reqLots = parseFloat(lotsInput.value) || 0;
    if (!commodity || !contract || reason !== 'Buy' && reason !== 'Rollover') return;
    el('inventoryTable').style.display = 'none';
    el('inventoryTableBody').innerHTML = '<tr><td colspan="4" style="padding:10px;text-align:center;">Loading...</td></tr>';
    submitBtn.disabled = true;
    validationMsg.innerHTML = '';
    google.script.run.withSuccessHandler(inventories => {
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
                    if (this.checked) { qty.disabled = false; qty.focus() } else { qty.disabled = true; qty.value = '' }
                    updateInventoryValidation();
                });
            });
            document.querySelectorAll('.inv-qty').forEach(inp => { inp.addEventListener('input', updateInventoryValidation) });
            if (reqLots > total) {
                validationMsg.innerHTML = '<div class="warning-text">❌ Cannot ' + reason + ' ' + reqLots + ' lots. Only ' + total + ' open lots available.</div>';
                submitBtn.disabled = true;
            } else {
                validationMsg.innerHTML = '<div class="success-text">✅ ' + inventories.length + ' open position(s) | Total available: ' + total + ' lots</div>';
                if (reason === 'Buy') { const p = parseFloat(avgPriceInput.value); submitBtn.disabled = avgPriceInput.value === '' || isNaN(p) || p <= 0 }
                else if (reason === 'Rollover') { submitBtn.disabled = true }
                else { submitBtn.disabled = false }
            }
        }
    }).withFailureHandler(err => {
        el('inventoryTableBody').innerHTML = '<tr><td colspan="4" style="padding:10px;text-align:center;color:#e74c3c;">Error loading positions</td></tr>';
        validationMsg.innerHTML = '<div class="warning-text">❌ Error loading open positions</div>';
        submitBtn.disabled = true;
    }).getOpenInventories(commodity, contract);
}
function updateInventoryValidation() {
    const checked = Array.from(document.querySelectorAll('.inv-checkbox:checked'));
    let selected = 0;
    checked.forEach(cb => {
        const selector = '.inv-qty[data-code="' + cb.dataset.code + '"]';
        const inp = qs(selector);
        selected += parseFloat(inp.value) || 0;
    });
    const reqLots = parseFloat(lotsInput.value) || 0, reason = reasonSelect.value;
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
        if (reason === 'Rollover' && checked.length > 0) { updateRolloverPriceInfo() }
    } else if (selected === 0 && reqLots > 0) {
        validationMsg.innerHTML = '<div class="warning-text">⚠️ Please allocate ' + reqLots + ' lots across selected inventories</div>';
        submitBtn.disabled = true;
    } else {
        submitBtn.disabled = false;
    }
}
function updateRolloverPriceInfo() {
    const codes = Array.from(document.querySelectorAll('.inv-checkbox:checked')).map(cb => cb.dataset.code);
    google.script.run.withSuccessHandler(data => {
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
    }).withFailureHandler(err => {
        rolloverInfoDiv.innerHTML = '⚠️ Could not load inventory prices';
    }).getInventoryPrices(codes);
}
const updateSellValidation = () => { const sup = supplierInput.value.trim(), price = parseFloat(avgPriceInput.value); if (sup && !isNaN(price) && price > 0) { validationMsg.innerHTML = '<div class="success-text">✅ Ready to submit Sell transaction</div>'; submitBtn.disabled = false } else { submitBtn.disabled = true; validationMsg.innerHTML = !sup ? '<div class="warning-text">⚠️ Please fill Supplier Name</div>' : '<div class="warning-text">⚠️ Please fill Average Price</div>' } };
rolloverGainsInput.addEventListener('input', () => { if (reasonSelect.value === 'Rollover') { updateRolloverPriceInfo() } });
avgPriceInput.addEventListener('input', () => { if (reasonSelect.value === 'Buy') { updateInventoryValidation() } else if (reasonSelect.value === 'Sell') { updateSellValidation() } });
supplierInput.addEventListener('input', () => { if (reasonSelect.value === 'Sell') { updateSellValidation() } });
commodityInput.addEventListener('blur', validateAndLoadInventories);
contractSelect.addEventListener('change', () => { validateAndLoadInventories(); if (reasonSelect.value === 'Rollover') { updateNextContractOptions() } });
nextContractSelect.addEventListener('change', () => { if (reasonSelect.value === 'Rollover') { updateInventoryValidation() } });
lotsInput.addEventListener('input', validateAndLoadInventories);
reasonSelect.addEventListener('change', updateReasonFields);
window.onclick = function (e) { if (e.target === el('calcModal')) { closeCalculator() } };
el('hedgeForm').addEventListener('submit', function (e) {
    e.preventDefault();
    validationMsg.innerHTML = '';
    const formData = new FormData(this), obj = {};
    formData.forEach((val, key) => obj[key] = val);
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
                const old = window.inventoryPriceMap[cb.dataset.code] || 0, gains = parseFloat(obj.rolloverGains) || 0;
                price = old + gains;
            }
            const selector = '.inv-qty[data-code="' + cb.dataset.code + '"]';
            return { code: cb.dataset.code, quantity: parseFloat(qs(selector).value) || 0, avgPrice: price };
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
    if (obj.reason === 'Rollover') { obj.contractToSave = obj.nextContract }
    submitBtn.disabled = true;
    submitBtn.classList.add('loading');
    btnText.textContent = 'Submitting...';
    google.script.run.withSuccessHandler(() => {
        showPopup('✅ Entry saved successfully!', 'success');
        this.reset();
        updateReasonFields();
        submitBtn.disabled = false;
        submitBtn.classList.remove('loading');
        btnText.textContent = 'Submit Entry';
        window.inventoryPriceMap = null;
    }).withFailureHandler(err => {
        showPopup('❌ Error: ' + err, 'warning');
        submitBtn.disabled = false;
        submitBtn.classList.remove('loading');
        btnText.textContent = 'Submit Entry';
    }).submitHedgeForm(obj);
});

// Expose globals for HTML Event Handlers
window.openCalculator = openCalculator;
window.closeCalculator = closeCalculator;
window.addCalcRow = addCalcRow;
window.removeRow = removeRow;
window.calculateAverage = calculateAverage;
window.usePriceAndClose = usePriceAndClose;
window.hidePopup = hidePopup;
