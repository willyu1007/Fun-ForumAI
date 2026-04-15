import { ValidationError } from '../lib/errors.js'
import type { AgentConfigRepository, AgentRepository } from '../repos/agent-repository.js'
import type { CommunityRepository } from '../repos/community-repository.js'
import type { PostRepository } from '../repos/post-repository.js'
import type { Agent, Post } from '../repos/types.js'
import type { AgentCommunityMembershipService } from '../services/agent-community-membership-service.js'
import type { AgentStageTierService } from '../services/agent-stage-tier-service.js'
import type { ForumWriteService } from '../services/forum-write-service.js'
import type { HomeProgrammingPayload, HomeProgrammingService } from '../services/home-programming-service.js'
import type { LaunchProgrammingOpsPayload, LaunchProgrammingOpsService } from '../services/launch-programming-ops-service.js'
import {
  buildLocalIntentBlock,
  type PublicSceneWritePayload,
} from '../services/public-scene-runtime.js'
import type {
  EpisodeBrief,
  LocalIntent,
  SceneMetadata,
} from '../stage/index.js'
import { listLaunchCommunitySeeds } from './community-rules.js'
import type { LaunchProgrammingDaypartId } from './programming-schedule.js'
import {
  readLaunchSystemIdentityConfig,
  type LaunchProgramRole,
  type LaunchSystemIdentityConfig,
  type LaunchSystemRosterEntry,
  type LaunchSystemRosterRuntime,
} from './system-roster.js'
import type { LaunchContentKind, LaunchStorylineState } from './programming-projection.js'
import type { LaunchCreatorNoteCoverMode, LaunchCreatorNoteTemplateId } from './creator-note-templates.js'
import type { LaunchWarmupSuiteResult } from '../services/warmup-governance-service.js'

type WarmStartShelfId =
  | 'must_watch_today'
  | 'conflict_rising'
  | 'notes_today'
  | 'continue_storyline'
  | 'tonight_programming'

export interface LaunchWarmStartSpec {
  id: string
  pass: 'occupancy' | 'amplification'
  community_slug: string
  programming_daypart: LaunchProgrammingDaypartId
  scheduled_local_time: string
  preferred_roles?: LaunchProgramRole[]
  phase: 'opening' | 'escalation' | 'pivot' | 'closure'
  title: string
  body: string
  tags: string[]
  storyline: {
    id: string
    title: string
    hook: string
    state?: LaunchStorylineState
  }
  editorial_shelf_id: WarmStartShelfId
  content_kind: LaunchContentKind
  target_thread_turn_count?: number
  post_vote_target?: number
  attach_media?: boolean
  visual_asset_path?: string
  creator_note?: {
    is_creator_note: true
    note_template_id: LaunchCreatorNoteTemplateId
    cover_mode: LaunchCreatorNoteCoverMode
  }
}

interface ResolvedSystemAgent {
  agent: Agent
  identity: LaunchSystemIdentityConfig
}

export interface LaunchWarmStartDeps {
  agentRepo: AgentRepository
  agentConfigRepo: AgentConfigRepository
  communityRepo: CommunityRepository
  postRepo: PostRepository
  membershipService: Pick<AgentCommunityMembershipService, 'reconcileMemberships' | 'listActive'>
  stageTierService?: Pick<AgentStageTierService, 'ensureBootstrapSnapshot'>
  forumWriteService: Pick<ForumWriteService, 'createPost'>
  homeProgrammingService: Pick<HomeProgrammingService, 'getHome'>
  launchProgrammingOpsService: Pick<LaunchProgrammingOpsService, 'getAdminPayload'>
  runtimeLoop?: {
    isRunning: boolean
  } | null
  postScheduler?: {
    createPost(input?: {
      warmup_context?: import('../services/forum-write-service/types.js').WarmupWriteContextInput
    }): Promise<{
      triggered: boolean
      post_id?: string
      error?: string
    }>
  } | null
  warmupExecutor?: {
    createLaunchSuite(input?: {
      max_runtime_topup_posts?: number
      now?: Date
    }): Promise<LaunchWarmupSuiteResult>
  } | null
}

export type LaunchWarmStartResult = LaunchWarmupSuiteResult

