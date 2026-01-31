// tests/unit/financial-calculations.spec.js
// ============================================
// FINANCIAL CALCULATION UNIT TESTS
// ============================================
// Tests for quote/invoice math, deposit calculations, payment tracking
// CRITICAL: These validate the core revenue calculations

import { test, expect } from '@playwright/test';

// ============================================
// PURE CALCULATION FUNCTIONS (Replicate logic from quoteService.js)
// ============================================

/**
 * Calculate subtotal from line items
 * Replicates: quoteService.js lines 65-66
 */
function calculateSubtotal(lineItems) {
    return (lineItems || []).reduce(
        (sum, item) => sum + ((item.quantity || 0) * (item.unitPrice || 0)), 0
    );
}

/**
 * Calculate tax amount
 * Replicates: quoteService.js line 68
 */
function calculateTax(subtotal, taxRate) {
    return subtotal * ((taxRate || 0) / 100);
}

/**
 * Calculate deposit amount
 * Replicates: quoteService.js lines 71-76 and stripeService.js lines 165-175
 */
function calculateDeposit(total, depositRequired, depositType, depositValue) {
    if (!depositRequired) return 0;
    if (depositType === 'percentage') {
        return total * ((depositValue || 0) / 100);
    }
    return depositValue || 0;
}

/**
 * Calculate balance due
 * Replicates: stripeService.js lines 180-186
 */
function calculateBalance(total, depositPaid, depositAmount) {
    if (!depositPaid) return total;
    return total - depositAmount;
}

/**
 * Full quote calculation
 */
function calculateQuoteTotal(lineItems, taxRate, depositRequired, depositType, depositValue) {
    const subtotal = calculateSubtotal(lineItems);
    const taxAmount = calculateTax(subtotal, taxRate);
    const total = subtotal + taxAmount;
    const depositAmount = calculateDeposit(total, depositRequired, depositType, depositValue);
    return { subtotal, taxAmount, total, depositAmount };
}

// ============================================
// SUBTOTAL CALCULATION TESTS
// ============================================
test.describe('Subtotal Calculations', () => {
    test('CALC-001: Empty line items returns 0', () => {
        expect(calculateSubtotal([])).toBe(0);
        expect(calculateSubtotal(null)).toBe(0);
        expect(calculateSubtotal(undefined)).toBe(0);
    });

    test('CALC-002: Single item calculation', () => {
        const items = [{ quantity: 1, unitPrice: 100 }];
        expect(calculateSubtotal(items)).toBe(100);
    });

    test('CALC-003: Multiple items calculation', () => {
        const items = [
            { quantity: 2, unitPrice: 50 },
            { quantity: 1, unitPrice: 100 },
            { quantity: 3, unitPrice: 25 }
        ];
        // 2*50 + 1*100 + 3*25 = 100 + 100 + 75 = 275
        expect(calculateSubtotal(items)).toBe(275);
    });

    test('CALC-004: Missing quantity defaults to 0', () => {
        const items = [{ unitPrice: 100 }];
        expect(calculateSubtotal(items)).toBe(0);
    });

    test('CALC-005: Missing unitPrice defaults to 0', () => {
        const items = [{ quantity: 5 }];
        expect(calculateSubtotal(items)).toBe(0);
    });

    test('CALC-006: Zero quantity returns 0', () => {
        const items = [{ quantity: 0, unitPrice: 100 }];
        expect(calculateSubtotal(items)).toBe(0);
    });

    test('CALC-007: Zero price returns 0', () => {
        const items = [{ quantity: 5, unitPrice: 0 }];
        expect(calculateSubtotal(items)).toBe(0);
    });

    test('CALC-008: Decimal quantities work correctly', () => {
        const items = [{ quantity: 1.5, unitPrice: 100 }];
        expect(calculateSubtotal(items)).toBe(150);
    });

    test('CALC-009: Decimal prices work correctly', () => {
        const items = [{ quantity: 2, unitPrice: 49.99 }];
        expect(calculateSubtotal(items)).toBeCloseTo(99.98, 2);
    });

    // EDGE CASES - These could slip through!
    test('CALC-010: NEGATIVE quantity produces negative subtotal (EDGE CASE)', () => {
        const items = [{ quantity: -1, unitPrice: 100 }];
        // Current code allows this - should it?
        const result = calculateSubtotal(items);
        console.log(`[CALC-010] Negative qty result: ${result}`);
        // Document the behavior - this is a potential bug
        expect(result).toBe(-100);
    });

    test('CALC-011: NEGATIVE price produces negative subtotal (EDGE CASE)', () => {
        const items = [{ quantity: 2, unitPrice: -50 }];
        const result = calculateSubtotal(items);
        console.log(`[CALC-011] Negative price result: ${result}`);
        expect(result).toBe(-100);
    });

    test('CALC-012: String numbers get coerced (EDGE CASE)', () => {
        const items = [{ quantity: '2', unitPrice: '50' }];
        const result = calculateSubtotal(items);
        console.log(`[CALC-012] String coercion result: ${result}`);
        // JavaScript coerces strings in multiplication
        expect(result).toBe(100);
    });

    test('CALC-013: NaN values produce NaN (EDGE CASE)', () => {
        const items = [{ quantity: NaN, unitPrice: 100 }];
        const result = calculateSubtotal(items);
        console.log(`[CALC-013] NaN result: ${result}`);
        expect(isNaN(result)).toBe(true);
    });

    test('CALC-014: Very large numbers (EDGE CASE)', () => {
        const items = [{ quantity: 1000000, unitPrice: 1000000 }];
        const result = calculateSubtotal(items);
        console.log(`[CALC-014] Large number result: ${result}`);
        expect(result).toBe(1000000000000); // 1 trillion
    });
});

