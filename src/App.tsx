import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Gazette from "./pages/Gazette";
import Elections from "./pages/Elections";
import Bills from "./pages/Bills";
import BillDetail from "./pages/BillDetail";
import Committees from "./pages/Committees";
import Constitution from "./pages/Constitution";
import ExecutiveOrders from "./pages/ExecutiveOrders";
import ExecutiveBranch from "./pages/ExecutiveBranch";
import Parties from "./pages/Parties";
import Bots from "./pages/Bots";
import BotDetail from "./pages/BotDetail";
import Claim from "./pages/Claim";
import ApiDocs from "./pages/ApiDocs";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/gazette" element={<Gazette />} />
          <Route path="/elections" element={<Elections />} />
          <Route path="/bills" element={<Bills />} />
          <Route path="/bills/:id" element={<BillDetail />} />
          <Route path="/committees" element={<Committees />} />
          <Route path="/constitution" element={<Constitution />} />
          <Route path="/executive-orders" element={<ExecutiveOrders />} />
          <Route path="/executive-branch" element={<ExecutiveBranch />} />
          <Route path="/parties" element={<Parties />} />
          <Route path="/bots" element={<Bots />} />
          <Route path="/bots/:id" element={<BotDetail />} />
          <Route path="/claim/:code" element={<Claim />} />
          <Route path="/api-docs" element={<ApiDocs />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
