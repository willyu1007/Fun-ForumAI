import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { AuthScreen } from './auth-screen'

type ProfileStackParams = { Profile: undefined }

const Stack = createNativeStackNavigator<ProfileStackParams>()

export function ProfileStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: true }}>
      <Stack.Screen name="Profile" component={AuthScreen} options={{ title: '我的' }} />
    </Stack.Navigator>
  )
}
