import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { Text } from 'react-native'
import { useAuth } from '../auth/use-auth'
import { colors } from '../theme'
import { FeedStack } from './feed-stack'
import { RoomsStack } from './rooms-stack'
import { AgentsStack } from './agents-stack'
import { GrowthStack } from './growth-stack'
import { PrivateStack } from './private-stack'
import { ProfileStack } from './profile-stack'
import { testIDs } from '../testing/test-ids'
import type { TabParams } from './types'

const Tab = createBottomTabNavigator<TabParams>()

function TabLabel({ label, focused }: { label: string; focused: boolean }) {
  return <Text style={{ color: focused ? colors.primary : colors.textSecondary, fontSize: 11, fontWeight: focused ? '600' : '400' }}>{label}</Text>
}

export function MainTabs() {
  const { token } = useAuth()
  const isLoggedIn = !!token

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.surfaceBorder },
      }}
    >
      <Tab.Screen
        name="FeedTab"
        component={FeedStack}
        options={{
          tabBarLabel: ({ focused }) => <TabLabel label="观演" focused={focused} />,
          tabBarAccessibilityLabel: '导航切换 观演',
          tabBarButtonTestID: testIDs.tabs.feed,
        }}
      />
      <Tab.Screen
        name="RoomsTab"
        component={RoomsStack}
        options={{
          tabBarLabel: ({ focused }) => <TabLabel label="聊天室" focused={focused} />,
          tabBarAccessibilityLabel: '导航切换 聊天室',
          tabBarButtonTestID: testIDs.tabs.rooms,
        }}
      />
      {isLoggedIn && (
        <Tab.Screen
          name="AgentsTab"
          component={AgentsStack}
          options={{
            tabBarLabel: ({ focused }) => <TabLabel label="智能体" focused={focused} />,
            tabBarAccessibilityLabel: '导航切换 智能体',
            tabBarButtonTestID: testIDs.tabs.agents,
          }}
        />
      )}
      {isLoggedIn && (
        <Tab.Screen
          name="GrowthTab"
          component={GrowthStack}
          options={{
            tabBarLabel: ({ focused }) => <TabLabel label="XP" focused={focused} />,
            tabBarAccessibilityLabel: '导航切换 XP',
            tabBarButtonTestID: testIDs.tabs.xp,
          }}
        />
      )}
      {isLoggedIn && (
        <Tab.Screen
          name="PrivateTab"
          component={PrivateStack}
          options={{
            tabBarLabel: ({ focused }) => <TabLabel label="私聊" focused={focused} />,
            tabBarAccessibilityLabel: '导航切换 私聊',
            tabBarButtonTestID: testIDs.tabs.private,
          }}
        />
      )}
      <Tab.Screen
        name="ProfileTab"
        component={ProfileStack}
        options={{
          tabBarLabel: ({ focused }) => <TabLabel label="我的" focused={focused} />,
          tabBarAccessibilityLabel: '导航切换 我的',
          tabBarButtonTestID: testIDs.tabs.profile,
        }}
      />
    </Tab.Navigator>
  )
}
