import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { Lock, Eye, EyeOff, CheckCircle, User, Shield } from "lucide-react-native";
import { getAuth, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from "firebase/auth";
import { initializeApp } from "firebase/app";

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

// Initialize the primary Firebase app (or get existing).
const app = initializeApp(firebaseConfig, "profile-app");
const auth = getAuth(app);

export default function ProfileScreen({ route }: { route?: { params?: { userName?: string; userEmail?: string } } }) {
  const user = auth.currentUser;
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);

  const userName = route?.params?.userName ?? user?.displayName ?? user?.email ?? "User";
  const userEmail = route?.params?.userEmail ?? user?.email ?? "—";

  const handleChangePassword = async () => {
    setSuccess(false);

    // Validate inputs.
    if (!currentPassword.trim()) {
      Alert.alert("Missing", "Please enter your current password.");
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert("Weak Password", "New password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert("Mismatch", "New passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      if (!user || !user.email) throw new Error("Not authenticated.");

      // Re-authenticate with current password (Firebase requires recent sign-in).
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);

      // Update password.
      await updatePassword(user, newPassword);

      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      Alert.alert("✅ Success", "Your password has been updated successfully.");
    } catch (error: any) {
      const code = error?.code ?? "";
      let msg = "Could not update password.";
      if (code === "auth/wrong-password" || code === "auth/invalid-credential") {
        msg = "Current password is incorrect.";
      } else if (code === "auth/too-many-requests") {
        msg = "Too many attempts. Try again later.";
      } else if (code === "auth/requires-recent-login") {
        msg = "Session expired. Please log out and log back in.";
      }
      Alert.alert("Error", msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Profile header */}
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {userName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.name}>{userName}</Text>
          <Text style={styles.email}>{userEmail}</Text>
        </View>

        {/* Password change card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Shield size={20} color="#059669" />
            <Text style={styles.cardTitle}>Security & Password</Text>
          </View>

          {/* Current Password */}
          <Text style={styles.label}>Current Password</Text>
          <View style={styles.inputWrap}>
            <Lock size={16} color="#94a3b8" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              secureTextEntry={!showCurrent}
              value={currentPassword}
              onChangeText={setCurrentPassword}
              placeholder="Enter current password"
              placeholderTextColor="#cbd5e1"
              autoCapitalize="none"
            />
            <TouchableOpacity onPress={() => setShowCurrent((s) => !s)} style={styles.eyeBtn}>
              {showCurrent ? <EyeOff size={16} color="#94a3b8" /> : <Eye size={16} color="#94a3b8" />}
            </TouchableOpacity>
          </View>

          {/* New Password */}
          <Text style={styles.label}>New Password</Text>
          <View style={styles.inputWrap}>
            <Lock size={16} color="#94a3b8" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              secureTextEntry={!showNew}
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="At least 6 characters"
              placeholderTextColor="#cbd5e1"
              autoCapitalize="none"
            />
            <TouchableOpacity onPress={() => setShowNew((s) => !s)} style={styles.eyeBtn}>
              {showNew ? <EyeOff size={16} color="#94a3b8" /> : <Eye size={16} color="#94a3b8" />}
            </TouchableOpacity>
          </View>

          {/* Confirm Password */}
          <Text style={styles.label}>Confirm New Password</Text>
          <View style={styles.inputWrap}>
            <Lock size={16} color="#94a3b8" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              secureTextEntry={!showNew}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Re-enter new password"
              placeholderTextColor="#cbd5e1"
              autoCapitalize="none"
            />
          </View>

          {success && (
            <View style={styles.successBox}>
              <CheckCircle size={16} color="#059669" />
              <Text style={styles.successText}>Password updated successfully!</Text>
            </View>
          )}

          {/* Submit */}
          <TouchableOpacity
            style={[styles.btn, busy && styles.btnDisabled]}
            onPress={handleChangePassword}
            disabled={busy}
            activeOpacity={0.85}
          >
            {busy ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.btnText}>Update Password</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.hint}>
            Requires recent sign-in. If it fails, please log out and log back in first.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, backgroundColor: "#f8fafc", padding: 20 },
  header: { alignItems: "center", marginBottom: 24, marginTop: 20 },
  avatar: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: "#10B981", alignItems: "center", justifyContent: "center",
    marginBottom: 12,
  },
  avatarText: { fontSize: 28, fontWeight: "800", color: "#fff" },
  name: { fontSize: 20, fontWeight: "700", color: "#1e293b" },
  email: { fontSize: 13, color: "#94a3b8", marginTop: 2 },
  card: {
    backgroundColor: "#fff", borderRadius: 16, padding: 20,
    shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 10,
    elevation: 3, shadowOffset: { width: 0, height: 2 },
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 },
  cardTitle: { fontSize: 16, fontWeight: "700", color: "#1e293b" },
  label: { fontSize: 12, fontWeight: "600", color: "#64748b", marginBottom: 6, marginTop: 12 },
  inputWrap: {
    flexDirection: "row", alignItems: "center",
    borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 10,
    paddingHorizontal: 12, height: 48, backgroundColor: "#f8fafc",
  },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, fontSize: 14, color: "#1e293b", paddingVertical: 0 },
  eyeBtn: { padding: 4 },
  successBox: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#ecfdf5", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8,
    marginTop: 12, borderWidth: 1, borderColor: "#a7f3d0",
  },
  successText: { fontSize: 12, fontWeight: "600", color: "#065f46" },
  btn: {
    backgroundColor: "#10B981", borderRadius: 12, paddingVertical: 14,
    alignItems: "center", justifyContent: "center", marginTop: 16,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  hint: { fontSize: 11, color: "#94a3b8", textAlign: "center", marginTop: 8 },
});
