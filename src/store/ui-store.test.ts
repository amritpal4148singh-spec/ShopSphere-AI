import { useUiStore } from "./ui-store";

describe("useUiStore", () => {
  beforeEach(() => {
    useUiStore.setState({ isMobileNavOpen: false });
  });

  it("starts with the mobile navigation closed", () => {
    expect(useUiStore.getState().isMobileNavOpen).toBe(false);
  });

  it("toggles and closes the mobile navigation", () => {
    useUiStore.getState().toggleMobileNav();
    expect(useUiStore.getState().isMobileNavOpen).toBe(true);

    useUiStore.getState().closeMobileNav();
    expect(useUiStore.getState().isMobileNavOpen).toBe(false);
  });
});
