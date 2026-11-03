import { Stack } from "expo-router";
import { useEffect } from "react";
import { backfillLocalImages } from "../services/localImages";

export default function RootLayout() {
  // Keep a copy of every card picture on the phone. Runs in the background, one image at a time.
  useEffect(() => {
    void backfillLocalImages();
  }, []);

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: "#282828",
        },
        headerTintColor: "#ebdbb2",
        headerTitleStyle: {
          fontWeight: "bold",
        },
      }}
    />
  );
}
