import { describe, expect, it } from "vitest";
import { DEFAULT_BRANDING } from "../branding";
import { resolveShellBrandIdentity } from "../brandIdentity";

describe("role-specific shell branding", () => {
  it("uses the dedicated supplier identity for supplier sessions", () => {
    const branding = {
      ...DEFAULT_BRANDING,
      companyName: "Admin Company",
      companyTagline: "Admin Console",
      companyLogoUrl: "https://cdn.example.com/admin.png",
      supplierCompanyName: "Supplier Tea Co",
      supplierCompanyTagline: "Supplier Services",
      supplierCompanyLogoUrl: "https://cdn.example.com/supplier.png",
    };
    expect(resolveShellBrandIdentity(branding, "supplier")).toMatchObject({
      name: "Supplier Tea Co",
      tagline: "Supplier Services",
      logoUrl: "https://cdn.example.com/supplier.png",
      isSupplierBrand: true,
    });
    expect(resolveShellBrandIdentity(branding, "admin").name).toBe("Admin Company");
  });

  it("inherits general branding when supplier fields are blank", () => {
    const branding = { ...DEFAULT_BRANDING, companyName: "KDU Group", companyTagline: "Tea Estate ERP", companyLogoUrl: "https://cdn.example.com/kdu.png" };
    expect(resolveShellBrandIdentity(branding, "supplier")).toMatchObject({
      name: "KDU Group",
      tagline: "Tea Estate ERP",
      logoUrl: "https://cdn.example.com/kdu.png",
    });
  });
});
