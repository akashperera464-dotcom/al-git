import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Alert,
  Platform,
} from "react-native";
import { UserPlus, Building2, Layers, Phone, Mail, Lock, ChevronDown } from "lucide-react-native";
import { initializeApp, deleteApp, getApps } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signOut } from "firebase/auth";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

interface Estate { id: string; name: string; }
interface Division { id: string; name: string; estate_id: string; }

export default function RegisterSupplierScreen({ route }: { route?: { params?: { officerUid?: string } } }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [estates, setEstates] = useState<Estate[]>([]);
  const [selectedEstateId, setSelectedEstateId] = useState("");
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [filteredDivisions, setFilteredDivisions] = useState<Division[]>([]);
  const [selectedDivisionId, setSelectedDivisionId] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState("");

  // Fetch estates + divisions on mount.
  useEffect(() => {
    void fetchData();
  }, []);

  const fetchData = async () => {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return;
    try {
      const [eRes, dRes] = await Promise.all([
        fetch(`${SUPABASE_URL}/rest/v1/estates?select=id,name&order=name.asc`, {
          headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
        }),
        fetch(`${SUPABASE_URL}/rest/v1/divisions?select=id,name,estate_id&order=name.asc`, {
          headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
        }),
      ]);
      const eData = await eRes.json();
      const dData = await dRes.json();
      setEstates(eData ?? []);
      setDivisions(dData ?? []);
    } catch (e) {
      console.error("[register] Failed to load data:", e);
    } finally {
      setLoadingData(false);
    }
  };

  // Cascading: when estate changes, filter divisions.
  const onEstateChange = useCallback((estateId: string) => {
    setSelectedEstateId(estateId);
    setSelectedDivisionId("");
    if (estateId) {
      setFilteredDivisions(divisions.filter((d) => d.estate_id === estateId));
    } else {
      setFilteredDivisions([]);
    }
  }, [divisions]);

  const register = async () => {
    setError("");

    // Validation
    if (!name.trim()) { setError("Full name is required."); return; }
    if (!email.trim()) { setError("Email is required."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (!selectedEstateId) { setError("Please select a factory."); return; }

    setBusy(true);
    let tmpApp: any = null;

    try {
      // Use a secondary Firebase app so the officer isn't signed out.
      const tmpName = `secondary-${Date.now()}`;
      tmpApp = initializeApp(firebaseConfig, tmpName);
      const tmpAuth = getAuth(tmpApp);

      // Create the new user.
      const cred = await createUserWithEmailAndPassword(tmpAuth, email.trim(), password);
      const newUid = cred.user.uid;

      // Sign out the temp app + clean up.
      await signOut(tmpAuth);
      try { await deleteApp(tmpApp); } catch { /* ignore */ }

      // Insert profile into Supabase users table.
      if (SUPABASE_URL && SUPABASE_ANON_KEY) {
        const selectedDivision = filteredDivisions.find((d) => d.id === selectedDivisionId);
        const res = await fetch(`${SUPABASE_URL}/rest/v1/users`, {
          method: "POST",
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
          body: JSON.stringify({
            id: newUid,
            name: name.trim(),
            email: email.trim(),
            phone: phone.trim() || null,
            role: "supplier",
            associated_entity_id: selectedEstateId,
            division: selectedDivision?.name ?? null, // nullable — optional
            status: "active",
          }),
        });

        if (!res.ok) {
          const errBody = await res.text();
          throw new Error(`Database error: ${res.status} ${errBody}`);
        }
      }

      Alert.alert("✅ Success", `${name.trim()} registered as a supplier successfully!`);
      // Reset form.
      setName(""); setEmail(""); setPassword(""); setPhone("");
      setSelectedEstateId(""); setSelectedDivisionId(""); setFilteredDivisions([]);
    } catch (e: any) {
      const code = e?.code ?? "";
      let msg = e?.message ?? "Registration failed.";
      if (code === "auth/email-already-in-use") msg = "An account with this email already exists.";
      else if (code === "auth/weak-password") msg = "Password is too weak.";
      else if (code === "auth/invalid-email") msg = "Invalid email format.";
      setError(msg);
    } finally {
      setBusy(false);
      if (tmpApp) {
        try { await deleteApp(tmpApp); } catch { /* already cleaned up */ }
      }
    }
  };

  if (loadingData) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color="#10B981" size="large" />
        <Text style={styles.loadingText}>Loading factories…</Text>
      </View>
    );
  }

  const selectedEstate = estates.find((e) => e.id === selectedEstateId);

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Text style={styles.title}>Register New Supplier</Text>
      <Text style={styles.subtitle}>Onboard a VVIP supplier into a factory</Text>

      {/* Full Name */}
      <Text style={styles.label}>Full Name *</Text>
      <View style={styles.inputWrap}>
        <UserPlus size={16} color="#94a3b8" style={styles.icon} />
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Nimal Suppliers"
          placeholderTextColor="#cbd5e1"
        />
      </View>

      {/* Email */}
      <Text style={styles.label}>Email *</Text>
      <View style={styles.inputWrap}>
        <Mail size={16} color="#94a3b8" style={styles.icon} />
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="supplier@kdu.com"
          placeholderTextColor="#cbd5e1"
          keyboardType="email-address"
          autoCapitalize="none"
        />
      </View>

      {/* Password */}
      <Text style={styles.label}>Temporary Password *</Text>
      <View style={styles.inputWrap}>
        <Lock size={16} color="#94a3b8" style={styles.icon} />
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="min 6 characters"
          placeholderTextColor="#cbd5e1"
          secureTextEntry
        />
      </View>

      {/* Phone */}
      <Text style={styles.label}>Phone (optional)</Text>
      <View style={styles.inputWrap}>
        <Phone size={16} color="#94a3b8" style={styles.icon} />
        <TextInput
          style={styles.input}
          value={phone}
          onChangeText={setPhone}
          placeholder="+94 77 000 0000"
          placeholderTextColor="#cbd5e1"
          keyboardType="phone-pad"
        />
      </View>

      {/* Factory Dropdown */}
      <Text style={styles.label}>Factory *</Text>
      <View style={[styles.inputWrap, styles.dropdownWrap]}>
        <Building2 size={16} color="#94a3b8" style={styles.icon} />
        <View style={styles.pickerWrap}>
          {Platform.OS === "web" ? (
            <select
              style={{ width: "100%", height: 48, border: "none", backgroundColor: "transparent", fontSize: 14, color: "#1e293b", outline: "none" }}
              value={selectedEstateId}
              onChange={(e) => onEstateChange((e.target as HTMLSelectElement).value)}
            >
              <option value="">— select factory —</option>
              {estates.map((e) => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          ) : (
            <>
              <Text style={[styles.pickerText, !selectedEstateId && { color: "#cbd5e1" }]}>
                {selectedEstate ? selectedEstate.name : "— select factory —"}
              </Text>
              <ChevronDown size={16} color="#94a3b8" style={{ marginLeft: "auto" }} />
              {/* Native modal picker would go here in a full RN build */}
            </>
          )}
        </View>
      </View>
      {/* Simple scrollable list for native (no modal picker lib) */}
      {Platform.OS !== "web" && (
        <ScrollView style={styles.optionList} horizontal={false} nestedScrollEnabled>
          {estates.map((e) => (
            <TouchableOpacity
              key={e.id}
              style={[styles.optionItem, selectedEstateId === e.id && styles.optionActive]}
              onPress={() => onEstateChange(e.id)}
            >
              <Text style={[styles.optionText, selectedEstateId === e.id && styles.optionTextActive]}>{e.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Route/Division Dropdown (cascading — optional) */}
      <Text style={styles.label}>Route / Division (optional)</Text>
      <View style={[styles.inputWrap, styles.dropdownWrap, !selectedEstateId && { opacity: 0.5 }]}>
        <Layers size={16} color="#94a3b8" style={styles.icon} />
        <View style={styles.pickerWrap}>
          {Platform.OS === "web" ? (
            <select
              style={{ width: "100%", height: 48, border: "none", backgroundColor: "transparent", fontSize: 14, color: "#1e293b", outline: "none" }}
              value={selectedDivisionId}
              disabled={!selectedEstateId}
              onChange={(e) => setSelectedDivisionId((e.target as HTMLSelectElement).value)}
            >
              <option value="">{selectedEstateId ? "— none —" : "select factory first"}</option>
              {filteredDivisions.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          ) : (
            <Text style={[styles.pickerText, !selectedDivisionId && { color: "#cbd5e1" }]}>
              {selectedDivisionId
                ? filteredDivisions.find((d) => d.id === selectedDivisionId)?.name ?? "— none —"
                : selectedEstateId ? "— none —" : "select factory first"}
            </Text>
          )}
        </View>
      </View>
      {Platform.OS !== "web" && selectedEstateId && filteredDivisions.length > 0 && (
        <ScrollView style={styles.optionList} horizontal={false} nestedScrollEnabled>
          {filteredDivisions.map((d) => (
            <TouchableOpacity
              key={d.id}
              style={[styles.optionItem, selectedDivisionId === d.id && styles.optionActive]}
              onPress={() => setSelectedDivisionId(d.id)}
            >
              <Text style={[styles.optionText, selectedDivisionId === d.id && styles.optionTextActive]}>{d.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Error */}
      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {/* Submit */}
      <TouchableOpacity
        style={[styles.btn, busy && styles.btnDisabled]}
        onPress={register}
        disabled={busy}
        activeOpacity={0.85}
      >
        {busy ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={styles.btnText}>Register Supplier</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, padding: 20, backgroundColor: "#f8fafc" },
  title: { fontSize: 22, fontWeight: "800", color: "#1e293b", marginBottom: 4 },
  subtitle: { fontSize: 13, color: "#94a3b8", marginBottom: 20 },
  label: { fontSize: 12, fontWeight: "600", color: "#64748b", marginBottom: 6, marginTop: 14 },
  inputWrap: {
    flexDirection: "row", alignItems: "center",
    borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 10,
    paddingHorizontal: 12, height: 48, backgroundColor: "#fff",
  },
  dropdownWrap: { paddingRight: 8 },
  icon: { marginRight: 8 },
  input: { flex: 1, fontSize: 14, color: "#1e293b", paddingVertical: 0 },
  pickerWrap: { flex: 1, flexDirection: "row", alignItems: "center" },
  pickerText: { fontSize: 14, color: "#1e293b" },
  optionList: { maxHeight: 150, borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 8, marginTop: 4, backgroundColor: "#fff" },
  optionItem: { paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  optionActive: { backgroundColor: "#ecfdf5" },
  optionText: { fontSize: 13, color: "#475569" },
  optionTextActive: { color: "#059669", fontWeight: "600" },
  errorBox: { backgroundColor: "#fef2f2", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginTop: 12, borderWidth: 1, borderColor: "#fecaca" },
  errorText: { fontSize: 12, color: "#b91c1c" },
  btn: { backgroundColor: "#10B981", borderRadius: 12, paddingVertical: 14, alignItems: "center", justifyContent: "center", marginTop: 20 },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#f8fafc" },
  loadingText: { marginTop: 8, fontSize: 13, color: "#94a3b8" },
});
