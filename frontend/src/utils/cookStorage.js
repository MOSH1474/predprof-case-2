const STORAGE_KEY = "canteen_cook_data";

const INITIAL_STOCK = [
  { id: 1, name: "Крупы", unit: "кг", balance: 24, prepared: 6 },
  { id: 2, name: "Овощи", unit: "кг", balance: 18, prepared: 4 },
  { id: 3, name: "Мясо", unit: "кг", balance: 12, prepared: 3 },
  { id: 4, name: "Молочные продукты", unit: "л", balance: 30, prepared: 8 },
];

const normalizeArray = (value, fallback) => (Array.isArray(value) ? value : fallback);

const getCookData = () => {
  if (typeof window === "undefined") {
    return {
      mealLog: [],
      stock: INITIAL_STOCK,
      requests: [],
      leftovers: [],
    };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        mealLog: [],
        stock: INITIAL_STOCK,
        requests: [],
        leftovers: [],
      };
    }
    const parsed = JSON.parse(raw);
    return {
      mealLog: normalizeArray(parsed.mealLog, []),
      stock: normalizeArray(parsed.stock, INITIAL_STOCK),
      requests: normalizeArray(parsed.requests, []),
      leftovers: normalizeArray(parsed.leftovers, []),
    };
  } catch {
    return {
      mealLog: [],
      stock: INITIAL_STOCK,
      requests: [],
      leftovers: [],
    };
  }
};

const saveCookData = (next) => {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
};

const updateCookData = (partial) => {
  const current = getCookData();
  saveCookData({ ...current, ...partial });
};

export { STORAGE_KEY, INITIAL_STOCK, getCookData, saveCookData, updateCookData };