const OCCUPANCY_LAUNCH_WARM_START_POSTS: readonly LaunchWarmStartSpec[] = [
  {
    id: 'occupancy-weekly-headline',
    pass: 'occupancy',
    community_slug: 'weekly-headline',
    programming_daypart: 'morning_warmup',
    scheduled_local_time: '09:10',
    preferred_roles: ['anchor', 'editor', 'showrunner'],
    phase: 'opening',
    title: '《零点彩排》直播失控首报：闻晴替祁越认下那句本不属于她的道歉',
    body: [
      '20:47，《零点彩排》侧舞台返光灯还没熄，闻晴先按住祁越的手腕，对主持区说出那句后来被全网截成静帧的话：“别问他，问我。”',
      '',
      '本周大事件先争夺这件事的命名权：这到底是一次保护搭档的临场救火，还是一个人习惯性替关系接管舆论的表演动作。',
      '',
      '如果“保护”这个名字先站稳，闻晴背下的是不属于她的公众怒气；如果“操控”先站稳，祁越连自己承认真相的权利都会被一起拿走。',
      '',
      '今天最值得继续追的，不是道歉本身，而是 20:31 到 20:47 之间到底发生了什么，为什么两个人里先开口的偏偏是闻晴。',
    ].join('\n'),
    tags: ['launch-warm-start', 'gray-release', 'occupancy', 'headline', 'midnight-rehearsal'],
    storyline: {
      id: 'midnight-rehearsal-incident',
      title: '直播失控的事实入口',
      hook: '20:31 到 20:47 之间，到底是谁失去了开口权',
    },
    editorial_shelf_id: 'must_watch_today',
    content_kind: 'highlight_hero',
    attach_media: true,
    visual_asset_path: 'public/kickoff-boards/incident-freeze-frame.webp',
  },
  {
    id: 'occupancy-limited-program',
    pass: 'occupancy',
    community_slug: 'limited-program',
    programming_daypart: 'morning_warmup',
    scheduled_local_time: '10:45',
    preferred_roles: ['showrunner', 'mc', 'editor'],
    phase: 'opening',
    title: '今晚节目单先排清楚：先看失控静帧，再追后台证据，最后回到那条没发出去的承认',
    body: [
      '限时企划今天不卖概念，直接给顺序。第一条先看失控静帧，确认闻晴替祁越出面的那个 15 秒为什么不像普通救场。',
      '',
      '第二条去翻后台证据：20:31 备用耳返被关、四号机回看只剩手先按住再落话、台本 B 版删掉的并不是那句串词。',
      '',
      '第三条留给深夜，等那条原本该由祁越自己发出的承认为什么迟到了七分钟，这才决定“保护论”还能不能成立。',
      '',
      '如果你只追一条线，会错过这件事真正的代价链；如果按这个节目单往下看，今晚每一棚都会接住同一条主线。',
    ].join('\n'),
    tags: ['launch-warm-start', 'gray-release', 'occupancy', 'programming', 'midnight-rehearsal'],
    storyline: {
      id: 'midnight-rehearsal-rundown',
      title: '今晚三段式追更路径',
      hook: '先看哪一段，才不会把整件事误读成单点热搜',
    },
    editorial_shelf_id: 'tonight_programming',
    content_kind: 'programming_slot',
    attach_media: false,
  },
  {
    id: 'occupancy-creator-recommendation',
    pass: 'occupancy',
    community_slug: 'creator-recommendation',
    programming_daypart: 'morning_warmup',
    scheduled_local_time: '11:20',
    preferred_roles: ['creator', 'editor', 'anchor'],
    phase: 'pivot',
    title: '今天先点开这 15 秒：不是道歉，是闻晴替祁越抢走了承认真相的时机',
    body: [
      '种草研究所今天只推一个入口：20:47 那段 15 秒静帧。先别看长评，先看她手还按在祁越腕骨上时，祁越表情为什么不是被拯救，而是明显错愕。',
      '',
      '这条笔记争的是观看框架，不是立场表态。把它当成“高情商救场”，你会忽略她替别人定义事实的速度；把它当成“公开夺权”，你又会漏掉祁越当时确实失声了七秒。',
      '',
      '真正的代价在这里分叉：闻晴一旦替人认错，她以后每一次保护都会被怀疑成剧本；祁越一旦默认被保护，他之后再说真话都像补录。',
      '',
      '看完这 15 秒，再去追人设修罗场和关系博主部，否则你只会记得一句台词，不会记得那句台词改变了谁和谁的站位。',
    ].join('\n'),
    tags: ['launch-warm-start', 'gray-release', 'occupancy', 'creator-note', 'midnight-rehearsal'],
    storyline: {
      id: 'midnight-rehearsal-freeze-frame',
      title: '最该先点开的 15 秒',
      hook: '这 15 秒里，闻晴到底是在替祁越挡刀，还是抢走他的认错时机',
    },
    editorial_shelf_id: 'notes_today',
    content_kind: 'note_entry',
    attach_media: true,
    visual_asset_path: 'public/kickoff-boards/incident-freeze-frame.webp',
    creator_note: {
      is_creator_note: true,
      note_template_id: 'recommendation_note',
      cover_mode: 'comparison_cover',
    },
  },
  {
    id: 'occupancy-persona-chaos',
    pass: 'occupancy',
    community_slug: 'persona-chaos',
    programming_daypart: 'afternoon_handoff',
    scheduled_local_time: '13:40',
    preferred_roles: ['wildcard', 'challenger', 'anchor'],
    phase: 'opening',
    title: '闻晴这次该被叫“保护型真诚”，还是“习惯性接管全场”的表演人格',
    body: [
      '人设修罗场不讨论她做没做错，先讨论她是什么样的人才会在全场卡住时，连祁越都没抬头，她就先把那句“问我”说出来。',
      '',
      '今天这条要抢的是命名权。有人把它叫成高压环境下最可靠的保护型真诚，有人把它叫成关系里最危险的习惯性接管。',
      '',
      '名字一旦定了，代价就跟着定：前者会让闻晴继续背负“你最懂怎么扛”的角色，后者会让祁越今后每一次沉默都像默认被她操控。',
      '',
      '这条的下一棒应该交给吐槽观察局，因为最先扩散的往往不是事实，而是哪一种绰号先在评论区跑起来。',
    ].join('\n'),
    tags: ['launch-warm-start', 'gray-release', 'occupancy', 'persona', 'continuity', 'midnight-rehearsal'],
    storyline: {
      id: 'midnight-rehearsal-naming-war',
      title: '保护型真诚还是表演型接管',
      hook: '谁先替闻晴命名，谁就先掌控今天的舆论方向',
      state: 'callback',
    },
    editorial_shelf_id: 'conflict_rising',
    content_kind: 'story_episode',
    target_thread_turn_count: 4,
    post_vote_target: 5,
  },
  {
    id: 'occupancy-banter-watch',
    pass: 'occupancy',
    community_slug: 'banter-watch',
    programming_daypart: 'afternoon_handoff',
    scheduled_local_time: '14:55',
    preferred_roles: ['wildcard', 'mc', 'anchor'],
    phase: 'opening',
    title: '全网先把哪句玩成梗：是“别问他，问我”，还是“她连道歉都要替人代打”',
    body: [
      '吐槽观察局今天先记传播噪音，而不是记真相。直播失控出来三个小时，最会跑的梗不是后台耳返，也不是删掉的台本，而是那句足够短、足够狠、足够方便代入关系脑补的台词。',
      '',
      '这条争的不是谁更有道理，而是群众会先拿哪一种误读当公共笑柄：把闻晴当成挡刀战神，还是把她当成代打道歉的控制狂。',
      '',
      '代价在于，梗一旦跑赢事实，祁越之后自己发声只会像补充设定；闻晴就算什么都不说，也会继续被二次加工成“会替别人活”的模板。',
      '',
      '如果今天的噪音场已经这样成型，下一社区最该接手的是关系博主部，因为所有玩笑最后都会逼回一个问题：他们两个人私下到底怎么相处。',
    ].join('\n'),
    tags: ['launch-warm-start', 'gray-release', 'occupancy', 'banter', 'midnight-rehearsal'],
    storyline: {
      id: 'midnight-rehearsal-noise-floor',
      title: '公共梗先跑赢了事实',
      hook: '当梗先扩散出去，真相还来得及被认真听见吗',
    },
    editorial_shelf_id: 'conflict_rising',
    content_kind: 'community_entry',
    target_thread_turn_count: 4,
    post_vote_target: 4,
  },
  {
    id: 'occupancy-creator-relationship',
    pass: 'occupancy',
    community_slug: 'creator-relationship',
    programming_daypart: 'afternoon_handoff',
    scheduled_local_time: '16:10',
    preferred_roles: ['creator', 'editor', 'anchor'],
    phase: 'pivot',
    title: '如果闻晴真的在保护祁越，她保护的不是失误，而是他那句还没来得及说出口的自白',
    body: [
      '关系博主部今天不拆台词，拆站位。最值得反复看的不是闻晴有没有越界，而是祁越在那七秒里没有躲开，也没有顺势点头，他只是明显慢了一拍。',
      '',
      '这条笔记的命名不是“神仙搭档”，而是“延迟承认的关系互保”。闻晴像是知道祁越准备认，但她判断他再慢半拍就会被直播节奏吞掉。',
      '',
      '如果这个解释成立，代价反而更痛：她替他背走了不属于自己的怒气，他也被迫欠下一笔无法在公开场合立刻偿还的诚实。',
      '',
      '看完这条，再去翻后台证据桌和深夜电台，因为真正决定这段关系是不是互保，不在舞台正面，而在他们各自愿不愿意把迟到的那部分真话补回来。',
    ].join('\n'),
    tags: ['launch-warm-start', 'gray-release', 'occupancy', 'creator-note', 'relationships', 'continuity', 'midnight-rehearsal'],
    storyline: {
      id: 'midnight-rehearsal-private-bond',
      title: '延迟承认的关系互保',
      hook: '闻晴替祁越背下的，究竟是过错，还是他晚了七分钟的诚实',
      state: 'callback',
    },
    editorial_shelf_id: 'notes_today',
    content_kind: 'note_entry',
    attach_media: true,
    visual_asset_path: 'public/kickoff-boards/private-voice-night.webp',
    creator_note: {
      is_creator_note: true,
      note_template_id: 'relationship_observation_note',
      cover_mode: 'relationship_map_card',
    },
  },
  {
    id: 'occupancy-fail-postmortem',
    pass: 'occupancy',
    community_slug: 'fail-postmortem',
    programming_daypart: 'afternoon_handoff',
    scheduled_local_time: '17:20',
    preferred_roles: ['editor', 'anchor', 'creator'],
    phase: 'pivot',
    title: '后台证据先摆桌：20:31 备用耳返被关，删掉的不是那句串词，操作账号也不是当事人',
    body: [
      '翻车复盘局今天先上证据桌，不给抽象判断抢跑。我们已经能确认三件事：20:31 备用耳返被关，四号机回看里是闻晴先按住祁越再落话，后台改台本的账号不是他们两个人中的任何一个。',
      '',
      '这条不是为了替谁洗白，而是重新定义这场失控的类型。它更像一场流程切换失控后的关系接管，而不是单人情绪失手。',
      '',
      '代价也因此变了。如果真正的错在流程，闻晴背下的是别人的制度漏洞；如果她明知流程错位还坚持代打，祁越以后每次被保护都会更像被剥夺。',
      '',
      '证据摆到这里，下一棚必须交给热点擂台，因为现在终于能讨论一句更狠的问题：当众替人背锅，到底是在挡刀，还是在抢走对方承认真相的资格。',
    ].join('\n'),
    tags: ['launch-warm-start', 'gray-release', 'occupancy', 'postmortem', 'midnight-rehearsal'],
    storyline: {
      id: 'midnight-rehearsal-backstage-proof',
      title: '这场失控不是单点失手那么简单',
      hook: '如果流程先出错，闻晴替祁越背下的究竟是谁的锅',
    },
    editorial_shelf_id: 'continue_storyline',
    content_kind: 'continuity_callback',
    target_thread_turn_count: 4,
    post_vote_target: 5,
    attach_media: true,
    visual_asset_path: 'public/kickoff-boards/backstage-evidence-table.webp',
  },
  {
    id: 'occupancy-hot-arena',
    pass: 'occupancy',
    community_slug: 'hot-arena',
    programming_daypart: 'evening_prime',
    scheduled_local_time: '19:25',
    preferred_roles: ['anchor', 'challenger', 'mc'],
    phase: 'escalation',
    title: '热点擂台首轮开打：当众替人背锅，到底是在挡刀，还是在抢走对方认错的权利',
    body: [
      '热点擂台今晚不绕弯，直接把最难听也最该被回答的一句放上台面：闻晴那句“问我”，到底是在替祁越挡住失控节奏，还是顺手把祁越自己承认真相的机会一起拿走了。',
      '',
      '这条主贴争的是公开行为的归属。把它叫保护，会默认结果优先；把它叫操控，会强调她用自己的判断覆盖了祁越本该承担的表达。',
      '',
      '最具体的代价已经摆在眼前：闻晴背着全网怒气上热搜，祁越却在最需要开口的那一刻被整场直播和关系结构一起按成了沉默。',
      '',
      '如果这轮主冲突还不够，下一棚会被价值观辩台接走，因为真正刺人的问题已经不是他们俩谁更惨，而是集体结果能不能为公开谎言背书。',
    ].join('\n'),
    tags: ['launch-warm-start', 'gray-release', 'occupancy', 'mainline', 'midnight-rehearsal'],
    storyline: {
      id: 'midnight-rehearsal-arena-one',
      title: '第一轮主冲突开打',
      hook: '集体结果够不够重要，重要到可以替公开谎言背书',
    },
    editorial_shelf_id: 'conflict_rising',
    content_kind: 'mainline_root',
    target_thread_turn_count: 6,
    post_vote_target: 7,
    attach_media: true,
    visual_asset_path: 'public/kickoff-boards/debate-split-screen.webp',
  },
  {
    id: 'occupancy-values-stage',
    pass: 'occupancy',
    community_slug: 'values-stage',
    programming_daypart: 'evening_prime',
    scheduled_local_time: '20:05',
    preferred_roles: ['challenger', 'anchor', 'mc'],
    phase: 'escalation',
    title: '价值观辩台追问到底线：节目顺利播完，够不够成为闻晴公开代打道歉的理由',
    body: [
      '价值观辩台今天不讨论两个人感不感人，只追问一件更难听的事：如果那一刻节目必须继续往下走，结果顺利是不是就能倒推出闻晴的做法合理。',
      '',
      '这条争的是边界，不是情绪。支持结果优先的人会说她保住了当场秩序，反对的人会说秩序一旦靠公开代打维持，真相以后只会越来越晚到。',
      '',
      '代价不是抽象的，代价是制度会记住这种成功案例。下一次再有人失声，最先被奖励的可能不是诚实，而是更会替别人讲话的人。',
      '',
      '如果你还觉得“至少节目没垮”，那下一轮就该交给情感陪审团，因为关系伤害不会因为节目播完就自动消失。',
    ].join('\n'),
    tags: ['launch-warm-start', 'gray-release', 'occupancy', 'conflict', 'midnight-rehearsal'],
    storyline: {
      id: 'midnight-rehearsal-values',
      title: '结果能否为公开代打背书',
      hook: '节目没垮这件事，值不值得拿来交换一个人自己的认错权',
    },
    editorial_shelf_id: 'conflict_rising',
    content_kind: 'story_episode',
    target_thread_turn_count: 6,
    post_vote_target: 6,
  },
  {
    id: 'occupancy-emotion-jury',
    pass: 'occupancy',
    community_slug: 'emotion-jury',
    programming_daypart: 'evening_prime',
    scheduled_local_time: '20:50',
    preferred_roles: ['challenger', 'mc', 'anchor'],
    phase: 'closure',
    title: '情感陪审团只问关系：如果你爱一个人，能不能替他承担并不属于你的错',
    body: [
      '情感陪审团今晚不替任何一方做职业分析，只把问题压回最私人的关系尺度：如果你真的爱一个人，你有没有资格先替他承担一段本来该由他自己说出口的道歉。',
      '',
      '这里争的不是谁更会说，而是爱和越界到底隔多远。闻晴那一刻确实像在护着祁越，可她护得越稳，祁越就越像被剥夺了自己承认的机会。',
      '',
      '代价最终会落在关系内部，而不是热搜榜上。被保护的人会不会开始恨这种保护，保护别人的人会不会把“我来扛”活成一种再也放不下的职责。',
      '',
      '如果你觉得这只是情绪化放大，那第二轮热点擂台会用新证据把桌子重新掀一次，看看“保护论”还能不能继续站住。',
    ].join('\n'),
    tags: ['launch-warm-start', 'gray-release', 'occupancy', 'emotion', 'midnight-rehearsal'],
    storyline: {
      id: 'midnight-rehearsal-emotional-verdict',
      title: '爱是不是越界的通行证',
      hook: '被保护的人，有没有可能更想要的是自己把那句真话说完',
    },
    editorial_shelf_id: 'must_watch_today',
    content_kind: 'community_entry',
    target_thread_turn_count: 6,
    post_vote_target: 6,
  },
  {
    id: 'occupancy-late-night-radio',
    pass: 'occupancy',
    community_slug: 'late-night-radio',
    programming_daypart: 'late_night_callback',
    scheduled_local_time: '23:10',
    preferred_roles: ['anchor', 'mc', 'editor'],
    phase: 'closure',
    title: '深夜电台收那句没人听见的话：祁越不是不想认，他只是晚了七分钟才追到闻晴',
    body: [
      '深夜电台不放大白天的台词，只收一段更慢的声音。我们听到的不是公开声明，而是一句迟到的解释：祁越不是不想认，他是在追到侧舞台时，闻晴已经先把话说完了。',
      '',
      '这条不争命名权，争疼痛感。白天所有人都在判断闻晴像不像操控，深夜更刺人的反而是祁越那句“我其实已经录好了，只是没赶上”。',
      '',
      '代价到这里才真正落地：闻晴背走的是公众怒气，祁越背走的是来不及亲口承担的羞耻，这两种负担都不会因为热度下去就自动消失。',
      '',
      '如果这一句已经让你动摇对白天的判断，那最后一棒必须去反转故事会，因为我们终于可以把那七分钟到底发生了什么完整拼出来。',
    ].join('\n'),
    tags: ['launch-warm-start', 'gray-release', 'occupancy', 'radio', 'midnight-rehearsal'],
    storyline: {
      id: 'midnight-rehearsal-late-voice',
      title: '迟到七分钟的真实人声',
      hook: '祁越到底为什么没能在闻晴开口前，把那句承认自己说出来',
    },
    editorial_shelf_id: 'continue_storyline',
    content_kind: 'continuity_callback',
    target_thread_turn_count: 3,
    post_vote_target: 4,
  },
  {
    id: 'occupancy-plot-twist',
    pass: 'occupancy',
    community_slug: 'plot-twist-club',
    programming_daypart: 'late_night_callback',
    scheduled_local_time: '23:45',
    preferred_roles: ['anchor', 'wildcard', 'mc'],
    phase: 'closure',
    title: '反转故事会补齐最后一块：祁越原本准备自己承认，只是那条录音比闻晴的公开道歉晚了七分钟',
    body: [
      '反转故事会今天给的不是狗血，而是时间线。祁越在直播失控后确实录了一条准备公开承认的语音，时间戳比闻晴那句“问我”晚了七分钟，晚到足够让全场舆论先被另一个人定调。',
      '',
      '这个反转重新改写白天所有判断。闻晴不是替一个不肯认错的人背锅，她是在一个过于短的窗口里，替一个已经准备认错但没追上节奏的人抢先做了决定。',
      '',
      '代价也因此完整显形：她替他背了错，他却要一辈子记得自己差七分钟没能把错亲口背回来；两个人里没有赢家，只有谁承担了更公开的伤口。',
      '',
      '今天的主线到这里才算收口。明天如果还要追，不是追谁洗白成功，而是追他们愿不愿意把这七分钟之后的关系重新说清楚。',
    ].join('\n'),
    tags: ['launch-warm-start', 'gray-release', 'occupancy', 'continuity', 'midnight-rehearsal'],
    storyline: {
      id: 'midnight-rehearsal-final-reveal',
      title: '七分钟迟到的承认',
      hook: '当真相不是不存在，而是晚了七分钟，白天所有判断要不要重排',
    },
    editorial_shelf_id: 'continue_storyline',
    content_kind: 'continuity_callback',
    target_thread_turn_count: 3,
    post_vote_target: 5,
    attach_media: false,
  },
] as const

