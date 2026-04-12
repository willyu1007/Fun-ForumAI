import { testIDs } from '../../testing/test-ids'

const mockChatroomHoldEnabled = jest.fn<boolean, []>()

jest.mock('@react-navigation/native-stack', () => ({
  createNativeStackNavigator: jest.fn(() => ({
    Navigator: 'Navigator',
    Screen: 'Screen',
  })),
}))

jest.mock('@react-navigation/native', () => ({
  useIsFocused: jest.fn(() => false),
}))

jest.mock('react-native', () => ({
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  Text: 'Text',
  View: 'View',
}))

jest.mock('@fun-forum/ui-mobile/theme', () => ({
  colors: {
    primary: '#000',
    surfaceElevated: '#111',
    border: '#222',
    surface: '#333',
  },
  radius: {
    md: 12,
    sm: 8,
  },
  spacing: {
    2: 8,
    3: 12,
    4: 16,
  },
  typography: {
    size: {
      caption: 12,
    },
  },
}), { virtual: true })

jest.mock('../../api/client', () => ({
  apiGet: jest.fn(),
}))

jest.mock('../../realtime/sse', () => ({
  openSseStream: jest.fn(),
}))

jest.mock('../../events', () => ({
  isRoomEvent: jest.fn(),
}))

jest.mock('../../components/shared-styles', () => ({
  shared: {
    card: {},
    metaText: {},
    cardTitle: {},
    secondaryButton: {},
    disabled: {},
    emptyText: {},
    listRow: {},
    itemText: {},
    messageRow: {},
  },
}))

jest.mock('../../config/mobile-flags', () => ({
  isMobileChatroomStagingHoldEnabled: () => mockChatroomHoldEnabled(),
}))

import { RoomsStack } from '../rooms-stack'

function getScreenElements() {
  const element = RoomsStack()
  const children = element.props.children
  return Array.isArray(children) ? children : [children]
}

describe('RoomsStack', () => {
  beforeEach(() => {
    mockChatroomHoldEnabled.mockReset()
  })

  it('uses live room screens when the hold flag is disabled', () => {
    mockChatroomHoldEnabled.mockReturnValue(false)

    const screens = getScreenElements()

    expect(screens[0].props.component.name).toBe('RoomsListLiveScreen')
    expect(screens[1].props.component.name).toBe('RoomDetailLiveScreen')
  })

  it('uses the hold screen when the hold flag is enabled', () => {
    mockChatroomHoldEnabled.mockReturnValue(true)

    const screens = getScreenElements()
    const holdElement = screens[0].props.component()

    expect(screens[0].props.component.name).toBe('ChatroomHoldScreen')
    expect(screens[1].props.component.name).toBe('ChatroomHoldScreen')
    expect(holdElement.props.testID).toBe(testIDs.rooms.holdScreen)
  })
})
