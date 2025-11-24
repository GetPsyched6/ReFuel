/**
 * Band Extrapolation Utility - Clean Implementation
 * 
 * Algorithm:
 * 1. Find min/max price of real data
 * 2. Detect inflection point (if exists) to split regimes
 * 3. Extract step width from adjacent bands
 * 4. Backward: extrapolate 1 unit before min using pre-inflection step + slope
 * 5. Forward: extrapolate 1 unit after max using post-inflection step + slope
 * 6. Return ONLY extrapolated bands (not real data)
 */

import { findInflection } from './bandInflection';

export interface Band {
    at_least_usd: number;
    but_less_than_usd: number;
    surcharge_pct: number;
}

export interface ExtrapolatedBand extends Band {
    isExtrapolated: true;
}

// Skip UPS entirely
const SKIP_CARRIERS = new Set(["UPS"]);

const BACKWARD_EXTENSION = 1.0;  // 1 unit before min
const FORWARD_EXTENSION = 1.0;   // 1 unit after max

/**
 * Main extrapolation function
 * Returns array of ONLY extrapolated bands
 */
export function extrapolateBands(
    bands: Band[],
    carrier: string,
    market: string,
    fuelCategory: string
): ExtrapolatedBand[] {
    // Skip UPS
    if (SKIP_CARRIERS.has(carrier)) {
        return [];
    }
    
    if (bands.length < 3) {
        return [];
    }
    
    // Sort by price (don't modify original)
    const sorted = [...bands].sort((a, b) => a.at_least_usd - b.at_least_usd);
    
    // Find real data range
    const realMin = sorted[0].at_least_usd;
    const realMax = sorted[sorted.length - 1].but_less_than_usd;
    
    // Find inflection point
    const inflectionPrice = findInflection(sorted);
    
    // Split into regimes
    let preInflectionBands: Band[];
    let postInflectionBands: Band[];
    
    if (inflectionPrice !== null) {
        preInflectionBands = sorted.filter(b => b.at_least_usd < inflectionPrice);
        postInflectionBands = sorted.filter(b => b.at_least_usd >= inflectionPrice);
    } else {
        // No inflection - single regime
        preInflectionBands = sorted;
        postInflectionBands = sorted;
    }
    
    const result: ExtrapolatedBand[] = [];
    
    // Backward extrapolation (use pre-inflection regime)
    if (preInflectionBands.length >= 2) {
        const backwardTarget = Math.max(0, realMin - BACKWARD_EXTENSION);
        if (backwardTarget < realMin) {
            const backwardBands = generateBackward(preInflectionBands, backwardTarget, realMin);
            result.push(...backwardBands);
        }
    }
    
    // Forward extrapolation (use post-inflection regime)
    if (postInflectionBands.length >= 2) {
        const forwardTarget = realMax + FORWARD_EXTENSION;
        const forwardBands = generateForward(postInflectionBands, realMax, forwardTarget);
        result.push(...forwardBands);
    }
    
    if (result.length > 0) {
        console.log(`🔮 ${carrier}: ${result.length} extrapolated bands (min: ${realMin.toFixed(2)}, max: ${realMax.toFixed(2)}, inflection: ${inflectionPrice?.toFixed(2) ?? 'none'})`);
    }
    
    return result;
}

/**
 * Generate backward extrapolation using pre-inflection bands
 */
function generateBackward(referenceBands: Band[], startPrice: number, endPrice: number): ExtrapolatedBand[] {
    // Use first 3 bands to determine pattern
    const sampleBands = referenceBands.slice(0, Math.min(3, referenceBands.length));
    const stepWidth = getStepWidth(sampleBands);
    const slope = calculateSlope(sampleBands);
    
    const result: ExtrapolatedBand[] = [];
    const firstBand = referenceBands[0];
    const firstMid = (firstBand.at_least_usd + firstBand.but_less_than_usd) / 2;
    
    console.log(`  📐 Backward extrapolation params:`, {
        stepWidth: stepWidth.toFixed(4),
        slope: slope.toFixed(4),
        firstBand: `$${firstBand.at_least_usd.toFixed(2)}-${firstBand.but_less_than_usd.toFixed(2)} = ${firstBand.surcharge_pct}%`,
        firstMid: firstMid.toFixed(4),
        startPrice: startPrice.toFixed(2),
        endPrice: endPrice.toFixed(2)
    });
    
    // Generate bands from endPrice backwards to startPrice
    let currentLower = endPrice - stepWidth;
    
    while (currentLower >= startPrice) {
        const currentUpper = currentLower + stepWidth;
        const midPrice = (currentLower + currentUpper) / 2;
        const priceDiff = midPrice - firstMid;
        
        // Linear extrapolation: surcharge = firstSurcharge + slope * priceDiff
        const surcharge = Math.max(0, Math.min(100, firstBand.surcharge_pct + slope * priceDiff));
        
        if (result.length < 3) {
            console.log(`    Band ${result.length + 1}: $${currentLower.toFixed(2)}-${currentUpper.toFixed(2)}, mid=${midPrice.toFixed(4)}, priceDiff=${priceDiff.toFixed(4)}, surcharge=${surcharge.toFixed(2)}%`);
        }
        
        result.unshift({
            at_least_usd: Math.max(0, currentLower),
            but_less_than_usd: currentUpper,
            surcharge_pct: Number(surcharge.toFixed(2)),
            isExtrapolated: true
        });
        
        currentLower -= stepWidth;
    }
    
    console.log(`  ✅ Generated ${result.length} backward bands`);
    return result;
}

