
function doGet(e) {
    return HtmlService.createHtmlOutputFromFile('index')
        .setTitle('Hedge / PnL Entry')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
    return HtmlService.createHtmlOutputFromFile(filename)
        .getContent();
}

// ---------------------------------------------------------
//  INVENTORY MANAGEMENT
// ---------------------------------------------------------

/**
 * Generates a unique Inventory Code based on transaction details.
 */
function generateInventoryCode(supplierName, date, commodity, productType, contract) {
    const dateObj = new Date(date);
    const dd = String(dateObj.getDate()).padStart(2, '0');
    const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const yy = String(dateObj.getFullYear()).slice(-2);
    const suppCode = (supplierName || 'UNK').substring(0, 3).toUpperCase();
    const commCode = (commodity || 'XX').substring(0, 2).toUpperCase();
    const prodCode = (productType || 'XX').substring(0, 2).toUpperCase();

    const sheet = SpreadsheetApp.getActive().getSheetByName('Entries');
    const data = sheet.getDataRange().getValues();
    let counter = 1;
    let invCode;

    do {
        invCode = suppCode + '-' + commCode + '-' + prodCode + '-' + contract + '-' + dd + mm + yy + '-' + String(counter).padStart(3, '0');
        counter++;
    } while (data.some(row => row[8] === invCode)); // Column I is index 8

    return invCode;
}

/**
 * Retrieves open 'Sell' positions (inventories) with available lots.
 */
function getOpenInventories(commodity, contract) {
    const sheet = SpreadsheetApp.getActive().getSheetByName('Entries');
    if (!sheet || sheet.getLastRow() < 2) return [];

    const data = sheet.getDataRange().getValues().slice(1); // Skip header
    const inventory = {};

    data.forEach(row => {
        const reason = row[4]; // Column E
        const rowComm = row[1]; // Column B
        const rowProduct = row[2]; // Column C
        const rowContract = row[7]; // Column H
        const lots = parseFloat(row[3]) || 0; // Column D
        const supplierBuyer = row[6]; // Column G
        const invCode = row[8]; // Column I
        const avgPrice = parseFloat(row[9]) || 0; // Column J

        // Filter by Commodity & Contract if provided
        if (commodity && rowComm !== commodity) return;
        if (contract && rowContract !== contract) return;

        if ((reason === 'Sell') && invCode) {
            if (!inventory[invCode]) {
                inventory[invCode] = {
                    code: invCode,
                    commodity: rowComm,
                    product: rowProduct,
                    contract: rowContract,
                    supplier: supplierBuyer,
                    soldLots: 0,
                    boughtLots: 0,
                    openLots: 0,
                    avgPrice: avgPrice
                };
            }
            inventory[invCode].soldLots += lots;
            inventory[invCode].avgPrice = avgPrice;

        } else if ((reason === 'Buy') && invCode) {
            if (!inventory[invCode]) {
                inventory[invCode] = {
                    code: invCode,
                    soldLots: 0,
                    boughtLots: 0,
                    openLots: 0
                };
            }
            inventory[invCode].boughtLots += lots;
        }
    });

    const openInv = [];
    Object.values(inventory).forEach(inv => {
        inv.openLots = (inv.soldLots || 0) - (inv.boughtLots || 0);
        if (inv.openLots > 0) {
            openInv.push({
                code: inv.code,
                commodity: inv.commodity,
                product: inv.product,
                contract: inv.contract,
                supplier: inv.supplier,
                openLots: inv.openLots,
                soldLots: inv.soldLots,
                boughtLots: inv.boughtLots,
                avgPrice: inv.avgPrice
            });
        }
    });

    return openInv;
}

/**
 * gets the average price for a list of inventory codes
 */
function getInventoryPrices(codes) {
    const sheet = SpreadsheetApp.getActive().getSheetByName('Entries');
    if (!sheet || sheet.getLastRow() < 2) return [];

    const data = sheet.getDataRange().getValues().slice(1);
    const result = [];
    const codeSet = new Set(codes);

    data.forEach(row => {
        const invCode = row[8];
        const avgPrice = parseFloat(row[9]) || 0;

        if (codeSet.has(invCode)) {
            const existing = result.find(r => r.code === invCode);
            if (!existing) {
                result.push({
                    code: invCode,
                    avgPrice: avgPrice
                });
            }
        }
    });

    return result;
}

/**
 * Returns all entries raw data for client-side dashboard rendering.
 */
