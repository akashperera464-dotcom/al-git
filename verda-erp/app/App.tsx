import { useCallback, useEffect, useRef, useState } from "react";
import { StatusBar, StyleSheet, View } from "react-native";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";
import { LoadingScreen } from "./src/components/LoadingScreen";
import { OfflineScreen } from "./src/components/OfflineScreen";
import { LanguageSwitcher } from "./src/components/LanguageSwitcher";
import { usePushNotifications } from "./src/hooks/usePushNotifications";
import { WEB_URL, BOOTSTRAP_JS } from "./src/config";
import type { LanguageCode } from "./src/i18n";
import "./src/i18n"; // global i18next init (en/si/ta)

/**
 * Verda · Native Hybrid Shell (React Native + Expo)
 * ------------------------------------------------------------------
 * Loads the deployed Verda PWA in a full-screen WebView while:
 *   • showing a branded loader until the first paint,
 *   • surfacing a native "You are offline" screen with Retry,
 *   • capturing the FCM device token & forwarding push notifications
 *     into the WebView bridge (see src/hooks/usePushNotifications.ts).
 */
export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor="#04231A" />
      <Shell />
    </SafeAreaProvider>
  );
}

function Shell() {
  const insets = useSafeAreaInsets();
  const webViewRef = useRef<WebView>(null);

  const [online, setOnline] = useState<boolean>(true);
  const [loaded, setLoaded] = useState<boolean>(false);
  const [retrying, setRetrying] = useState<boolean>(false);
  const [reloadKey, setReloadKey] = useState<number>(0);

  // Subscribe to the FCM token + notification listeners.
  usePushNotifications(webViewRef);

  // ---- Connectivity: persistent NetInfo subscription ---------------------
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const connected = Boolean(state.isConnected && state.isInternetReachable);
      setOnline(connected);
      if (!connected) setLoaded(false);
    });
    return () => unsubscribe();
  }, []);

  const checkConnection = useCallback(async () => {
    setRetrying(true);
    const state = await NetInfo.fetch();
    const connected = Boolean(state.isConnected && state.isInternetReachable);
    setOnline(connected);
    if (connected) setReloadKey((k) => k + 1); // force WebView remount + fresh load
    setRetrying(false);
  }, []);

  // ---- Sync the native language choice into the embedded PWA ---------------
  // Writes the same 'verda.lang' localStorage key the web LanguageDetector reads,
  // then reloads so the PWA re-renders in the chosen language.
  const onLanguageChange = useCallback(
    (code: LanguageCode) => {
      webViewRef.current?.injectJavaScript(
        `(function(){ try { localStorage.setItem('verda.lang', ${JSON.stringify(code)}); window.location.reload(); } catch(e){} })(); true;`
      );
    },
    []
  );

  // ---- WebView ↔ PWA bridge messages -------------------------------------
  const onMessage = useCallback((event: WebViewMessageEvent) => {
    // The PWA can postMessage() out — e.g. request a fresh token re-forward
    // or trigger a native share sheet. Unknown/non-JSON payloads are ignored.
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg?.type === "verda:request-fcm-token") {
        // Token listeners re-fire on next foreground; nothing to do here.
      }
    } catch {
      /* ignore non-JSON bridge messages */
    }
  }, []);

  // Offline takes priority over the WebView — show the native screen.
  if (!online) {
    return <OfflineScreen retrying={retrying} onRetry={checkConnection} />;
  }

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <WebView
        key={reloadKey}
        ref={webViewRef}
        source={{ uri: WEB_URL }}
        // Inject the native-shell flag before page scripts run.
        injectedJavaScriptBeforeContentLoaded={BOOTSTRAP_JS}
        onMessage={onMessage}
        onLoadStart={() => setLoaded(false)}
        onLoadEnd={() => setLoaded(true)}
        onError={(e) => {
          console.warn("[webview] load error:", e.nativeEvent.description);
          setOnline(false);
        }}
        onHttpError={(e) => {
          if (e.nativeEvent.statusCode >= 500) setOnline(false);
        }}
        startInLoadingState
        renderLoading={() => <LoadingScreen />}
        allowsBackForwardNavigationGestures
        allowsPullToRefresh
        javaScriptEnabled
        domStorageEnabled
        cacheEnabled
        sharedCookiesEnabled
        mediaPlaybackRequiresUserAction={false}
        style={styles.webview}
      />
      {/* Floating language switcher (syncs choice to the PWA via the bridge). */}
      <View style={[styles.switcherWrap, { top: insets.top + 8 }]}>
        <LanguageSwitcher onLanguageChange={onLanguageChange} />
      </View>
      {/* Branded fade-over while the PWA paints its very first frame. */}
      {!loaded && (
        <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
          <LoadingScreen />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#04231A",
  },
  webview: {
    flex: 1,
    backgroundColor: "#04231A",
  },
  switcherWrap: {
    position: "absolute",
    right: 12,
  },
});
