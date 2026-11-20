import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_SERVICE_REQUEST_POLICY,
  calculateEligibility,
  normalizeServiceRequestPolicy,
} from "../../../server/serviceRequestWorkflow";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("smart supplier request eligibility", () => {
  it("subtracts Office deductions and pending/approved advances", () => {
    const result = calculateEligibility({
      monthlyKg: 200,
      officeDeductions: 5_000,
      committedAdvances: 2_000,
      policy: DEFAULT_SERVICE_REQUEST_POLICY,
      officeFetchedAt: "2026-11-20T00:00:00.000Z",
    });
    expect(result.grossLeafValue).toBe(30_000);
    expect(result.policyLimit).toBe(15_000);
    expect(result.eligibleAmount).toBe(8_000);
  });

  it("honours the configured maximum and never returns a negative limit", () => {
    const capped = calculateEligibility({
      monthlyKg: 10_000,
      officeDeductions: 49_000,
      committedAdvances: 2_000,
      policy: DEFAULT_SERVICE_REQUEST_POLICY,
      officeFetchedAt: "2026-11-20T00:00:00.000Z",
    });
    expect(capped.policyLimit).toBe(50_000);
    expect(capped.eligibleAmount).toBe(0);
  });

  it("normalizes unsafe policy values to controlled defaults", () => {
    const policy = normalizeServiceRequestPolicy({
      baseRatePerKg: -1,
      advancePercentage: 5,
      maxAdvanceAmount: 0,
      teaPackets: [],
      fertilizers: [],
    });
    expect(policy.baseRatePerKg).toBe(DEFAULT_SERVICE_REQUEST_POLICY.baseRatePerKg);
    expect(policy.advancePercentage).toBe(DEFAULT_SERVICE_REQUEST_POLICY.advancePercentage);
    expect(policy.teaPackets.length).toBeGreaterThan(0);
  });
});

describe("smart supplier request architecture", () => {
  const workflow = read("server/serviceRequestWorkflow.ts");
  const supplierUi = read("src/modules/SmartSupplierRequest.tsx");
  const client = read("src/lib/supplierServiceRequests.ts");
  const migration = read("docs/migration_smart_supplier_requests.sql");

  it("calls Office data only for eligibility and final create validation", () => {
    expect(workflow).toContain('getFactoryDataForUser("balance", uid, forceRefresh)');
    expect(workflow).toContain('if (monthlyKg <= 0)');
    expect(workflow).toContain('getFactoryDataForUser("crop", uid, forceRefresh)');
    expect(supplierUi).not.toContain("setInterval(");
  });

  it("keeps financial records behind the authenticated server gateway", () => {
    expect(migration).toContain("revoke all on public.supplier_service_requests from anon,authenticated");
    expect(migration).toContain("with check(key='branding')");
    expect(migration).not.toContain('create policy "settings open write"');
    expect(client).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(client).toContain("currentUser.getIdToken()");
  });

  it("uses an atomic database lock to prevent concurrent over-limit advances", () => {
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("ELIGIBLE_LIMIT_EXCEEDED");
    expect(workflow).toContain('rpc/create_supplier_service_request');
  });

  it("publishes only a status-only event table to Realtime", () => {
    expect(migration).toContain("supplier_service_request_events");
    expect(migration).toContain("alter publication supabase_realtime add table public.supplier_service_request_events");
    expect(client).toContain('table: "supplier_service_request_events"');
  });
});
