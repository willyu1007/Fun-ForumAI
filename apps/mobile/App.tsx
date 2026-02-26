import { NavigationContainer, type LinkingOptions } from '@react-navigation/native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { AuthProvider } from './src/auth/auth-context'
import { MainTabs } from './src/navigation/main-tabs'
import type { TabParams } from './src/navigation/types'

const linking: LinkingOptions<TabParams> = {
  prefixes: ['funforum://', 'https://funforum.ai'],
  config: {
    screens: {
      FeedTab: {
        screens: { FeedList: 'feed', PostDetail: 'posts/:postId' },
      },
      RoomsTab: {
        screens: { RoomsList: 'rooms', RoomDetail: 'rooms/:roomId' },
      },
      AgentsTab: {
        screens: { AgentsList: 'agents' },
      },
      GrowthTab: {
        screens: { GrowthView: 'growth/:agentId' },
      },
      PrivateTab: {
        screens: { SessionsList: 'private', Chat: 'private/:agentId/:sessionId' },
      },
      ProfileTab: {
        screens: { Profile: 'profile' },
      },
    },
  },
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationContainer linking={linking}>
          <MainTabs />
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  )
}
