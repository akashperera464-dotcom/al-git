import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "./LanguageSwitcher";

/**
 * Native offline screen. Rendered whenever NetInfo reports no connectivity,
 * so the user never sees a broken WebView error. "Retry" re-checks the
 * network and reloads the PWA. Tri-lingual, with an inline language switcher.
 */
export function OfflineScreen({ retrying, onRetry }: { retrying: boolean; onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <View style={styles.topBar}>
        <LanguageSwitcher />
      </View>
      <View style={styles.center}>
        <View style={styles.icon}>
          <Text style={styles.iconGlyph}>📡</Text>
        </View>
        <Text style={styles.title}>{t("common.youAreOffline")}</Text>
        <Text style={styles.subtitle}>{t("common.offlineMsg")}</Text>

        <TouchableOpacity
          style={[styles.button, retrying && styles.buttonDisabled]}
          onPress={onRetry}
          disabled={retrying}
          activeOpacity={0.85}
        >
          {retrying ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>{t("common.retry")}</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#064E3B" },
  topBar: { paddingHorizontal: 16, paddingTop: 8, alignItems: "flex-end" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  icon: {
    width: 96, height: 96, borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.10)",
    alignItems: "center", justifyContent: "center", marginBottom: 24,
  },
  iconGlyph: { fontSize: 48 },
  title: { fontSize: 22, fontWeight: "800", color: "#FFFFFF" },
  subtitle: {
    fontSize: 14, color: "rgba(255,255,255,0.72)",
    textAlign: "center", marginTop: 10, lineHeight: 21,
  },
  button: {
    marginTop: 30, backgroundColor: "#10B981",
    paddingVertical: 14, paddingHorizontal: 32, borderRadius: 16,
    minWidth: 220, alignItems: "center",
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
});
