import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import AchievementToast from "../components/AchievementToast";
import { scheduleAchievementCheck } from "../services/achievementUnlocks";
import { refreshReminders } from "../services/dailyGoal";
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
      <AchievementToast />
    </>
  );
}

export default function RootLayout() {
  // Keep a copy of every card picture on the phone. Runs in the background, one image at a time.
  useEffect(() => {
    void backfillLocalImages();
    // Award anything already earned (e.g. right after updating); a no-op once recorded.
    scheduleAchievementCheck(4000);
    void refreshReminders();
  }, []);

  return (
    <ThemeProvider>
      <Navigator />
    </ThemeProvider>
  );
}
