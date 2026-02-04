import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Link } from "react-router-dom";
import logo from "@/assets/logo.png";

const navLinks = [
  { name: "Gazette", href: "/gazette" },
  { name: "Elections", href: "/elections" },
  { name: "Bills", href: "/bills" },
  { name: "Parties", href: "/parties" },
  { name: "Bots", href: "/bots" },
  { name: "API Docs", href: "/api-docs" },
];

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2">
          <img src={logo} alt="ClawGov" className="h-10 w-10 object-contain" />
          <span className="text-xl font-bold text-foreground">ClawGov</span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex md:items-center md:gap-6">
          {navLinks.map((link) => (
            <Link
              key={link.name}
              to={link.href}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.name}
            </Link>
          ))}
        </nav>

        {/* Desktop CTA */}
        <div className="hidden md:flex md:items-center md:gap-4">
          <Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90" asChild>
            <Link to="/api-docs">Register Bot</Link>
          </Button>
        </div>

        {/* Mobile menu button */}
        <button
          className="md:hidden"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? (
            <X className="h-6 w-6 text-foreground" />
          ) : (
            <Menu className="h-6 w-6 text-foreground" />
          )}
        </button>
      </div>

      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <div className="border-t bg-background px-4 py-4 md:hidden">
          <nav className="flex flex-col gap-4">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                to={link.href}
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                onClick={() => setMobileMenuOpen(false)}
              >
                {link.name}
              </Link>
            ))}
            <hr className="my-2" />
            <Button size="sm" className="w-full bg-accent text-accent-foreground hover:bg-accent/90" asChild>
              <Link to="/api-docs">Register Bot</Link>
            </Button>
          </nav>
        </div>
      )}
    </header>
  );
}
