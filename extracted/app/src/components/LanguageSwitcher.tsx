import { useState } from "react";
import { StyleSheet, Text, View, TouchableOpacity, Modal, FlatList } from "react-native";
import { useTranslation } from "react-i18next";
import { SUPPORTED_LANGUAGES, type LanguageCode } from "../i18n";

interface Props {
  /** Injects the chosen language into the WebView so the PWA follows suit. */
  onLanguageChange?: (code: LanguageCode) => void;
}

/**
 * Native language switcher. Tapping the globe opens a modal sheet of the
 * three languages; the selection persists (AsyncStorage) and is forwarded to
 * the embedded PWA via the WebView bridge.
 */
export function LanguageSwitcher({ onLanguageChange }: Props) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);

  const current = SUPPORTED_LANGUAGES.find((l) => l.code === i18n.language) ?? SUPPORTED_LANGUAGES[0];

  const choose = (code: LanguageCode) => {
    void i18n.changeLanguage(code);
    onLanguageChange?.(code);
    setOpen(false);
  };

  return (
    <>
      <TouchableOpacity style={styles.trigger} onPress={() => setOpen(true)} activeOpacity={0.8}>
        <Text style={styles.globe}>🌐</Text>
        <Text style={styles.label}>{t(current.labelKey)}</Text>
      </TouchableOpacity>

      <Modal transparent animationType="slide" visible={open} onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setOpen(false)}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.title}>{t("common.language")}</Text>
            <FlatList
              data={SUPPORTED_LANGUAGES}
              keyExtractor={(item) => item.code}
              renderItem={({ item }) => {
                const active = item.code === i18n.language;
                return (
                  <TouchableOpacity
                    style={[styles.option, active && styles.optionActive]}
                    onPress={() => choose(item.code)}
                  >
                    <Text style={styles.flag}>{item.flag}</Text>
                    <Text style={[styles.optionLabel, active && styles.optionLabelActive]}>
                      {t(item.labelKey)}
                    </Text>
                    {active && <Text style={styles.check}>✓</Text>}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
  },
  globe: { fontSize: 14 },
  label: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 32,
    paddingTop: 12,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 4,
    backgroundColor: "#E2E8F0",
    alignSelf: "center",
    marginBottom: 16,
  },
  title: { fontSize: 16, fontWeight: "800", color: "#0F172A", marginBottom: 12 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 8,
  },
  optionActive: { borderColor: "#10B981", backgroundColor: "#ECFDF5" },
  flag: { fontSize: 22 },
  optionLabel: { flex: 1, fontSize: 15, fontWeight: "600", color: "#334155" },
  optionLabelActive: { color: "#047857" },
  check: { color: "#10B981", fontWeight: "800", fontSize: 16 },
});
