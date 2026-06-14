import { Stack } from 'expo-router'
import { LogBox } from 'react-native'

LogBox.ignoreLogs(['Text strings must be rendered'])

export default function RootLayout() {
  return <Stack screenOptions={{ headerShown: false }} />
}