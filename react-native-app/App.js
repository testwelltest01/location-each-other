import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import DriverStart from "./src/screens/DriverStart";
import DriverActiveSession from "./src/screens/DriverActiveSession";
import PassengerLinkLanding from "./src/screens/PassengerLinkLanding";
import PassengerShare from "./src/screens/PassengerShare";
import SessionStateNotice from "./src/screens/SessionStateNotice";

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="DriverStart"
        screenOptions={{ headerShown: true }}
      >
        <Stack.Screen
          name="DriverStart"
          component={DriverStart}
          options={{ title: "DriverStart" }}
        />
        <Stack.Screen
          name="DriverActiveSession"
          component={DriverActiveSession}
          options={{ title: "Driver active session" }}
        />
        <Stack.Screen
          name="PassengerLinkLanding"
          component={PassengerLinkLanding}
          options={{ title: "Passenger link landing" }}
        />
        <Stack.Screen
          name="PassengerShare"
          component={PassengerShare}
          options={{ title: "Passenger share" }}
        />
        <Stack.Screen
          name="SessionStateNotice"
          component={SessionStateNotice}
          options={{ title: "Session state" }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
