import type { Role } from "./data";
import type { Branding } from "./branding";

export interface ShellBrandIdentity {
  name: string;
  tagline: string;
  logoUrl: string;
  isSupplierBrand: boolean;
}

/**
 * Resolve the visible shell identity without duplicating fallback rules in UI
 * components. Blank supplier fields intentionally inherit the general brand.
 */
export function resolveShellBrandIdentity(branding: Branding, role: Role): ShellBrandIdentity {
  const isSupplierBrand = role === "supplier";
  return {
    name: (isSupplierBrand ? branding.supplierCompanyName : branding.companyName).trim()
      || branding.companyName.trim()
      || "Estate Pulse",
    tagline: (isSupplierBrand ? branding.supplierCompanyTagline : branding.companyTagline).trim()
      || branding.companyTagline.trim(),
    logoUrl: (isSupplierBrand ? branding.supplierCompanyLogoUrl : branding.companyLogoUrl).trim()
      || branding.companyLogoUrl.trim(),
    isSupplierBrand,
  };
}
