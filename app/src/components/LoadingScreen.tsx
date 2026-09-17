import { ActivityIndicator, Image, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

/**
 * KDU TEA FACTORY branded loading screen shown while the PWA boots inside
 * the WebView. Uses the KDU logo (bundled as a native asset) + tri-lingual
 * i18n strings for the app name + loading subtitle.
 */
export function LoadingScreen() {
  const { t } = useTranslation();
  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <View style={styles.center}>
        <View style={styles.logoWrap}>
          <Image
            source={require("../../assets/icon.png")}
            style={styles.logo}
            resizeMode="contain"
            accessibilityLabel="KDU TEA FACTORY logo"
          />
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
  logoWrap: {
    width: 120, height: 120, borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center", justifyContent: "center", marginBottom: 24,
  },
  logo: { width: 90, height: 90 },
  title: { fontSize: 26, fontWeight: "800", color: "#FFFFFF", letterSpacing: 0.4 },
  subtitle: { fontSize: 13, color: "rgba(255,255,255,0.6)", marginTop: 6 },
  spinner: { marginTop: 28 },
});
