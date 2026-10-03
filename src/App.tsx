import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ComponentType } from "react"
import { createBrowserRouter, RouterProvider } from "react-router"
import { AppShell } from "@/components/layout/AppShell"
import { Toaster } from "@/components/ui/sonner"
import { AuthProvider, RequireAuth } from "@/lib/auth"
import { configError } from "@/lib/supabase"
import { ComingSoonPage } from "@/pages/ComingSoonPage"
import { HomePage } from "@/pages/HomePage"
import { LoginPage } from "@/pages/LoginPage"

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: true } },
})

/** Route-level code splitting: each page is loaded the first time it's opened. */
function page<M>(load: () => Promise<M>, name: keyof M) {
  return async () => ({ Component: (await load())[name] as ComponentType })
}

const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  { path: "/reset-password", lazy: page(() => import("@/pages/ResetPasswordPage"), "ResetPasswordPage") },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <HomePage /> },
          { path: "batches", lazy: page(() => import("@/pages/BatchesPage"), "BatchesPage") },
          { path: "batches/new", lazy: page(() => import("@/pages/BatchFormPage"), "BatchFormPage") },
          { path: "batches/:id", lazy: page(() => import("@/pages/BatchDetailPage"), "BatchDetailPage") },
          { path: "batches/:id/edit", lazy: page(() => import("@/pages/BatchFormPage"), "BatchFormPage") },
          { path: "settings/:master", lazy: page(() => import("@/features/masters/MasterPage"), "MasterPage") },
          { path: "money", element: <ComingSoonPage title="Money" milestone="M3" /> },
          { path: "more", lazy: page(() => import("@/pages/MorePage"), "MorePage") },
          { path: "*", element: <ComingSoonPage title="Page" milestone="a later" /> },
        ],
      },
    ],
  },
])

export default function App() {
  if (configError) {
    return (
      <div className="mx-auto max-w-md p-6">
        <h1 className="text-lg font-semibold">Setup needed</h1>
        <p className="mt-2 text-sm text-muted-foreground">{configError}</p>
      </div>
    )
  }
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
        <Toaster position="top-center" richColors />
      </AuthProvider>
    </QueryClientProvider>
  )
}