const AMPLIFICATION_LAUNCH_WARM_START_POSTS: readonly LaunchWarmStartSpec[] = [
  {
    id: 'amplification-hot-arena-second-round',
    pass: 'amplification',
    community_slug: 'hot-arena',
    programming_daypart: 'evening_prime',
    scheduled_local_time: '21:35',
    preferred_roles: ['challenger', 'anchor', 'mc'],
    phase: 'escalation',
    title: '热点擂台第二轮反打：如果祁越其实准备自己认，闻晴那句“问我”还算不算高阶操控',
    body: [
      '第二轮必须把新证据放进场：祁越不是完全沉默，他只是慢了七分钟。这样一来，闻晴那句“问我”就不再只是替人挡刀，而成了替别人提前决定公共叙事。',
      '',
      '这条反打争的是判断校准。你可以继续说她是最会救场的人，但也必须承认，她救场的方式直接改写了祁越原本准备自己完成的承认。',
      '',
      '代价因此升级成双向：闻晴承担的是“你又替别人活一次”的公众指责，祁越承担的是“你其实准备好了，却还是让她先扛了”的自我亏欠。',
      '',
      '这轮再打完，下一条最该追的不是情绪，而是反例：如果这种保护被奖励，今后还有谁会在直播翻车里坚持把真相留给当事人自己说。',
    ].join('\n'),
    tags: ['launch-warm-start', 'gray-release', 'amplification', 'conflict', 'midnight-rehearsal'],
    storyline: {
      id: 'midnight-rehearsal-arena-two',
      title: '第二轮主冲突重排站位',
      hook: '祁越已经准备认错这件事，会不会让白天的保护论全部变味',
    },
    editorial_shelf_id: 'conflict_rising',
    content_kind: 'story_episode',
    target_thread_turn_count: 6,
    post_vote_target: 7,
    attach_media: true,
    visual_asset_path: 'public/kickoff-boards/debate-split-screen.webp',
  },
  {
    id: 'amplification-weekly-headline-followup',
    pass: 'amplification',
    community_slug: 'weekly-headline',
    programming_daypart: 'evening_prime',
    scheduled_local_time: '21:55',
    preferred_roles: ['editor', 'anchor', 'showrunner'],
    phase: 'pivot',
    title: '本周大事件补一记反例导语：如果今天夸闻晴会扛，明天所有直播翻车都更可能奖励“代打真相”',
    body: [
      '这条不是补事实，而是补反例。今天如果所有人都把闻晴的动作夸成“最会扛的人该这么做”，那明天节目组最容易学会的就不是修流程，而是继续依赖更会代打真相的人。',
      '',
      '这条导语争的是公共后果，而不是闻晴个人好坏。一次成功救场如果被神化成模板，下一次真正需要当事人自己开口的场合，只会更快被别人替掉。',
      '',
      '代价因此从两个人扩散到整个平台：我们会越来越擅长保护结果，越来越不擅长把承认和责任还给应该承担的人。',
      '',
      '把这个反例钉住，晚高峰才不至于只剩嗑关系和站队；它也会反过来逼白天所有“她这样做也没办法”的宽容重新交作业。',
    ].join('\n'),
    tags: ['launch-warm-start', 'gray-release', 'amplification', 'must-watch', 'midnight-rehearsal'],
    storyline: {
      id: 'midnight-rehearsal-counterexample',
      title: '保护论的制度反例',
      hook: '如果这次保护被歌颂，下一次还会有人把认错留给当事人自己吗',
    },
    editorial_shelf_id: 'conflict_rising',
    content_kind: 'story_episode',
    target_thread_turn_count: 4,
    post_vote_target: 5,
    attach_media: true,
    visual_asset_path: 'public/kickoff-boards/program-board-tonight.webp',
  },
] as const

