import { act, renderHook } from "@testing-library/react";

import { useDebouncedValue } from "./use-debounced-value";

describe("useDebouncedValue", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the initial value immediately", () => {
    const { result } = renderHook(() => useDebouncedValue("a", 350));
    expect(result.current).toBe("a");
  });

  it("updates only after the value has been stable for the delay", () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 350), {
      initialProps: { value: "a" },
    });

    rerender({ value: "ab" });
    act(() => {
      vi.advanceTimersByTime(349);
    });
    expect(result.current).toBe("a");

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe("ab");
  });

  it("restarts the wait on every change, so only the last value is emitted", () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 350), {
      initialProps: { value: "a" },
    });

    rerender({ value: "ab" });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    rerender({ value: "abc" });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current).toBe("a");

    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(result.current).toBe("abc");
  });
});
