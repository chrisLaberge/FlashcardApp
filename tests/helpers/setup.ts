// AsyncStorage needs a native module; use the in-memory mock everywhere.
jest.mock("@react-native-async-storage/async-storage", () =>
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
