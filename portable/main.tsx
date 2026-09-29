import React, { lazy, Suspense, Component, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import "../app/globals.css";
import Home from "../app/page";
const Manage = lazy(() => import("../app/manage/page"));
const Admin = lazy(() => import("../app/admin/page"));
class RouteBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <main className="shell">
        <h1>No se pudo cargar la página</h1>
        <p>Comprueba tu conexión y vuelve a intentarlo.</p>
        <button onClick={() => location.reload()}>Volver a cargar</button>
      </main>
    ) : (
      this.props.children
    );
  }
}
const route = location.pathname.replace(/\/$/, "");
createRoot(document.getElementById("root")!).render(
  <RouteBoundary>
    <Suspense
      fallback={
        <main className="shell" role="status">
          Cargando at meet…
        </main>
      }
    >
      {route === "/admin" ? (
        <Admin />
      ) : route === "/manage" ? (
        <Manage />
      ) : (
        <Home />
      )}
    </Suspense>
  </RouteBoundary>,
);
