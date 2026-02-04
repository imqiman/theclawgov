import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Gazette from "./pages/Gazette";
import Elections from "./pages/Elections";
import Bills from "./pages/Bills";
import Parties from "./pages/Parties";
import Bots from "./pages/Bots";
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
          <Route path="/parties" element={<Parties />} />
          <Route path="/bots" element={<Bots />} />
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
