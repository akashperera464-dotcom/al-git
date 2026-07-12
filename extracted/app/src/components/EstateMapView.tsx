import { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Linking, Platform, Alert } from "react-native";
import * as Location from "expo-location";
import { WebView } from "react-native-webview";
import { MapPin, Crosshair, CheckCircle, AlertCircle, ExternalLink, Loader2, Navigation } from "lucide-react-native";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/**
 * EstateMapView — renders a Google Maps embed URL inside a WebView (in-app map,
 * no leaving the app) + a "Verify My Location" GPS check-in button.
 *
 * Used on the Supervisor & Supplier dashboards inside the Expo shell.
 */
export function EstateMapView({
  embedUrl,
  estateName,
  userId,
}: {
  embedUrl?: string;
  estateName: string;
  userId: string;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <MapPin size={18} color="#059669" />
        <Text style={styles.title}>Map · {estateName}</Text>
      </View>

      {embedUrl ? (
        <View style={styles.webviewWrap}>
          <WebView
            source={{ uri: embedUrl }}
            style={styles.webview}
            allowsFullscreenView
            javaScriptEnabled
            domStorageEnabled
          />
          <TouchableOpacity style={styles.openBtn} onPress={() => Linking.openURL(embedUrl)}>
            <ExternalLink size={12} color="#059669" />
            <Text style={styles.openTxt}>Open in Maps</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.empty}>
          <MapPin size={28} color="#cbd5e1" />
          <Text style={styles.emptyTxt}>No map link set for this estate.</Text>
        </View>
      )}

      <LocationCheckInNative estateName={estateName} userId={userId} />
    </View>
  );
}

/**
 * LocationCheckInNative — "Verify My Location at Estate" using expo-location.
 * Flow: request permission → get coords → INSERT supplier_locations → toast.
 */
function LocationCheckInNative({ estateName, userId }: { estateName: string; userId: string }) {
  const [status, setStatus] = useState<"idle" | "locating" | "saving" | "done" | "error">("idle");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [error, setError] = useState<string>("");

  const verify = async () => {
    setStatus("locating");
    setError("");
    try {
      // a) Request permission
      const { status: permStatus } = await Location.requestForegroundPermissionsAsync();
      if (permStatus !== "granted") {
        setError("Location permission denied. Enable location in settings.");
        setStatus("error");
        return;
      }

      // b) Fetch coordinates (high accuracy)
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      setCoords({ lat, lng });

      // c) INSERT into Supabase supplier_locations
      setStatus("saving");
      if (SUPABASE_URL && SUPABASE_ANON_KEY) {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/supplier_locations`, {
          method: "POST",
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
          body: JSON.stringify({ user_id: userId, latitude: lat, longitude: lng }),
        });
        if (!res.ok) throw new Error(`Supabase error ${res.status}`);
      }

      // d) Success
      setStatus("done");
      Alert.alert("Location Verified Successfully! ✅", `You are checked in at ${estateName}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not verify location.");
      setStatus("error");
    }
  };

  return (
    <View style={styles.checkIn}>
      <View style={styles.checkInHead}>
        <Navigation size={16} color="#fff" />
        <Text style={styles.checkInTitle}>Estate Location Verification</Text>
      </View>

      {status === "idle" && (
        <TouchableOpacity style={styles.verifyBtn} onPress={verify} activeOpacity={0.85}>
          <Crosshair size={20} color="#fff" />
          <Text style={styles.verifyTxt}>Verify My Location at Estate</Text>
        </TouchableOpacity>
      )}

      {(status === "locating" || status === "saving") && (
        <View style={styles.loadingRow}>
          <ActivityIndicator color="#10B981" />
          <Text style={styles.loadingTxt}>
            {status === "locating" ? "Getting your GPS location…" : "Saving location…"}
          </Text>
        </View>
      )}

      {status === "done" && coords && (
        <View style={styles.successBox}>
          <View style={styles.successRow}>
            <CheckCircle size={20} color="#059669" />
            <Text style={styles.successTxt}>Location Verified Successfully!</Text>
          </View>
          <View style={styles.coordRow}>
            <View style={styles.coordBox}>
              <Text style={styles.coordLabel}>Latitude</Text>
              <Text style={styles.coordVal}>{coords.lat.toFixed(6)}</Text>
            </View>
            <View style={styles.coordBox}>
              <Text style={styles.coordLabel}>Longitude</Text>
              <Text style={styles.coordVal}>{coords.lng.toFixed(6)}</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.againBtn} onPress={verify}>
            <Text style={styles.againTxt}>Verify again</Text>
          </TouchableOpacity>
        </View>
      )}

      {status === "error" && (
        <View style={styles.errorBox}>
          <View style={styles.successRow}>
            <AlertCircle size={18} color="#dc2626" />
            <Text style={styles.errorTxt}>{error}</Text>
          </View>
          <TouchableOpacity style={styles.retryBtn} onPress={verify}>
            <Text style={styles.retryTxt}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#fff", borderRadius: 20, overflow: "hidden", marginBottom: 16, borderWidth: 1, borderColor: "#e2e8f0" },
  header: { flexDirection: "row", alignItems: "center", gap: 8, padding: 14, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  title: { fontSize: 15, fontWeight: "700", color: "#1e293b" },
  webviewWrap: { position: "relative" },
  webview: { height: 220, backgroundColor: "#f1f5f9" },
  openBtn: { position: "absolute", right: 10, top: 10, flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(255,255,255,0.92)", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  openTxt: { fontSize: 11, fontWeight: "600", color: "#059669" },
  empty: { alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 36, backgroundColor: "#f8fafc" },
  emptyTxt: { fontSize: 13, color: "#94a3b8" },
  checkIn: { borderTopWidth: 1, borderTopColor: "#f1f5f9" },
  checkInHead: { flexDirection: "row", alignItems: "center", gap: 8, padding: 14, backgroundColor: "#047857" },
  checkInTitle: { fontSize: 14, fontWeight: "700", color: "#fff" },
  verifyBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, margin: 14, backgroundColor: "#10B981", paddingVertical: 14, borderRadius: 14 },
  verifyTxt: { color: "#fff", fontSize: 15, fontWeight: "700" },
  loadingRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 14 },
  loadingTxt: { fontSize: 13, fontWeight: "600", color: "#475569" },
  successBox: { margin: 14, padding: 12, backgroundColor: "#ecfdf5", borderWidth: 1, borderColor: "#a7f3d0", borderRadius: 12 },
  successRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  successTxt: { fontSize: 13, fontWeight: "700", color: "#065f46" },
  coordRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  coordBox: { flex: 1, backgroundColor: "#fff", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  coordLabel: { fontSize: 10, color: "#94a3b8" },
  coordVal: { fontSize: 13, fontWeight: "700", color: "#334155", fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },
  againBtn: { marginTop: 10, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: "#6ee7b7", alignItems: "center" },
  againTxt: { fontSize: 12, fontWeight: "600", color: "#047857" },
  errorBox: { margin: 14, padding: 12, backgroundColor: "#fef2f2", borderWidth: 1, borderColor: "#fecaca", borderRadius: 12 },
  errorTxt: { fontSize: 12, color: "#b91c1c", flex: 1 },
  retryBtn: { marginTop: 8, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: "#fca5a5", alignItems: "center" },
  retryTxt: { fontSize: 12, fontWeight: "600", color: "#b91c1c" },
});