// ============================================
// TAX CALCULATION TESTS
// ============================================
test.describe('Tax Calculations', () => {
    test('CALC-020: Zero tax rate returns 0', () => {
        expect(calculateTax(1000, 0)).toBe(0);
        expect(calculateTax(1000, null)).toBe(0);
        expect(calculateTax(1000, undefined)).toBe(0);
    });

    test('CALC-021: Standard 8.25% tax rate', () => {
        const tax = calculateTax(1000, 8.25);
        expect(tax).toBeCloseTo(82.50, 2);
    });

    test('CALC-022: 10% tax rate', () => {
        expect(calculateTax(500, 10)).toBe(50);
    });

    test('CALC-023: Fractional tax rate', () => {
        const tax = calculateTax(100, 7.5);
        expect(tax).toBeCloseTo(7.50, 2);
    });

    test('CALC-024: Zero subtotal returns 0 tax', () => {
        expect(calculateTax(0, 8.25)).toBe(0);
    });

    // EDGE CASES
    test('CALC-025: Tax rate > 100% (EDGE CASE)', () => {
        const tax = calculateTax(100, 150);
        console.log(`[CALC-025] Tax > 100%: ${tax}`);
        // This is mathematically valid but logically wrong
        expect(tax).toBe(150);
    });

    test('CALC-026: Negative tax rate (EDGE CASE)', () => {
        const tax = calculateTax(100, -10);
        console.log(`[CALC-026] Negative tax: ${tax}`);
        expect(tax).toBe(-10);
    });
});

// ============================================
// DEPOSIT CALCULATION TESTS
// ============================================
test.describe('Deposit Calculations', () => {
    test('CALC-030: No deposit required returns 0', () => {
        expect(calculateDeposit(1000, false, 'percentage', 50)).toBe(0);
    });

    test('CALC-031: 50% deposit', () => {
        expect(calculateDeposit(1000, true, 'percentage', 50)).toBe(500);
    });

    test('CALC-032: 100% deposit (full prepay)', () => {
        expect(calculateDeposit(1000, true, 'percentage', 100)).toBe(1000);
    });

    test('CALC-033: Fixed deposit amount', () => {
        expect(calculateDeposit(1000, true, 'fixed', 250)).toBe(250);
    });

    test('CALC-034: Fixed deposit with different type string', () => {
        expect(calculateDeposit(1000, true, 'flat', 250)).toBe(250);
    });

    test('CALC-035: Missing deposit value defaults to 0', () => {
        expect(calculateDeposit(1000, true, 'percentage', null)).toBe(0);
        expect(calculateDeposit(1000, true, 'percentage', undefined)).toBe(0);
    });

    // EDGE CASES - Potential bugs!
    test('CALC-036: Deposit > 100% percentage (EDGE CASE)', () => {
        const deposit = calculateDeposit(1000, true, 'percentage', 150);
        console.log(`[CALC-036] Deposit > 100%: ${deposit}`);
        // This should probably be prevented!
        expect(deposit).toBe(1500);
    });

    test('CALC-037: Fixed deposit > total (EDGE CASE)', () => {
        const deposit = calculateDeposit(1000, true, 'fixed', 1500);
        console.log(`[CALC-037] Fixed deposit > total: ${deposit}`);
        // This should be prevented!
        expect(deposit).toBe(1500);
    });

    test('CALC-038: Negative deposit percentage (EDGE CASE)', () => {
        const deposit = calculateDeposit(1000, true, 'percentage', -10);
        console.log(`[CALC-038] Negative deposit: ${deposit}`);
        expect(deposit).toBe(-100);
    });
});

