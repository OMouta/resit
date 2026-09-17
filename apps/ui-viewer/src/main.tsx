import "@resit/ui/styles/globals.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router";

import { App } from "./app";
import {
  ExampleView,
  HomeView,
  NotFound,
  PageView,
  ReferencesView,
  SectionIndex,
} from "./viewer/views";
import { SECTIONS } from "./viewer/types";

const router = createBrowserRouter([
  {
    path: "/",
    Component: App,
    children: [
      { index: true, Component: HomeView },
      { path: "references", Component: ReferencesView },
      ...SECTIONS.map((section) => ({
        path: section,
        element: <SectionIndex section={section} />,
      })),
      { path: ":section/:slug", Component: PageView },
      { path: ":section/:slug/:exampleId", Component: ExampleView },
      { path: "*", Component: NotFound },
    ],
  },
]);

const root = document.getElementById("root");
if (!root) throw new Error("Missing application root");

createRoot(root).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
