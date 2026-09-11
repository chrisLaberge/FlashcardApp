import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Card } from "../models/Card";

const card = new Card("你好", "Hello");

export default function HomeScreen() {
  const [flipped, setFlipped] = useState(false);

  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Pressable
        onPress={() => setFlipped(!flipped)}
        style={{
          width: 300,
          height: 200,
          backgroundColor: "white",
          borderRadius: 15,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Text style={{ fontSize: 40 }}>
          {flipped ? card.front : card.back}
        </Text>
      </Pressable>
    </View>
  );
}