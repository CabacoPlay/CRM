import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppProvider } from "@/contexts/app-context";
import { AuthProvider } from "@/contexts/auth-context";
import { ThemeProvider } from "@/hooks/use-theme";
import { ProtectedRoute } from "@/components/auth/protected-route";
import Dashboard from "./pages/app/dashboard";
import AdminDashboard from "./pages/admin/dashboard";
import ChatPage from "./pages/app/chat";
import ContatosPage from "./pages/app/contatos";
import AgendaPage from "./pages/app/agenda";
import Conexoes from "./pages/app/conexoes";
import IAPage from "./pages/app/ia";
import Catalogo from "./pages/app/catalogo";
import CRM from "./pages/app/crm";
import ConfiguracoesPage from "./pages/app/configuracoes";
import OrcamentosPage from "./pages/app/orcamentos";
import AdminEmpresas from "./pages/admin/empresas";
import AdminUsuarios from "./pages/admin/usuarios";
import AdminConexoes from "./pages/admin/conexoes";
import AdminBranding from "./pages/admin/branding";
import NotFound from "./pages/NotFound";
import AuthPage from "./pages/auth";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AuthProvider>
          <AppProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/auth" element={<AuthPage />} />
                <Route path="/" element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                } />
                <Route path="/app/dashboard" element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                } />
                <Route path="/app/conexoes" element={
                  <ProtectedRoute>
                    <Conexoes />
                  </ProtectedRoute>
                } />
                <Route path="/app/chat" element={
                  <ProtectedRoute>
                    <ChatPage />
                  </ProtectedRoute>
                } />
                <Route path="/app/contatos" element={
                  <ProtectedRoute>
                    <ContatosPage />
                  </ProtectedRoute>
                } />
                <Route path="/app/agenda" element={
                  <ProtectedRoute>
                    <AgendaPage />
                  </ProtectedRoute>
                } />
                <Route path="/app/ia" element={
                  <ProtectedRoute>
                    <IAPage />
                  </ProtectedRoute>
                } />
                <Route path="/app/catalogo" element={
                  <ProtectedRoute>
                    <Catalogo />
                  </ProtectedRoute>
                } />
                <Route path="/app/crm" element={
                  <ProtectedRoute>
                    <CRM />
                  </ProtectedRoute>
                } />
                <Route path="/app/configuracoes" element={
                  <ProtectedRoute>
                    <ConfiguracoesPage />
                  </ProtectedRoute>
                } />
                <Route path="/app/orcamentos" element={
                  <ProtectedRoute>
                    <OrcamentosPage />
                  </ProtectedRoute>
                } />
                <Route path="/admin/dashboard" element={
                  <ProtectedRoute requiredRole="admin">
                    <AdminDashboard />
                  </ProtectedRoute>
                } />
                <Route path="/admin/empresas" element={
                  <ProtectedRoute requiredRole="admin">
                    <AdminEmpresas />
                  </ProtectedRoute>
                } />
                <Route path="/admin/usuarios" element={
                  <ProtectedRoute requiredRole="admin">
                    <AdminUsuarios />
                  </ProtectedRoute>
                } />
                <Route path="/admin/conexoes" element={
                  <ProtectedRoute requiredRole="admin">
                    <AdminConexoes />
                  </ProtectedRoute>
                } />
                <Route path="/admin/branding" element={
                  <ProtectedRoute requiredRole="admin">
                    <AdminBranding />
                  </ProtectedRoute>
                } />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </AppProvider>
        </AuthProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
