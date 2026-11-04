import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { backfillLocalImages } from "../services/localImages";
import { ThemeProvider, useTheme, useThemeControls } from "../theme/ThemeProvider";

function Navigator() {
  const t = useTheme();
  const { theme } = useThemeControls();
  return (
    <>
      <StatusBar style={theme.isDark ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: t.bg,
          },
          headerTintColor: t.text,
          headerTitleStyle: {
            fontWeight: "bold",
          },
          contentStyle: { backgroundColor: t.bg },
        }}
      >
        {/* Study, Progress and Account live in the bottom tabs, which bring their own header. */}
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  // Keep a copy of every card picture on the phone. Runs in the background, one image at a time.
  useEffect(() => {
    void backfillLocalImages();
  }, []);

  return (
    <ThemeProvider>
      <Navigator />
    </ThemeProvider>
  );
}