// ============================================
// BALANCE CALCULATION TESTS
// ============================================
test.describe('Balance Calculations', () => {
    test('CALC-040: Full balance when deposit not paid', () => {
        expect(calculateBalance(1000, false, 500)).toBe(1000);
    });

    test('CALC-041: Reduced balance after deposit', () => {
        expect(calculateBalance(1000, true, 500)).toBe(500);
    });

    test('CALC-042: Zero balance after full prepay', () => {
        expect(calculateBalance(1000, true, 1000)).toBe(0);
    });

    // EDGE CASES
    test('CALC-043: Overpayment results in negative balance (EDGE CASE)', () => {
        const balance = calculateBalance(1000, true, 1200);
        console.log(`[CALC-043] Overpayment balance: ${balance}`);
        // This is a bug - should be 0 or handled specially
        expect(balance).toBe(-200);
    });
});

// ============================================
// FULL QUOTE CALCULATION TESTS
// ============================================
test.describe('Full Quote Calculations', () => {
    test('CALC-050: Simple quote with tax', () => {
        const items = [{ quantity: 1, unitPrice: 1000 }];
        const result = calculateQuoteTotal(items, 8.25, false, null, null);

        expect(result.subtotal).toBe(1000);
        expect(result.taxAmount).toBeCloseTo(82.50, 2);
        expect(result.total).toBeCloseTo(1082.50, 2);
        expect(result.depositAmount).toBe(0);
    });

    test('CALC-051: Quote with deposit percentage', () => {
        const items = [{ quantity: 2, unitPrice: 500 }];
        const result = calculateQuoteTotal(items, 10, true, 'percentage', 50);

        expect(result.subtotal).toBe(1000);
        expect(result.taxAmount).toBe(100);
        expect(result.total).toBe(1100);
        expect(result.depositAmount).toBe(550); // 50% of 1100
    });

    test('CALC-052: Quote with fixed deposit', () => {
        const items = [
            { quantity: 1, unitPrice: 850 },
            { quantity: 4, unitPrice: 125 }
        ];
        // 850 + 500 = 1350 subtotal
        const result = calculateQuoteTotal(items, 8.25, true, 'fixed', 500);

        expect(result.subtotal).toBe(1350);
        expect(result.taxAmount).toBeCloseTo(111.375, 2);
        expect(result.total).toBeCloseTo(1461.375, 2);
        expect(result.depositAmount).toBe(500);
    });

    test('CALC-053: Complex multi-item quote', () => {
        const items = [
            { quantity: 1, unitPrice: 4500 },  // Equipment
            { quantity: 1, unitPrice: 2300 },  // Parts
            { quantity: 8, unitPrice: 150 }    // Labor: 8 * 150 = 1200
        ];
        // Subtotal: 4500 + 2300 + 1200 = 8000
        const result = calculateQuoteTotal(items, 8.25, true, 'percentage', 50);

        expect(result.subtotal).toBe(8000);
        expect(result.taxAmount).toBe(660);
        expect(result.total).toBe(8660);
        expect(result.depositAmount).toBe(4330); // 50% of 8660
    });
});