/**
 * Generate forward extrapolation using post-inflection bands
 */
function generateForward(referenceBands: Band[], startPrice: number, endPrice: number): ExtrapolatedBand[] {
    // Use last 3 bands to determine pattern
    const sampleBands = referenceBands.slice(Math.max(0, referenceBands.length - 3));
    const stepWidth = getStepWidth(sampleBands);
    const slope = calculateSlope(sampleBands);
    
    const result: ExtrapolatedBand[] = [];
    const lastBand = referenceBands[referenceBands.length - 1];
    const lastMid = (lastBand.at_least_usd + lastBand.but_less_than_usd) / 2;
    
    console.log(`  📐 Forward extrapolation params:`, {
        stepWidth: stepWidth.toFixed(4),
        slope: slope.toFixed(4),
        lastBand: `$${lastBand.at_least_usd.toFixed(2)}-${lastBand.but_less_than_usd.toFixed(2)} = ${lastBand.surcharge_pct}%`,
        lastMid: lastMid.toFixed(4),
        startPrice: startPrice.toFixed(2),
        endPrice: endPrice.toFixed(2)
    });
    
    // Generate bands from startPrice forward to endPrice
    let currentLower = startPrice;
    
    while (currentLower < endPrice) {
        const currentUpper = Math.min(currentLower + stepWidth, endPrice);
        const midPrice = (currentLower + currentUpper) / 2;
        const priceDiff = midPrice - lastMid;
        
        // Linear extrapolation: surcharge = lastSurcharge + slope * priceDiff
        const surcharge = Math.max(0, Math.min(100, lastBand.surcharge_pct + slope * priceDiff));
        
        if (result.length < 3) {
            console.log(`    Band ${result.length + 1}: $${currentLower.toFixed(2)}-${currentUpper.toFixed(2)}, mid=${midPrice.toFixed(4)}, priceDiff=${priceDiff.toFixed(4)}, surcharge=${surcharge.toFixed(2)}%`);
        }
        
        result.push({
            at_least_usd: currentLower,
            but_less_than_usd: currentUpper,
            surcharge_pct: Number(surcharge.toFixed(2)),
            isExtrapolated: true
        });
        
        currentLower += stepWidth;
    }
    
    console.log(`  ✅ Generated ${result.length} forward bands`);
    return result;
}

/**
 * Extract consistent step width from sample bands
 * Example: [1.10-1.13, 1.13-1.16] → 0.03
 */
function getStepWidth(bands: Band[]): number {
    if (bands.length === 0) return 0.10; // fallback
    
    const widths = bands.map(b => b.but_less_than_usd - b.at_least_usd);
    const avgWidth = widths.reduce((sum, w) => sum + w, 0) / widths.length;
    
    return Math.max(0.01, avgWidth);
}

/**
 * Calculate slope (surcharge change per price unit) for linear extrapolation
 * Uses simple linear regression on sample bands
 */
function calculateSlope(bands: Band[]): number {
    if (bands.length < 2) return 0;
    
    const slopes: number[] = [];
    
    for (let i = 1; i < bands.length; i++) {
        const prevMid = (bands[i - 1].at_least_usd + bands[i - 1].but_less_than_usd) / 2;
        const currMid = (bands[i].at_least_usd + bands[i].but_less_than_usd) / 2;
        const priceDelta = currMid - prevMid;
        const surchargeDelta = bands[i].surcharge_pct - bands[i - 1].surcharge_pct;
        
        if (priceDelta > 0) {
            slopes.push(surchargeDelta / priceDelta);
        }
    }
    
    // Average slope
    return slopes.length > 0 ? slopes.reduce((a, b) => a + b, 0) / slopes.length : 0;
}
