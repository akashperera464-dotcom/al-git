# Verda ERP · Firestore Database Architecture

Root-level collections. Sub-collections use the `parent/{id}/child` convention.
Security rules enforce role-scoped access: `admin` (full), `supervisor` (field ops),
`supplier` (own records + read-only advisories).

## 1. Core hierarchy

```
estates/{estateId}
  name: string
  region: string
  areaHa: number
  elevationM: number
  geo: geopoint
  divisions/{divisionId}
    name, manager, estateId(ref), areaHa
    fields/{fieldId}
      code, name, cultivar, plantingYear, areaHa, elevationM,
      status: 'plucking'|'pruned'|'young'|'nursery', lastYieldKg, geo: geopoint
      blocks/{blockId}   -> code, areaHa
```

## 2. Labor & payroll

```
workers/{workerId}
  name, nic(string), divisionId(ref), role, bankAccount,
  pointsBalance, attendance30d, avgKgPerDay, present(bool)

attendance/{attId}        # offline-writeable
  workerId(ref), date, inTime, qrToken, synced(bool), deviceId

payroll_runs/{runId}
  period, gross, epfEmployee(8%), epfEmployer(12%), etfEmployer(3%), net, bankFileUrl

loans/{loanId}
  workerId(ref), type, principal, balance, monthlyDeduction, dueDate, status
```

## 3. Field inputs

```
fertilizer_stock/{sku}     -> sku, type, onHandKg, reorderKg, costPerKg
fertilizer_logs/{logId}    -> fieldId(ref), product, qtyKg, costPerHa, appliedBy, date

agrochemical_stock/{id}    -> name, category, onHand, nextSpray, certified(bool)
agrochemical_audit/{id}    -> operator, product, fieldId, dose, reason, date   # cert trail

crop_tasks/{id}            -> activity, fieldId(ref), due, status, cycle
```

## 4. Harvest & factory

```
collection_centers/{ccId}  -> name, geo, capacityKg
harvest/{recId}            -> centerId, workerId, fieldId, grossKg, deductionKg, netKg, grade, ts

factory_batches/{batchId}  -> greenLeafInKg, madeTeaKg(map), wasteKg, conversionPct, revenue
inventory_items/{itemId}   -> name, category, qty, location, qr
```

## 5. Finance & people

```
ledger_entries/{id}        -> account, type, debit, credit, dimension(estate/div/field), ts
cashbook/{id}              -> type(in/out), amount, party, ref, ts
welfare_units/{id}         -> block, families, condition
welfare_cases/{id}         -> type, person, detail, status
loyalty_points/{id}        -> workerId, points, tier, reason, ts
```

## 6. Suppliers (VVIP) + notifications

```
users/{uid}                          -> role, associatedEntityId(ref estates/{id}), status
                                        (admin sets associatedEntityId; a user may never edit it)

suppliers/{supplierId}
  phone(otp-verified), tier('VVIP Gold'|'VVIP Platinum'),
  lastFertDate, cropStage, soilMoisturePct, cultivar, pricePerKg, outstandingPayable
  supplies/{supId} -> supplierId(==uid), estateId(==associatedEntityId),
                      date, kg, grade, amount, status('Paid'|'Pending')

fcm_tokens/{tokenId}       -> userId, role, token, platform('web'|'android')
push_log/{id}              -> audience, channel('fcm'), title, body, payload, status, ts
```

### Two-step supplier ↔ estate association

**Step 1 (admin):** `createEstate/createDivision/createField` (admin-only) build the
`estates/{id}/divisions/{id}/fields/{id}` tree. UI: *Estate Master → Create Hierarchy Node*.

**Step 2 (admin):** when creating a user with `role: supplier`, the admin picks an Estate
from a dropdown and it is stored on `users/{uid}.associatedEntityId`. UI: *User Management → Add user*.

**Step 3 (data scoping):** the supplier's portal reads are scoped server-side to
`supplierId == request.auth.uid && estateId == associatedEntityId` (rule #2 + #3).
A supplier can therefore only ever see their own deliveries/payments tied to their
linked estate — never internal rosters, payroll, or another supplier's records.

## 7. Resource requisitions (supplier → admin ticket flow)

```
resource_requests/{id}
  supplierId: ref(suppliers/{uid})      # who raised it
  supplierName: string (denormalised)
  type: 'Workers' | 'Equipment'
  itemDetails: string                   # e.g. 'Pluckers' or 'Knapsack Sprayer (16L)'
  quantity: number
  dateNeeded: timestamp                 # ISO datetime
  durationDays: number
  note: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  adminNotes: string                    # allocation note OR rejection reason
  timestamp: timestamp
```

Cross-reference pools before allocating:
- Workers → `workers/{role}` aggregates (Pluckers / Field Workers / Sprayers …)
- Equipment → `inventory_items/{qr}` on-hand counts

Real-time trigger (Cloud Function):

```
functions.firestore.document('resource_requests/{id}')
  .onUpdate(async (change, ctx) => {
    const before = change.before.data();
    const after = change.after.data();
    if (before.status === after.status) return;        // silent otherwise
    const tokens = await getTokensFor(after.supplierId);  // fcm_tokens/{uid}
    await sendFcmToSupplier({                            // src/lib/fcm.ts
      token: tokens[0],
      title: after.status === 'APPROVED'
        ? 'Resource Request Approved ✅' : 'Resource Request Rejected',
      body: `${after.quantity}× ${after.itemDetails}` +
            (after.adminNotes ? ' — ' + after.adminNotes : ''),
      data: { requestId: ctx.params.id, type: after.type, status: after.status },
    });
  });
```

Security: suppliers may only `create` (with `status == 'PENDING'` & their own
`supplierId`) and `read` their own docs; the silent `status`/`adminNotes` change
is **admin-only**. No paid SMS gateway is used — delivery is via free FCM.

## Background trigger (Cloud Function)

`scheduledSupplierTick` (every 06:00 local) reads each supplier's `lastFertDate`,
pulls the OpenWeatherMap 7-day forecast, runs `evaluateFertilizerWindow()` and, if
the level is `due`/`critical`, writes an FCM message to `push_log` + dispatches to tokens.
The SAME deterministic function runs in the client (src/lib/predictive.ts).
