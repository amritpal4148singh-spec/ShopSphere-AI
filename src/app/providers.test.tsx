import { render, screen } from "@testing-library/react";
import { useQueryClient } from "@tanstack/react-query";

import { QUERY_STALE_TIME_MS } from "@/lib/query-client";
import { Providers } from "./providers";

function StaleTimeProbe() {
  const client = useQueryClient();
  return <p>stale time: {String(client.getDefaultOptions().queries?.staleTime)}</p>;
}

describe("Providers", () => {
  it("makes a configured TanStack Query client available to children", () => {
    render(
      <Providers>
        <StaleTimeProbe />
      </Providers>,
    );

    expect(screen.getByText(`stale time: ${QUERY_STALE_TIME_MS}`)).toBeInTheDocument();
  });
});