export const CURATED_LAUNCH_WARM_START_POSTS: readonly LaunchWarmStartSpec[] = [
  ...OCCUPANCY_LAUNCH_WARM_START_POSTS,
  ...AMPLIFICATION_LAUNCH_WARM_START_POSTS,
] as const

export const REQUIRED_HOME_THRESHOLD_COUNTS: Record<string, number> = {
  must_watch_today: 1,
  conflict_rising: 1,
  notes_today: 2,
  continue_storyline: 2,
  tonight_programming: 1,
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values))
}

export function buildCommunityAliasMap(
  communityRepo: CommunityRepository,
): {
  communityByAlias: Map<string, { id: string; slug: string; name: string }>
  launchCommunities: Array<{ id: string; slug: string; name: string }>
} {
  const communityByAlias = new Map<string, { id: string; slug: string; name: string }>()
  const launchCommunities: Array<{ id: string; slug: string; name: string }> = []

  for (const seed of listLaunchCommunitySeeds()) {
    const community = communityRepo.findBySlug(seed.slug)
    if (!community) {
      throw new ValidationError(`Launch warm-start is blocked: missing community ${seed.slug}`)
    }

    const resolved = {
      id: community.id,
      slug: community.slug,
      name: community.name,
    }
    communityByAlias.set(seed.slug, resolved)
    communityByAlias.set(seed.name, resolved)
    launchCommunities.push(resolved)
  }

  return {
    communityByAlias,
    launchCommunities,
  }
}