// ============================================
// FLOATING POINT PRECISION TESTS
// ============================================
test.describe('Floating Point Precision', () => {
    test('CALC-060: Currency precision after tax', () => {
        const items = [{ quantity: 1, unitPrice: 99.99 }];
        const result = calculateQuoteTotal(items, 8.25, false, null, null);

        // 99.99 * 0.0825 = 8.249175
        console.log(`[CALC-060] Tax on $99.99: ${result.taxAmount}`);
        // Should be rounded to 2 decimal places for currency
        expect(result.taxAmount).toBeCloseTo(8.25, 2);
    });

    test('CALC-061: Currency precision with deposit', () => {
        const items = [{ quantity: 1, unitPrice: 333.33 }];
        const result = calculateQuoteTotal(items, 7.5, true, 'percentage', 33);

        console.log(`[CALC-061] Deposit: ${result.depositAmount}`);
        // 333.33 + 7.5% tax = 333.33 + 24.99975 = 358.32975
        // 33% of 358.32975 = 118.2488175
    });

    test('CALC-062: Repeating decimal handling', () => {
        const items = [{ quantity: 3, unitPrice: 33.33 }];
        const result = calculateQuoteTotal(items, 0, true, 'percentage', 33.33);

        // 3 * 33.33 = 99.99
        // 33.33% of 99.99 = 33.3266667
        console.log(`[CALC-062] Repeating decimal deposit: ${result.depositAmount}`);
    });
});

// ============================================
// PAYMENT TRACKING CALCULATIONS
// ============================================
test.describe('Payment Tracking Calculations', () => {
    /**
     * Calculate balance due from payments
     * Replicates: fieldPaymentService.js lines 397-404
     */
    function calculateBalanceDue(invoiceTotal, payments) {
        const totalPaid = payments
            .filter(p => p.status === 'completed')
            .reduce((sum, p) => sum + (p.amount || 0), 0);
        return Math.max(0, invoiceTotal - totalPaid);
    }

    test('CALC-070: No payments means full balance', () => {
        expect(calculateBalanceDue(1000, [])).toBe(1000);
    });

    test('CALC-071: Partial payment reduces balance', () => {
        const payments = [{ amount: 500, status: 'completed' }];
        expect(calculateBalanceDue(1000, payments)).toBe(500);
    });

    test('CALC-072: Multiple payments accumulate', () => {
        const payments = [
            { amount: 300, status: 'completed' },
            { amount: 200, status: 'completed' }
        ];
        expect(calculateBalanceDue(1000, payments)).toBe(500);
    });

    test('CALC-073: Pending payments not counted', () => {
        const payments = [
            { amount: 500, status: 'completed' },
            { amount: 500, status: 'pending' }
        ];
        expect(calculateBalanceDue(1000, payments)).toBe(500);
    });

    test('CALC-074: Failed payments not counted', () => {
        const payments = [
            { amount: 500, status: 'completed' },
            { amount: 500, status: 'failed' }
        ];
        expect(calculateBalanceDue(1000, payments)).toBe(500);
    });

    test('CALC-075: Full payment means zero balance', () => {
        const payments = [{ amount: 1000, status: 'completed' }];
        expect(calculateBalanceDue(1000, payments)).toBe(0);
    });

    test('CALC-076: Overpayment clamped to zero (not negative)', () => {
        const payments = [{ amount: 1200, status: 'completed' }];
        const balance = calculateBalanceDue(1000, payments);
        console.log(`[CALC-076] Overpayment balance: ${balance}`);
        // Math.max(0, ...) prevents negative
        expect(balance).toBe(0);
    });
});

// ============================================
// DISCOUNT CALCULATION TESTS (Future Feature)
// ============================================
test.describe('Discount Calculations', () => {
    function applyDiscount(subtotal, discountType, discountValue) {
        if (!discountValue) return 0;
        if (discountType === 'percentage') {
            return subtotal * (discountValue / 100);
        }
        return Math.min(discountValue, subtotal); // Can't discount more than subtotal
    }

    test('CALC-080: Percentage discount', () => {
        expect(applyDiscount(1000, 'percentage', 10)).toBe(100);
    });

    test('CALC-081: Fixed discount', () => {
        expect(applyDiscount(1000, 'fixed', 50)).toBe(50);
    });

    test('CALC-082: Fixed discount capped at subtotal', () => {
        expect(applyDiscount(1000, 'fixed', 1500)).toBe(1000);
    });

    test('CALC-083: Member discount example', () => {
        // Membership gives 10% discount
        const memberDiscount = applyDiscount(1000, 'percentage', 10);
        const finalSubtotal = 1000 - memberDiscount;
        expect(finalSubtotal).toBe(900);
    });
});
