import { createBrowserRouter } from "react-router"
import App from "@/App"
import { Home } from "@/routes/Home"
import { Preview } from "@/routes/Preview"
import { NotFound } from "@/routes/NotFound"

/**
 * Data mode rather than <BrowserRouter>: Link's `viewTransition` prop and
 * useViewTransitionState are data/framework-mode only, so declarative mode
 * would silently ignore them.
 * basename tracks BASE_URL so routes stay correct under the Pages subpath.
 */
export const router = createBrowserRouter(
  [
    {
      element: <App />,
      children: [
        { index: true, element: <Home /> },
        { path: "pin/:id", element: <Preview /> },
        { path: "*", element: <NotFound /> },
      ],
    },
  ],
  { basename: import.meta.env.BASE_URL },
)
