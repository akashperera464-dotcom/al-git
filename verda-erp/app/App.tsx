import { useCallback, useEffect, useRef, useState } from "react";
import { StatusBar, StyleSheet, View } from "react-native";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";
import { LoadingScreen } from "./src/components/LoadingScreen";
import { OfflineScreen } from "./src/components/OfflineScreen";
import { LanguageSwitcher } from "./src/components/LanguageSwitcher";
import { WEB_URL, BOOTSTRAP_JS } from "./src/config";
import type { LanguageCode } from "./src/i18n";
import "./src/i18n"; // global i18next init (en/si/ta)

/**
 * Verda · Minimal Native Shell (React Native + WebView)
 * ------------------------------------------------------------------
 * Loads the deployed Verda PWA in a full-screen WebView.
 * NO native plugins. NO FCM. NO camera/location. Pure RN + WebView.
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
    if (connected) setReloadKey((k) => k + 1);
    setRetrying(false);
  }, []);

  const onLanguageChange = useCallback(
    (code: LanguageCode) => {
      webViewRef.current?.injectJavaScript(
        `(function(){ try { localStorage.setItem('verda.lang', ${JSON.stringify(code)}); window.location.reload(); } catch(e){} })(); true;`
      );
    },
    []
  );

  const onMessage = useCallback((_event: WebViewMessageEvent) => {
    /* Bridge messages from the PWA are ignored in the minimal shell. */
  }, []);

  if (!online) {
    return <OfflineScreen retrying={retrying} onRetry={checkConnection} />;
  }

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <WebView
        key={reloadKey}
        ref={webViewRef}
        source={{ uri: WEB_URL }}
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
      <View style={[styles.switcherWrap, { top: insets.top + 8 }]}>
        <LanguageSwitcher onLanguageChange={onLanguageChange} />
      </View>
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
