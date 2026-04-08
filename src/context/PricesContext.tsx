/* eslint-disable react-refresh/only-export-components -- kontext + hook v jednom modulu */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { fetchCurrentPrices, getFinnhubToken } from "@/lib/finnhub";
import { fetchBestYahooPriceForTicker } from "@/lib/yahooQuote";
import { marketRevenueInAccountCurrency } from "@/lib/marketRevenue";
import type { Lot } from "@/types";

export type PricesContextValue = {
  usdCzk: string;
  setUsdCzk: (v: string) => void;
  eurCzk: string;
  setEurCzk: (v: string) => void;
  apiPrices: Record<string, number>;
  loading: boolean;
  manualPrice: Record<string, string>;
  setManualPrice: (ticker: string, value: string) => void;
  refresh: () => Promise<void>;
  getPrice: (ticker: string) => number | undefined;
  getRevenue: (lot: Lot, shares: number) => number;
  failedTickers: Set<string>;
};

const PricesContext = createContext<PricesContextValue | null>(null);

export function PricesProvider({
  lots,
  children,
}: {
  lots: Lot[];
  children: React.ReactNode;
}) {
  const tickersKey = useMemo(
    () =>
      [...new Set(lots.map((l) => l.ticker).filter(Boolean))].sort().join(","),
    [lots],
  );

  const [apiPrices, setApiPrices] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [failedTickers, setFailedTickers] = useState<Set<string>>(new Set());
  const [manualPrice, setManualPriceState] = useState<Record<string, string>>(
    {},
  );
  const [usdCzk, setUsdCzk] = useState("23.50");
  const [eurCzk, setEurCzk] = useState("25.00");

  const setManualPrice = useCallback((ticker: string, value: string) => {
    setManualPriceState((prev) => ({ ...prev, [ticker]: value }));
  }, []);

  const runFetch = useCallback(async () => {
    const list = tickersKey ? tickersKey.split(",") : [];
    setFailedTickers(new Set());
    if (list.length === 0) return;

    setLoading(true);
    try {
      let next: Record<string, number> = {};

      const token = getFinnhubToken();
      if (token.trim()) {
        next = await fetchCurrentPrices(list, token);
      }

      // Yahoo jen jako fallback, když Finnhub nic nevrátí (nebo není token)
      const needYahoo = list.filter((t) => !next[t] || next[t] <= 0);

      await Promise.all(
        needYahoo.map(async (t) => {
          const py = await fetchBestYahooPriceForTicker(t);
          if (py !== undefined && py > 0) {
            next[t] = py;
          }
        }),
      );

      setApiPrices((prev) => ({ ...prev, ...next }));

      const failed = new Set<string>();
      for (const t of list) {
        const p = next[t];
        if (!p || p <= 0) failed.add(t);
      }
      setFailedTickers(failed);
    } catch {
      setFailedTickers(new Set(list));
    } finally {
      setLoading(false);
    }
  }, [tickersKey]);

  useEffect(() => {
    void runFetch();
  }, [runFetch]);

  const usdNum = Number.parseFloat(usdCzk.replace(",", ".")) || 0;
  const eurNum = Number.parseFloat(eurCzk.replace(",", ".")) || 0;

  const getPrice = useCallback(
    (ticker: string): number | undefined => {
      const manualRaw =
        manualPrice[ticker] ?? manualPrice[ticker.toUpperCase()] ?? "";
      const manual = Number.parseFloat(
        manualRaw.replace(/\s/g, "").replace(",", "."),
      );
      if (Number.isFinite(manual) && manual > 0) return manual;
      const p = apiPrices[ticker] ?? apiPrices[ticker.toUpperCase()];
      if (Number.isFinite(p) && p > 0) return p;
      return undefined;
    },
    [apiPrices, manualPrice],
  );

  const getRevenue = useCallback(
    (lot: Lot, shares: number) => {
      const p = getPrice(lot.ticker) ?? lot.pricePerShareEUR;
      return marketRevenueInAccountCurrency(lot, shares, p, usdNum, eurNum);
    },
    [getPrice, usdNum, eurNum],
  );

  const value = useMemo(
    (): PricesContextValue => ({
      usdCzk,
      setUsdCzk,
      eurCzk,
      setEurCzk,
      apiPrices,
      loading,
      manualPrice,
      setManualPrice,
      refresh: runFetch,
      getPrice,
      getRevenue,
      failedTickers,
    }),
    [
      usdCzk,
      eurCzk,
      apiPrices,
      loading,
      manualPrice,
      setManualPrice,
      runFetch,
      getPrice,
      getRevenue,
      failedTickers,
    ],
  );

  return (
    <PricesContext.Provider value={value}>{children}</PricesContext.Provider>
  );
}

export function usePrices(): PricesContextValue {
  const ctx = useContext(PricesContext);
  if (!ctx) {
    throw new Error("usePrices musí být uvnitř PricesProvider");
  }
  return ctx;
}
