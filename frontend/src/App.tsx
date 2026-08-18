import { Route, Routes } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import ProjectDetail from "./pages/ProjectDetail";
import AdminPrompts from "./pages/AdminPrompts";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/projects/:id" element={<ProjectDetail />} />
      <Route path="/admin/prompts" element={<AdminPrompts />} />
    </Routes>
  );
}