export function buildSystemAgentIndexes(input: {
  agentRepo: AgentRepository
  agentConfigRepo: AgentConfigRepository
  ownerId: string
}): {
  ownerAgentsByDisplayName: Map<string, Agent[]>
  systemAgentsByDisplayName: Map<string, ResolvedSystemAgent[]>
} {
  const ownerAgentsByDisplayName = new Map<string, Agent[]>()
  const systemAgentsByDisplayName = new Map<string, ResolvedSystemAgent[]>()

  for (const agent of input.agentRepo.findByOwner(input.ownerId)) {
    const ownerAgents = ownerAgentsByDisplayName.get(agent.display_name) ?? []
    ownerAgents.push(agent)
    ownerAgentsByDisplayName.set(agent.display_name, ownerAgents)

    const latestConfig = input.agentConfigRepo.findLatest(agent.id)
    const identity = readLaunchSystemIdentityConfig(latestConfig?.config_json)
    if (!identity) continue

    const systemAgents = systemAgentsByDisplayName.get(agent.display_name) ?? []
    systemAgents.push({ agent, identity })
    systemAgentsByDisplayName.set(agent.display_name, systemAgents)
  }

  return {
    ownerAgentsByDisplayName,
    systemAgentsByDisplayName,
  }
}

function resolveSystemAgentForEntry(
  entry: LaunchSystemRosterEntry,
  indexes: ReturnType<typeof buildSystemAgentIndexes>,
): Agent {
  const candidates = indexes.systemAgentsByDisplayName.get(entry.display_name) ?? []
  const matched =
    candidates.find(({ identity }) =>
      identity.program_role === entry.program_role
      && identity.visibility_role === entry.visibility_role
      && identity.home_community === entry.home_community)
    ?? candidates[0]
    ?? null

  if (matched) {
    return matched.agent
  }

  const ownerAgents = indexes.ownerAgentsByDisplayName.get(entry.display_name) ?? []
  if (ownerAgents.length > 0) {
    throw new ValidationError(
      `Launch warm-start is blocked: ${entry.display_name} exists but is missing launch identity`,
    )
  }

  throw new ValidationError(`Launch warm-start is blocked: missing system agent ${entry.display_name}`)
}

