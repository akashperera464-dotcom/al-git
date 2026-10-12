import { describe, expect, it } from "vitest";
import { routeCode } from "../routeCode";
describe("route code", () => { it.each([["Galpadihenna Tea Factory","Angammana","GAL-ANG"],["Kuttapitiya Tea Factory","Bambaralakanda","KUT-BAN"],["Peak view Tea Factory","Rakwana","PKV-RAK"]])("generates %s / %s", (factory, route, expected) => { expect(routeCode(factory, route)).toBe(expected); }); });
