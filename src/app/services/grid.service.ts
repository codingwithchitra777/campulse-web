import { Injectable, signal } from '@angular/core';
import { CurrencyCode, GridFill, GridPlan, GridRung, GridSpacing, MarketKind, TradeSide } from '../models';

/**
 * Owns the client-side grid-trading plan. Campulse is a recording tool, not an
 * execution venue, so a grid here is just a saved ladder of resting orders the
 * user placed at their broker. The plan (rungs + fill log + running P/L) is
 * persisted in localStorage per user; each recorded fill is a real Trade
 * submitted through ApiService.confirmTrade by the component.
 *
 * The active plan is exposed as a signal so the page reacts without reloads,
 * mirroring the rxResource-keyed-on-user pattern used elsewhere.
 */
@Injectable({ providedIn: 'root' })
export class GridService {
  /** The active grid plan for the current user (null = none registered). */
  readonly plan = signal<GridPlan | null>(null);

  private currentUserId = '';

  private storageKey(userId: string): string {
    return `campulse_grid_${userId}`;
  }

  /** Load (or clear) the active plan for a user — call on user switch. */
  loadFor(userId: string): void {
    this.currentUserId = userId;
    const raw = localStorage.getItem(this.storageKey(userId));
    if (!raw) {
      this.plan.set(null);
      return;
    }
    try {
      this.plan.set(JSON.parse(raw) as GridPlan);
    } catch {
      localStorage.removeItem(this.storageKey(userId));
      this.plan.set(null);
    }
  }

  private persist(): void {
    const p = this.plan();
    if (!this.currentUserId) return;
    if (p) {
      localStorage.setItem(this.storageKey(this.currentUserId), JSON.stringify(p));
    } else {
      localStorage.removeItem(this.storageKey(this.currentUserId));
    }
  }

  /** Compute the ladder prices for a range (arithmetic = even step, geometric = even %). */
  computeLevels(lower: number, upper: number, levels: number, spacing: GridSpacing): number[] {
    const out: number[] = [];
    if (upper <= lower || levels < 2) return out;
    for (let i = 0; i < levels; i++) {
      if (spacing === 'geo') {
        const r = Math.pow(upper / lower, 1 / (levels - 1));
        out.push(lower * Math.pow(r, i));
      } else {
        out.push(lower + (upper - lower) * (i / (levels - 1)));
      }
    }
    return out;
  }

  /** Round to the market's natural precision (KHR whole, USD/gold to cents). */
  roundPrice(price: number, currency: CurrencyCode): number {
    return currency === 'KHR' ? Math.round(price) : Math.round(price * 100) / 100;
  }

  /**
   * Build a fresh plan from the setup inputs. Rungs below the reference price
   * arm as buys, rungs above as sells; the rung nearest the price carries no
   * resting order (it's the pivot).
   */
  buildPlan(input: {
    ticker: string;
    market: MarketKind;
    currency: CurrencyCode;
    lower: number;
    upper: number;
    levels: number;
    qty: number;
    spacing: GridSpacing;
    referencePrice: number;
  }): GridPlan {
    const raw = this.computeLevels(input.lower, input.upper, input.levels, input.spacing);
    const prices = raw.map((p) => this.roundPrice(p, input.currency));
    const step = prices.length >= 2 ? this.roundPrice(prices[1] - prices[0], input.currency) : 0;
    const rungs: GridRung[] = [];
    let uid = 0;
    for (const price of prices) {
      if (Math.abs(price - input.referencePrice) < 1e-9) continue; // pivot: no order
      rungs.push({ id: uid++, price, side: price < input.referencePrice ? 'BUY' : 'SELL', fills: 0 });
    }
    return {
      ticker: input.ticker,
      market: input.market,
      currency: input.currency,
      lower: input.lower,
      upper: input.upper,
      levels: input.levels,
      qty: input.qty,
      spacing: input.spacing,
      step,
      rungs,
      log: [],
      realised: 0,
      cycles: 0,
      openLots: 0,
      createdAt: new Date().toISOString()
    };
  }

  /** Register a plan as the active grid and persist it. */
  register(plan: GridPlan): void {
    this.plan.set(plan);
    this.persist();
  }

  /** Preview of a buy rung's outstanding order value, etc. (pure helpers on the plan). */
  buyRungs(plan: GridPlan): GridRung[] {
    return plan.rungs.filter((r) => r.side === 'BUY');
  }
  sellRungs(plan: GridPlan): GridRung[] {
    return plan.rungs.filter((r) => r.side === 'SELL');
  }

  /**
   * Apply a recorded fill after the backend confirmed the trade. For a buy this
   * opens a lot and re-arms the rung as a take-profit sell one step up; for a
   * sell it books the backend-reported realised P/L and re-arms a buy one step
   * down. Returns nothing — mutates + persists the plan signal.
   */
  applyFill(rungId: number, realisedPnl: number): void {
    const plan = this.plan();
    if (!plan) return;
    const rung = plan.rungs.find((r) => r.id === rungId);
    if (!rung) return;

    const side: TradeSide = rung.side;
    const filledPrice = rung.price; // capture before re-arming to a new level
    rung.fills += 1;

    if (side === 'BUY') {
      plan.openLots += 1;
      rung.side = 'SELL';
      rung.price = this.roundPrice(Math.min(filledPrice + plan.step, plan.upper), plan.currency);
    } else {
      plan.realised += realisedPnl;
      plan.cycles += 1;
      plan.openLots = Math.max(0, plan.openLots - 1);
      rung.side = 'BUY';
      rung.price = this.roundPrice(Math.max(filledPrice - plan.step, plan.lower), plan.currency);
    }

    const fill: GridFill = {
      id: `${Date.now()}-${rungId}`,
      side,
      price: filledPrice,
      qty: plan.qty,
      pnl: side === 'SELL' ? realisedPnl : 0,
      running: plan.realised,
      at: new Date().toISOString()
    };
    plan.log = [fill, ...plan.log].slice(0, 100);

    // Trigger signal update with a fresh object reference.
    this.plan.set({ ...plan, rungs: [...plan.rungs], log: plan.log });
    this.persist();
  }

  /** Re-arm every rung back to the original plan (keeps the range/levels/qty). */
  reset(referencePrice: number): void {
    const p = this.plan();
    if (!p) return;
    const fresh = this.buildPlan({
      ticker: p.ticker,
      market: p.market,
      currency: p.currency,
      lower: p.lower,
      upper: p.upper,
      levels: p.levels,
      qty: p.qty,
      spacing: p.spacing,
      referencePrice
    });
    this.register(fresh);
  }

  /** Discard the active plan entirely. */
  clear(): void {
    this.plan.set(null);
    this.persist();
  }
}
