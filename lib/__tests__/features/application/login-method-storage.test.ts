import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  getPreferredLoginMethod,
  savePreferredLoginMethod,
  LOGIN_METHOD_STORAGE_KEY,
} from "@/lib/features/application/login-method-storage";

describe("login-method-storage", () => {
  let store: Record<string, string> = {};
  const mockLocalStorage = {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
    get length() { return Object.keys(store).length; },
    key: vi.fn((i: number) => Object.keys(store)[i] ?? null),
  };

  beforeEach(() => {
    store = {};
    Object.defineProperty(window, "localStorage", { value: mockLocalStorage, writable: true });
  });

  afterEach(() => {
    store = {};
  });

  describe("getPreferredLoginMethod", () => {
    it("should return 'otp-email' when nothing is stored", () => {
      expect(getPreferredLoginMethod()).toBe("otp-email");
    });

    it("should return 'password' when 'password' is stored", () => {
      localStorage.setItem(LOGIN_METHOD_STORAGE_KEY, "password");
      expect(getPreferredLoginMethod()).toBe("password");
    });

    it("should return 'otp-email' when 'otp-email' is stored", () => {
      localStorage.setItem(LOGIN_METHOD_STORAGE_KEY, "otp-email");
      expect(getPreferredLoginMethod()).toBe("otp-email");
    });

    it("should return 'otp-email' for unrecognized values", () => {
      localStorage.setItem(LOGIN_METHOD_STORAGE_KEY, "something-invalid");
      expect(getPreferredLoginMethod()).toBe("otp-email");
    });
  });

  describe("savePreferredLoginMethod", () => {
    it("should save 'password' to localStorage", () => {
      savePreferredLoginMethod("password");
      expect(localStorage.getItem(LOGIN_METHOD_STORAGE_KEY)).toBe("password");
    });

    it("should save 'otp-email' to localStorage", () => {
      savePreferredLoginMethod("otp-email");
      expect(localStorage.getItem(LOGIN_METHOD_STORAGE_KEY)).toBe("otp-email");
    });

    it("should overwrite a previous value", () => {
      savePreferredLoginMethod("password");
      savePreferredLoginMethod("otp-email");
      expect(localStorage.getItem(LOGIN_METHOD_STORAGE_KEY)).toBe("otp-email");
    });
  });
});