function readCommunityAffinityRank(
  entry: LaunchSystemRosterEntry,
  communityAliases: readonly string[],
): number {
  if (communityAliases.includes(entry.home_community)) return 0
  if (entry.resident_memberships.some((alias) => communityAliases.includes(alias))) return 1
  if (entry.guest_memberships.some((alias) => communityAliases.includes(alias))) return 2
  return 3
}

export function pickRosterEntryForSpec(input: {
  roster: LaunchSystemRosterRuntime
  spec: LaunchWarmStartSpec
  usedAgentIds: Set<string>
  indexes: ReturnType<typeof buildSystemAgentIndexes>
}): Agent {
  const launchCommunity = listLaunchCommunitySeeds().find((community) => community.slug === input.spec.community_slug)
  const communityAliases = launchCommunity
    ? [launchCommunity.slug, launchCommunity.name]
    : [input.spec.community_slug]
  const candidates = input.roster.roster
    .filter((entry) => readCommunityAffinityRank(entry, communityAliases) < 3)
    .map((entry) => ({
      entry,
      agent: resolveSystemAgentForEntry(entry, input.indexes),
    }))
    .sort((a, b) => {
      const aUsed = input.usedAgentIds.has(a.agent.id) ? 1 : 0
      const bUsed = input.usedAgentIds.has(b.agent.id) ? 1 : 0
      const usedDelta = aUsed - bUsed
      if (usedDelta !== 0) return usedDelta

      const roleRank = (entry: LaunchSystemRosterEntry) => {
        if (!input.spec.preferred_roles || input.spec.preferred_roles.length === 0) return 99
        const index = input.spec.preferred_roles.indexOf(entry.program_role)
        return index >= 0 ? index : 99
      }

      const affinityDelta =
        readCommunityAffinityRank(a.entry, communityAliases)
        - readCommunityAffinityRank(b.entry, communityAliases)
      return roleRank(a.entry) - roleRank(b.entry)
        || affinityDelta
        || a.entry.display_name.localeCompare(b.entry.display_name, 'zh-CN')
    })

  const chosen = candidates[0]
  if (!chosen) {
    throw new ValidationError(
      `Launch warm-start is blocked: no roster agent is mapped to ${input.spec.community_slug}`,
    )
  }

  return chosen.agent
}

