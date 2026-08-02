import { Link, Route, Routes } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import ProjectDetail from "./pages/ProjectDetail";

export default function App() {
  return (
    <div>
      <header
        style={{
          borderBottom: "1px solid var(--border)",
          padding: "1rem 2rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "var(--surface)",
        }}
      >
        <Link to="/" style={{ textDecoration: "none", color: "inherit" }}>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 700 }}>
            <span style={{ color: "var(--primary)" }}>▶</span> YouTube Content Studio
          </h1>
        </Link>
        <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>Local MVP</span>
      </header>

      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "2rem" }}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/projects/:id" element={<ProjectDetail />} />
        </Routes>
      </main>
    </div>
  );
}
