import { afterEach, describe, expect, it, vi } from "vitest";

import { lookupBarcodeProduct } from "../src/lib/barcodeLookup";

function mockFetchOnce(body: unknown, ok = true) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok,
      json: () => Promise.resolve(body),
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("lookupBarcodeProduct", () => {
  it("returns null when the product isn't found", async () => {
    mockFetchOnce({ status: 0 });
    expect(await lookupBarcodeProduct("000")).toBeNull();
  });

  it("returns null on a network/HTTP failure without throwing", async () => {
    mockFetchOnce({}, false);
    expect(await lookupBarcodeProduct("000")).toBeNull();
  });

  it("scales per-100g values by the declared serving size when no per-serving figures exist", async () => {
    mockFetchOnce({
      status: 1,
      product: {
        product_name: "Test Bar",
        serving_quantity: 50,
        nutriments: {
          "energy-kcal_100g": 400,
          proteins_100g: 20,
          carbohydrates_100g: 40,
          fat_100g: 10,
        },
      },
    });
    const item = await lookupBarcodeProduct("123");
    expect(item).not.toBeNull();
    expect(item!.label).toBe("Test Bar");
    expect(item!.grams).toBe(50);
    expect(item!.calories).toBe(200);
    expect(item!.protein).toBe(10);
    expect(item!.carbs).toBe(20);
    expect(item!.fat).toBe(5);
  });

  it("prefers per-serving figures over scaled per-100g figures when both exist", async () => {
    mockFetchOnce({
      status: 1,
      product: {
        product_name: "Test Bar",
        serving_quantity: 50,
        nutriments: {
          "energy-kcal_100g": 400,
          "energy-kcal_serving": 210,
          proteins_100g: 20,
          proteins_serving: 11,
        },
      },
    });
    const item = await lookupBarcodeProduct("123");
    expect(item!.calories).toBe(210);
    expect(item!.protein).toBe(11);
  });

  it("returns null when the product has no name or all-zero nutrition", async () => {
    mockFetchOnce({ status: 1, product: { nutriments: {} } });
    expect(await lookupBarcodeProduct("123")).toBeNull();
  });
});