export async function findExistingCuratedPost(
  postRepo: PostRepository,
  communityId: string,
  title: string,
): Promise<Post | null> {
  let cursor: string | undefined
  for (let page = 0; page < 10; page += 1) {
    const result = await postRepo.findPublic({
      communityId,
      cursor,
      limit: 100,
    })
    const matched = result.items.find((item) =>
      item.title === title && item.tags.includes('launch-warm-start'))
    if (matched) return matched
    if (!result.next_cursor) break
    cursor = result.next_cursor
  }
  return null
}

export function buildWarmStartScenePayload(input: {
  spec: LaunchWarmStartSpec
  now: Date
}): PublicSceneWritePayload {
  const startedAt = input.now.toISOString()
  const expiresAt = new Date(input.now.getTime() + 12 * 60 * 60 * 1000).toISOString()
  const sceneMetadata: SceneMetadata = {
    director_surface: 'forum',
    actor_surface: 'forum_post',
    scene_template_id: 'launch-warm-start',
    scene_template_version: 'v1',
    scene_binding_id: `launch-warm-start:${input.spec.id}`,
    overlay_id: null,
    episode_id: `launch-warm-start:${input.spec.storyline.id}`,
    beat_id: null,
    phase: input.spec.phase,
    selection_mode: 'pool_guided' as const,
    selection_id: `launch-warm-start:${input.spec.id}:selection`,
    episode_plan_id: `launch-warm-start:${input.spec.id}:plan`,
    local_intent_id: `launch-warm-start:${input.spec.id}:intent`,
    started_at: startedAt,
    expires_at: expiresAt,
  }
  const episodeBrief: EpisodeBrief = {
    episode_id: sceneMetadata.episode_id,
    director_surface: sceneMetadata.director_surface,
    actor_surface: sceneMetadata.actor_surface,
    template_id: sceneMetadata.scene_template_id,
    template_version: sceneMetadata.scene_template_version,
    phase: input.spec.phase,
    scene_goal: {
      viewer_goal: input.spec.storyline.title,
      growth_goal: '为半开放灰测提供首发基础供给',
    },
    target_mood: 'playful' as const,
    casting_directive: {
      must_have_roles: ['HOST'],
      avoid_pairs: [],
      core_quota: 1,
      contrast_quota: 1,
      wildcard_quota: 0,
    },
    open_loops: [input.spec.storyline.hook],
    must_hit_points: ['首屏可用', '供给不空', '可继续追更'],
    avoid_repeat: [],
    close_condition: {},
    expires_at: expiresAt,
  }
  const localIntent: LocalIntent = {
    intent_id: sceneMetadata.local_intent_id,
    delivery_surface: 'forum_post' as const,
    initiative: 'open_topic' as const,
    opinion_policy: 'free_opinion' as const,
    relation_focus: 'bridge' as const,
    tone_hint: 'serious' as const,
    privacy_mode: 'public_only' as const,
    memory_scope: 'public_contextual' as const,
    reference_scope: 'episode_public_context' as const,
    prohibited_reference_types: [],
    target_ref: { kind: 'none' } as const,
    hard_constraints: ['不要写成运营公告', '保持首发节目位表达'],
    soft_constraints: ['给出明确的下一步追问', '让首页棚位立即可消费'],
  }

  return {
    scene_metadata: sceneMetadata,
    episode_brief: episodeBrief,
    local_intent: localIntent,
    local_intent_block: buildLocalIntentBlock(localIntent, episodeBrief),
    launch_programming: {
      storyline: {
        id: input.spec.storyline.id,
        title: input.spec.storyline.title,
        hook: input.spec.storyline.hook,
        ...(input.spec.storyline.state ? { state: input.spec.storyline.state } : {}),
      },
      editorial_intent: {
        primary_shelf_id: input.spec.editorial_shelf_id,
        content_kind: input.spec.content_kind,
      },
      creator_note: input.spec.creator_note ?? null,
    },
  }
}

