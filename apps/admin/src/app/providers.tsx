"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState } from "react";

import { createQueryClient } from "@/lib/query";
import { setQueryClient } from "@/lib/query/client";

/**
 * One query cache for the session, created in the browser.
 *
 * It is also handed to `lib/query/client` so a write deep inside an API call
 * can mark the cache out of date without every screen having to remember to.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(createQueryClient);
  /*
   * Registered from the client React actually kept, not from inside the
   * initialiser: in development React runs an initialiser twice and throws
   * one result away, and registering there left the API client invalidating
   * the discarded cache — every save landed, and no screen refreshed.
   */
  setQueryClient(client);

  return (
    <QueryClientProvider client={client}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
    </QueryClientProvider>
  );
}
