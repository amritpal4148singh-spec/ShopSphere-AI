import { fireEvent, render, screen } from "@testing-library/react";

import { PRICE_COMMIT_DELAY_MS, PriceRangeFilter } from "./price-range-filter";

const bounds = { min: 0, max: 10000 };

describe("PriceRangeFilter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the full range when no limits are set", () => {
    render(<PriceRangeFilter bounds={bounds} minPrice={undefined} maxPrice={undefined} onCommit={vi.fn()} />);
    expect(screen.getByText("₹0 to ₹10,000")).toBeInTheDocument();
  });

  it("updates the display immediately but commits only after the sliders settle", () => {
    const onCommit = vi.fn();
    render(<PriceRangeFilter bounds={bounds} minPrice={undefined} maxPrice={undefined} onCommit={onCommit} />);

    fireEvent.change(screen.getByLabelText("Minimum price"), { target: { value: "2000" } });
    expect(screen.getByText("₹2,000 to ₹10,000")).toBeInTheDocument();
    expect(onCommit).not.toHaveBeenCalled();

    vi.advanceTimersByTime(PRICE_COMMIT_DELAY_MS);
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith(2000, undefined);
  });

  it("treats a value at its bound as no limit", () => {
    const onCommit = vi.fn();
    render(<PriceRangeFilter bounds={bounds} minPrice={2000} maxPrice={5000} onCommit={onCommit} />);

    fireEvent.change(screen.getByLabelText("Minimum price"), { target: { value: "0" } });
    fireEvent.change(screen.getByLabelText("Maximum price"), { target: { value: "10000" } });
    vi.advanceTimersByTime(PRICE_COMMIT_DELAY_MS);

    expect(onCommit).toHaveBeenLastCalledWith(undefined, undefined);
  });

  it("never lets the minimum cross the maximum (edge case 7)", () => {
    const onCommit = vi.fn();
    render(<PriceRangeFilter bounds={bounds} minPrice={undefined} maxPrice={3000} onCommit={onCommit} />);

    fireEvent.change(screen.getByLabelText("Minimum price"), { target: { value: "8000" } });
    expect(screen.getByText("₹3,000 to ₹3,000")).toBeInTheDocument();

    vi.advanceTimersByTime(PRICE_COMMIT_DELAY_MS);
    expect(onCommit).toHaveBeenCalledWith(3000, 3000);
  });

  it("follows the filters when they change from outside, for example Clear filters", () => {
    const { rerender } = render(<PriceRangeFilter bounds={bounds} minPrice={2000} maxPrice={5000} onCommit={vi.fn()} />);
    expect(screen.getByText("₹2,000 to ₹5,000")).toBeInTheDocument();

    rerender(<PriceRangeFilter bounds={bounds} minPrice={undefined} maxPrice={undefined} onCommit={vi.fn()} />);
    expect(screen.getByText("₹0 to ₹10,000")).toBeInTheDocument();
  });

  it("commits with the latest callback, not the one captured when the slider moved (race-condition regression)", () => {
    const stale = vi.fn();
    const latest = vi.fn();
    const { rerender } = render(<PriceRangeFilter bounds={bounds} minPrice={undefined} maxPrice={undefined} onCommit={stale} />);

    fireEvent.change(screen.getByLabelText("Minimum price"), { target: { value: "2000" } });

    // Another filter changes while the commit is pending, so the parent passes a new callback.
    rerender(<PriceRangeFilter bounds={bounds} minPrice={undefined} maxPrice={undefined} onCommit={latest} />);
    vi.advanceTimersByTime(PRICE_COMMIT_DELAY_MS);

    expect(stale).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledTimes(1);
    expect(latest).toHaveBeenCalledWith(2000, undefined);
  });

  it("disables the sliders when every product costs the same", () => {
    render(<PriceRangeFilter bounds={{ min: 500, max: 500 }} minPrice={undefined} maxPrice={undefined} onCommit={vi.fn()} />);
    expect(screen.getByLabelText("Minimum price")).toBeDisabled();
    expect(screen.getByLabelText("Maximum price")).toBeDisabled();
  });
});
