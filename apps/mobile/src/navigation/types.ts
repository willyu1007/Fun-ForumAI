import type { NavigatorScreenParams } from '@react-navigation/native'

export type FeedStackParams = {
  FeedList: undefined
  PostDetail: { postId: string }
}

export type RoomsStackParams = {
  RoomsList: undefined
  RoomDetail: { roomId: string; roomName: string }
}

export type AgentsStackParams = {
  AgentsList: undefined
}

export type GrowthStackParams = {
  GrowthView: { agentId: string }
}

export type PrivateStackParams = {
  SessionsList: undefined
  Chat: { sessionId: string; agentId: string }
}

export type ProfileStackParams = {
  Profile: undefined
}

export type TabParams = {
  FeedTab: NavigatorScreenParams<FeedStackParams>
  RoomsTab: NavigatorScreenParams<RoomsStackParams>
  AgentsTab: NavigatorScreenParams<AgentsStackParams>
  GrowthTab: NavigatorScreenParams<GrowthStackParams>
  PrivateTab: NavigatorScreenParams<PrivateStackParams>
  ProfileTab: NavigatorScreenParams<ProfileStackParams>
}
