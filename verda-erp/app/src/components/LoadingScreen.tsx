import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

/**
 * Branded loading screen shown while the PWA boots inside the WebView.
 * Mirrors the web app's emerald theme + tea-leaf identity. Tri-lingual.
 */
export function LoadingScreen() {
  const { t } = useTranslation();
  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <View style={styles.center}>
        <View style={styles.logo}>
          <Text style={styles.leaf}>🍃</Text>
        </View>
        <Text style={styles.title}>{t("common.appName")}</Text>
        <Text style={styles.subtitle}>{t("common.loadingConsole")}</Text>
        <ActivityIndicator size="large" color="#10B981" style={styles.spinner} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#04231A" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  logo: {
    width: 84, height: 84, borderRadius: 24,
    backgroundColor: "rgba(16,185,129,0.18)",
    alignItems: "center", justifyContent: "center", marginBottom: 20,
  },
  leaf: { fontSize: 40 },
  title: { fontSize: 24, fontWeight: "800", color: "#FFFFFF", letterSpacing: 0.2 },
  subtitle: { fontSize: 13, color: "rgba(255,255,255,0.6)", marginTop: 6 },
  spinner: { marginTop: 28 },
});
