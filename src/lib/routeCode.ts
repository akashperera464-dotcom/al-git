const clean = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, "");

export function routeCode(factoryName: string, routeName: string): string {
  const factory = /peak\s*view/i.test(factoryName) ? "PKV" : clean(factoryName).slice(0, 3).padEnd(3, "X");
  const normalizedRoute = clean(routeName.replace(/^SL[_\s-]*/i, ""));
  const route = normalizedRoute === "BAMBARALAKANDA" ? "BAN" : normalizedRoute.slice(0, 3).padEnd(3, "X");
  return `${factory}-${route}`;
}
