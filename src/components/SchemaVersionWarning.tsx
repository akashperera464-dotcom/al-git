import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { readLatestSchemaVersion, schemaMeetsMinimum } from "@/lib/schemaVersion";
import { useApp } from "@/context/AppContext";
import { supabaseConfigured } from "@/lib/supabase";

export function SchemaVersionWarning() {
  const { t } = useTranslation();
  const { role, isAuthenticated } = useApp();
  const [outdated, setOutdated] = useState(false);
  useEffect(() => {
    if (!supabaseConfigured || !isAuthenticated || !["admin", "super_admin"].includes(role)) { setOutdated(false); return; }
    void readLatestSchemaVersion().then((version) => setOutdated(!schemaMeetsMinimum(version))).catch(() => setOutdated(true));
  }, [isAuthenticated, role]);
  if (!outdated) return null;
  return <div role="alert" className="flex items-center gap-2 bg-amber-500 px-4 py-2 text-xs font-bold text-amber-950"><AlertTriangle className="h-4 w-4" />{t("schema.updateRequired")}</div>;
}
