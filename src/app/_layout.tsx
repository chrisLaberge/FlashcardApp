import { Stack } from "expo-router";

export default function RootLayout() {
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