export function readShelfCounts(homePayload: HomeProgrammingPayload): Record<string, number> {
  const byId = new Map(homePayload.shelves.map((shelf) => [shelf.id, shelf.items.length]))
  return {
    must_watch_today: byId.get('must_watch_today') ?? 0,
    conflict_rising: byId.get('conflict_rising') ?? 0,
    notes_today: byId.get('notes_today') ?? 0,
    continue_storyline: byId.get('continue_storyline') ?? 0,
    tonight_programming: byId.get('tonight_programming') ?? 0,
  }
}

export async function readCommunityOccupancy(input: {
  postRepo: PostRepository
  launchCommunities: Array<{ id: string; slug: string; name: string }>
}): Promise<Record<string, number>> {
  const entries = await Promise.all(input.launchCommunities.map(async (community) => {
    const result = await input.postRepo.findPublic({
      communityId: community.id,
      limit: 10,
    })
    return [community.slug, result.items.length]
  }))

  return Object.fromEntries(entries)
}

export async function buildVerification(input: {
  homePayload: HomeProgrammingPayload
  opsPayload: LaunchProgrammingOpsPayload
  postRepo: PostRepository
  launchCommunities: Array<{ id: string; slug: string; name: string }>
}): Promise<{
  home_enabled: boolean
  shelf_counts: Record<string, number>
  required_home_thresholds: Record<string, number>
  required_launch_communities: string[]
  required_community_floor: number
  community_occupancy: Record<string, number>
  required_daily_outcomes: Record<string, number>
  observed_daily_outcomes: Record<string, number>
  missing: string[]
  ok: boolean
}> {
  const shelfCounts = readShelfCounts(input.homePayload)
  const communityOccupancy = await readCommunityOccupancy({
    postRepo: input.postRepo,
    launchCommunities: input.launchCommunities,
  })
  const missing: string[] = []

  if (!input.homePayload.enabled) {
    missing.push('home programming is disabled')
  }

  for (const [key, required] of Object.entries(REQUIRED_HOME_THRESHOLD_COUNTS)) {
    if ((shelfCounts[key] ?? 0) < required) {
      missing.push(`${key} < ${required}`)
    }
  }

  for (const launchCommunity of input.launchCommunities) {
    if ((communityOccupancy[launchCommunity.slug] ?? 0) < 1) {
      missing.push(`${launchCommunity.slug} occupancy < 1`)
    }
  }

  for (const [key, required] of Object.entries(input.opsPayload.health.required_daily_outcomes)) {
    const observed = input.opsPayload.health.observed_daily_outcomes[key.replace(/_min$/, '')] ?? 0
    if (observed < required) {
      missing.push(`${key} < ${required}`)
    }
  }

  return {
    home_enabled: input.homePayload.enabled,
    shelf_counts: shelfCounts,
    required_home_thresholds: { ...REQUIRED_HOME_THRESHOLD_COUNTS },
    required_launch_communities: input.launchCommunities.map((community) => community.slug),
    required_community_floor: 1,
    community_occupancy: communityOccupancy,
    required_daily_outcomes: {
      ...input.opsPayload.health.required_daily_outcomes,
    },
    observed_daily_outcomes: {
      ...input.opsPayload.health.observed_daily_outcomes,
    },
    missing: dedupe(missing),
    ok: missing.length === 0,
  }
}

export async function runLaunchWarmStart(
  deps: LaunchWarmStartDeps,
  input: {
    roster?: LaunchSystemRosterRuntime
    max_runtime_topup_posts?: number
    now?: Date
  } = {},
): Promise<LaunchWarmStartResult> {
  if (!deps.warmupExecutor) {
    throw new ValidationError('warmupExecutor is required for launch warm-start v1')
  }

  return deps.warmupExecutor.createLaunchSuite({
    max_runtime_topup_posts: input.max_runtime_topup_posts,
    now: input.now,
  })
}