function getEntries() {
    const sheet = SpreadsheetApp.getActive().getSheetByName('Entries');
    if (!sheet) return [];
    // Return all data including headers so frontend can process it exactly like local dev
    return sheet.getDataRange().getValues();
}

// ---------------------------------------------------------
//  FORM SUBMISSION
// ---------------------------------------------------------

function submitHedgeForm(form) {
    const sheetName = 'Entries';
    let sheet = SpreadsheetApp.getActive().getSheetByName(sheetName);

    if (!sheet) {
        sheet = SpreadsheetApp.getActive().insertSheet(sheetName);
        sheet.appendRow([
            'Date', 'Commodity', 'Product Type', 'Number of Lots', 'Reason', 'Trader Name',
            'Supplier/Buyer', 'Contract', 'Inventory Code', 'Avg Price'
        ]);
    }

    // 1. Validation
    if (form.reason === 'Buy' || form.reason === 'Rollover') {
        if (!form.selectedInventories || form.selectedInventories.length === 0) {
            throw new Error('❌ Please select at least one Inventory Code to close the position');
        }

        const totalQty = form.selectedInventories.reduce((sum, inv) => sum + inv.quantity, 0);
        if (totalQty !== parseFloat(form.lots)) {
            throw new Error('❌ Total allocated quantity (' + totalQty + ') must equal total lots (' + form.lots + ')');
        }

        const openPositions = getOpenInventories(form.commodity, form.contract);
        form.selectedInventories.forEach(selectedInv => {
            const position = openPositions.find(p => p.code === selectedInv.code);
            if (!position) {
                // It might be closed now but valid when selected, but strictly we should error
                throw new Error('❌ Inventory ' + selectedInv.code + ' not found or already closed');
            }
            if (selectedInv.quantity > position.openLots) {
                throw new Error('❌ Cannot allocate ' + selectedInv.quantity + ' lots from ' + selectedInv.code + '. Only ' + position.openLots + ' lots open.');
            }
        });
    }

    // 2. Process Transaction
    if (form.reason === 'Sell') {
        const inventoryCode = generateInventoryCode(
            form.supplierName || 'UNK',
            form.date,
            form.commodity,
            form.productType,
            form.contract
        );

        const newRow = [
            form.date || '',
            form.commodity || '',
            form.productType || '',
            parseFloat(form.lots) || 0,
            'Sell',
            form.trader || '',
            form.supplierName || '',
            form.contract || '',
            inventoryCode,
            parseFloat(form.avgPrice) || 0
        ];

        sheet.appendRow(newRow);

    } else if (form.reason === 'Buy' || form.reason === 'Rollover') {
        if (form.reason === 'Rollover') {
            form.selectedInventories.forEach(selectedInv => {
                // Find original supplier to carry forward
                const allOpen = getOpenInventories(form.commodity, form.contract); // We query again or cache? Query is safer.
                const originalInv = allOpen.find(i => i.code === selectedInv.code);
                const originalSupplier = originalInv ? originalInv.supplier : '';

                // 1. Buy (Close current)
                const buyRow = [
                    form.date || '',
                    form.commodity || '',
                    form.productType || '',
                    selectedInv.quantity || 0,
                    'Buy',
                    form.trader || '',
                    form.buyerName || '',
                    form.contract || '',
                    selectedInv.code,
                    parseFloat(selectedInv.avgPrice) || 0
                ];
                sheet.appendRow(buyRow);

                // 2. Sell (Open next)
                const sellRow = [
                    form.date || '',
                    form.commodity || '',
                    form.productType || '',
                    selectedInv.quantity || 0,
                    'Sell',
                    form.trader || '',
                    // FIX: Inherit supplier from original inventory
                    form.supplierName || originalSupplier || '',
                    form.contractToSave || form.contract,
                    selectedInv.code,
                    parseFloat(selectedInv.avgPrice) || 0
                ];
                sheet.appendRow(sellRow);
            });
        } else {
            // Normal Buy
            form.selectedInventories.forEach(selectedInv => {
                const newRow = [
                    form.date || '',
                    form.commodity || '',
                    form.productType || '',
                    selectedInv.quantity || 0,
                    'Buy',
                    form.trader || '',
                    form.buyerName || '',
                    form.contract || '',
                    selectedInv.code,
                    parseFloat(selectedInv.avgPrice) || 0
                ];
                sheet.appendRow(newRow);
            });
        }
    }
}
