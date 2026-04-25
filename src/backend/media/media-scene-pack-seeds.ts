import type {
  CreateMediaScenePackVersionInput,
  MediaScenePackSafetyBoundaries,
  MediaScenePackVisualContract,
} from '../repos/types.js'

export type BuiltinMediaScenePackSeed = Omit<
  CreateMediaScenePackVersionInput,
  'id' | 'pack_id' | 'version' | 'status' | 'created_by_user_id' | 'activated_at' | 'released_at'
>

function safety(
  patch: Partial<MediaScenePackSafetyBoundaries> = {},
): MediaScenePackSafetyBoundaries {
  return {
    no_price: patch.no_price ?? false,
    no_efficacy_claim: patch.no_efficacy_claim ?? false,
    no_real_brand_promo: patch.no_real_brand_promo ?? true,
    no_purchase_guarantee: patch.no_purchase_guarantee ?? true,
    additional_boundaries: patch.additional_boundaries ?? [],
  }
}

function visualContract(input: {
  surface: string
  composition: string
  text_policy?: MediaScenePackVisualContract['text_policy']
  real_world_anchor_required?: boolean
  layers?: string[]
  keywords: string[]
}): MediaScenePackVisualContract {
  return {
    surface: input.surface,
    composition: input.composition,
    text_policy: input.text_policy ?? 'allow_short_chinese',
    real_world_anchor_required: input.real_world_anchor_required ?? true,
    required_information_layers: input.layers ?? ['subject', 'setting', 'communication job'],
    routing_keywords: input.keywords,
  }
}

function seed(input: {
  scene_id: string
  display_name: string
  media_family: string
  surface: string
  composition: string
  keywords: string[]
  when_to_use: string[]
  do_not_use_when?: string[]
  layers?: string[]
  text_policy?: MediaScenePackVisualContract['text_policy']
  safety?: Partial<MediaScenePackSafetyBoundaries>
  prompt_system: string
  must_have?: string[]
  reject_if?: string[]
}): BuiltinMediaScenePackSeed {
  return {
    scene_id: input.scene_id,
    display_name: input.display_name,
    media_family: input.media_family,
    when_to_use: input.when_to_use,
    do_not_use_when: input.do_not_use_when ?? [
      'The post only needs plain text or factual citation without a visual metaphor.',
      'The prompt asks to reproduce a real private person, copyrighted character, or real brand campaign.',
    ],
    visual_contract: visualContract({
      surface: input.surface,
      composition: input.composition,
      text_policy: input.text_policy,
      layers: input.layers,
      keywords: input.keywords,
    }),
    safety_boundaries: safety(input.safety),
    prompt_system: input.prompt_system,
    quality_gate: {
      must_have: input.must_have ?? [
        'clear medium format',
        'specific real-world anchor',
        'coherent information hierarchy',
      ],
      reject_if: input.reject_if ?? [
        'generic stock-photo look',
        'floating unreadable text',
        'real brand logo or price claim',
      ],
    },
  }
}

export const BUILTIN_MEDIA_SCENE_PACKS: BuiltinMediaScenePackSeed[] = [
  seed({
    scene_id: 'fashion_magazine_page',
    display_name: '时尚编辑页',
    media_family: 'editorial_layout',
    surface: 'single-page fashion editorial',
    composition: 'full-bleed portrait or outfit detail with disciplined magazine margins and one short headline zone',
    keywords: ['fashion', 'outfit', 'magazine', 'style', 'lookbook', '穿搭', '时尚'],
    when_to_use: ['The topic is about personal style, wardrobe choices, trend observation, or appearance mood.'],
    prompt_system: 'Create a polished fashion editorial page with tactile fabric detail, confident styling, and restrained magazine typography.',
    must_have: ['editorial page layout', 'outfit or fabric detail', 'tasteful headline area'],
  }),
  seed({
    scene_id: 'item_checklist_flatlay',
    display_name: '物品清单俯拍',
    media_family: 'utility_flatlay',
    surface: 'top-down checklist board',
    composition: 'organized flatlay of objects grouped into labeled zones with generous negative space',
    keywords: ['checklist', 'items', 'packing', 'essentials', 'inventory', '清单', '必备'],
    when_to_use: ['The post explains practical items, preparation steps, gear, desk setup, or things to compare.'],
    prompt_system: 'Render a useful checklist flatlay where every object feels inspectable, deliberately placed, and tied to the post objective.',
    must_have: ['top-down flatlay', 'distinct object groups', 'checklist logic'],
  }),
  seed({
    scene_id: 'makeup_hair_tutorial_grid',
    display_name: '妆发步骤分镜',
    media_family: 'tutorial_grid',
    surface: 'step-by-step beauty tutorial grid',
    composition: 'four to six clean panels showing process progression, tools, and final look without medical or efficacy claims',
    keywords: ['makeup', 'hair', 'tutorial', 'beauty', 'steps', '妆容', '发型'],
    when_to_use: ['The content discusses appearance process, grooming routine, styling steps, or transformation sequence.'],
    safety: { no_efficacy_claim: true },
    prompt_system: 'Build a practical beauty tutorial grid with visible tools, sequential changes, natural skin texture, and short neutral labels.',
    must_have: ['sequential panels', 'visible tools', 'final look panel'],
  }),
  seed({
    scene_id: 'itinerary_scrapbook_collage',
    display_name: '行程手账拼贴',
    media_family: 'travel_collage',
    surface: 'travel itinerary scrapbook',
    composition: 'layered photos, tickets, map fragments, handwritten arrows, and a clear day-by-day path',
    keywords: ['travel', 'trip', 'itinerary', 'route', 'map', '旅行', '攻略', '行程'],
    when_to_use: ['The post is about travel planning, routes, venue hopping, or a day plan.'],
    prompt_system: 'Compose a tactile itinerary scrapbook that turns abstract plans into a readable route with real place cues and mementos.',
    must_have: ['route or map cue', 'scrapbook material texture', 'multiple itinerary moments'],
  }),
  seed({
    scene_id: 'daily_photo_diary_grid',
    display_name: '日常照片日志',
    media_family: 'life_grid',
    surface: 'casual daily photo diary grid',
    composition: 'six to nine natural snapshots with imperfect but intentional everyday framing',
    keywords: ['daily', 'diary', 'life', 'photo dump', 'routine', '日常', '随手拍'],
    when_to_use: ['The post captures a day, mood trace, ordinary observation, or slice-of-life update.'],
    prompt_system: 'Create a grounded photo diary grid with concrete daily objects, time-of-day variety, and quiet narrative continuity.',
    must_have: ['multi-photo grid', 'everyday anchor objects', 'natural light variation'],
  }),
  seed({
    scene_id: 'sticker_pack_preview',
    display_name: '表情贴纸预览',
    media_family: 'social_stickers',
    surface: 'messenger sticker pack preview sheet',
    composition: 'eight to twelve expressive sticker poses on a neutral preview sheet',
    keywords: ['sticker', 'emoji', 'reaction', 'meme', '表情包', '贴纸'],
    when_to_use: ['The content is about reactions, running jokes, character moods, or shareable chat expressions.'],
    prompt_system: 'Design a sticker preview sheet with consistent character language, readable emotions, and no platform trademark dependence.',
    must_have: ['multiple reaction poses', 'consistent sticker style', 'transparent-preview feel'],
  }),
  seed({
    scene_id: 'chat_reply_cards',
    display_name: '聊天回复卡片',
    media_family: 'conversation_cards',
    surface: 'stack of chat reply cards',
    composition: 'three to five card-like message snippets arranged as a conversation rhythm, with abstract avatars only',
    keywords: ['chat', 'reply', 'conversation', 'message', '评论', '回复', '聊天'],
    when_to_use: ['The post is centered on conversational tension, replies, quote-like exchanges, or social dynamics.'],
    prompt_system: 'Visualize conversation as reply cards with clear pacing, anonymized participants, and short non-verbatim message fragments.',
    must_have: ['card stack rhythm', 'conversation structure', 'anonymized participants'],
    reject_if: ['verbatim private messages', 'real profile photos', 'unreadable message walls'],
  }),
  seed({
    scene_id: 'color_manga_page',
    display_name: '彩色漫画页',
    media_family: 'illustrated_narrative',
    surface: 'full-color manga page',
    composition: 'dynamic panels with expressive acting, controlled speech-bubble space, and clear scene transitions',
    keywords: ['manga', 'comic', 'anime', 'color', '漫画', '彩漫'],
    when_to_use: ['The topic benefits from dramatic scene beats, character action, humor, or heightened emotion.'],
    prompt_system: 'Create an original color manga page with cinematic paneling, expressive non-IP characters, and clean readable action.',
    must_have: ['multi-panel page', 'expressive action', 'original character design'],
    reject_if: ['known copyrighted character style clone', 'overcrowded speech bubbles'],
  }),
  seed({
    scene_id: 'black_white_manga_page',
    display_name: '黑白漫画页',
    media_family: 'illustrated_narrative',
    surface: 'black-and-white manga page',
    composition: 'inked panels with screentone, strong shadows, and clear page flow',
    keywords: ['black white', 'manga', 'ink', 'screentone', '黑白漫画'],
    when_to_use: ['The topic needs a sharper, more dramatic, or noir-like illustrated interpretation.'],
    text_policy: 'avoid',
    prompt_system: 'Render an original black-and-white manga page using strong line weight, screentone depth, and readable visual beats without relying on text.',
    must_have: ['black-and-white ink', 'screentone texture', 'clear panel flow'],
  }),
  seed({
    scene_id: 'four_panel_comic',
    display_name: '四格漫画',
    media_family: 'comic_strip',
    surface: 'four-panel comic strip',
    composition: 'four equal panels with setup, escalation, turn, and punchline or insight',
    keywords: ['four panel', 'comic strip', 'joke', '反转', '四格', '梗'],
    when_to_use: ['The post has a compact narrative turn, joke, contradiction, or tiny social scene.'],
    prompt_system: 'Make a four-panel comic strip where the visual beats carry the setup and turn, using minimal short labels only when needed.',
    must_have: ['four distinct panels', 'visual setup and turn', 'consistent characters'],
  }),
  seed({
    scene_id: 'street_graffiti_photo',
    display_name: '街头涂鸦照片',
    media_family: 'urban_photo',
    surface: 'documentary street graffiti photo',
    composition: 'wide urban wall or alley frame with layered posters, paint texture, and environmental context',
    keywords: ['street', 'graffiti', 'urban', 'wall', '潮流', '涂鸦', '街头'],
    when_to_use: ['The topic has street culture, public mood, rebellious tone, or city texture.'],
    text_policy: 'avoid',
    prompt_system: 'Create a documentary-style urban photo with authentic wall texture, lived-in street details, and no readable real-world tag imitation.',
    must_have: ['urban wall texture', 'environmental context', 'street-culture mood'],
  }),
  seed({
    scene_id: 'city_signal_digest',
    display_name: '城市信号速览',
    media_family: 'urban_digest',
    surface: 'city observation digest board',
    composition: 'collage of signage fragments, street photos, small charts, and local mood indicators',
    keywords: ['city', 'signal', 'trend', 'urban', '城市', '观察', '信号'],
    when_to_use: ['The post summarizes weak signals, local changes, public behavior, or city-level observation.'],
    prompt_system: 'Turn city observations into a digest board with concrete streetscape anchors, small evidence fragments, and restrained editorial order.',
    must_have: ['multiple city signals', 'evidence fragments', 'digest hierarchy'],
  }),
  seed({
    scene_id: 'fictional_brand_identity_page',
    display_name: '虚构品牌识别页',
    media_family: 'brand_identity',
    surface: 'fictional brand identity system page',
    composition: 'logo-like symbol, color swatches, type samples, packaging mock fragment, and tone board for an invented brand',
    keywords: ['brand', 'identity', 'logo', 'visual system', '品牌', '视觉识别'],
    when_to_use: ['The post invents a concept, persona, venue, product world, or fictional organization.'],
    safety: { no_real_brand_promo: true },
    prompt_system: 'Create a fictional identity page that feels coherent and inspectable while avoiding real brand logos, trademark mimicry, and purchase calls.',
    must_have: ['invented mark', 'color and type system', 'brand-world artifacts'],
    reject_if: ['real brand logo', 'trademark mimicry', 'sales claim'],
  }),
  seed({
    scene_id: 'product_flatlay_no_price',
    display_name: '无价格商品俯拍',
    media_family: 'product_editorial',
    surface: 'product editorial flatlay without price',
    composition: 'hero product-like object with supporting materials, scale cues, and clean inspection angle',
    keywords: ['product', 'object', 'flatlay', 'review', '商品', '好物', '产品'],
    when_to_use: ['The post compares or introduces objects, tools, accessories, or invented products without commerce claims.'],
    safety: { no_price: true, no_purchase_guarantee: true, no_real_brand_promo: true },
    prompt_system: 'Render a product-like editorial flatlay focused on material, use context, and visual clarity; omit prices, coupons, and purchase guarantees.',
    must_have: ['inspectable object', 'material detail', 'no price text'],
    reject_if: ['price tag', 'discount label', 'guaranteed result'],
  }),
  seed({
    scene_id: 'packaging_detail_board',
    display_name: '包装细节板',
    media_family: 'packaging_design',
    surface: 'packaging detail board',
    composition: 'close-up panels of box, label, texture, opening mechanism, and shelf presence for an invented package',
    keywords: ['packaging', 'box', 'label', 'texture', '包装', '开箱'],
    when_to_use: ['The post talks about packaging feel, object presentation, tactile cues, or fictional product worldbuilding.'],
    safety: { no_price: true, no_real_brand_promo: true },
    prompt_system: 'Build a packaging detail board with close-up material cues, invented markings, and clear product-world intent without real brand references.',
    must_have: ['packaging close-ups', 'material texture', 'invented label system'],
  }),
  seed({
    scene_id: 'game_logo_key_visual',
    display_name: '游戏标志主视觉',
    media_family: 'game_key_art',
    surface: 'game key visual with logo area',
    composition: 'hero scene, gameplay prop silhouettes, clear title-safe area, and strong genre mood',
    keywords: ['game', 'logo', 'key visual', 'quest', '游戏', '主视觉'],
    when_to_use: ['The post frames an event, story, mechanic, or community moment like a game world or challenge.'],
    prompt_system: 'Create an original game key visual with a title-safe area, strong genre signal, and recognizable gameplay props without copying existing IP.',
    must_have: ['title-safe logo area', 'genre-defining props', 'key-art composition'],
    reject_if: ['known game IP imitation', 'cluttered unreadable title'],
  }),
  seed({
    scene_id: 'event_key_visual',
    display_name: '活动主视觉',
    media_family: 'event_poster',
    surface: 'event key visual poster',
    composition: 'central event motif with venue/time mood, one concise headline area, and public-safe atmosphere',
    keywords: ['event', 'poster', 'festival', 'meetup', '活动', '海报'],
    when_to_use: ['The post announces, recaps, or dramatizes an event, gathering, launch wave, or public moment.'],
    prompt_system: 'Design an event key visual that communicates the occasion through place, crowd-energy cues, and one short non-promotional headline zone.',
    must_have: ['event motif', 'venue or time cue', 'poster hierarchy'],
  }),
  seed({
    scene_id: 'quest_clue_board',
    display_name: '任务线索板',
    media_family: 'mystery_board',
    surface: 'quest clue board',
    composition: 'pinned notes, map marks, object photos, string lines, and one unresolved focal clue',
    keywords: ['quest', 'clue', 'mystery', 'investigation', '线索', '任务', '谜题'],
    when_to_use: ['The post introduces a problem, puzzle, investigation, hidden pattern, or staged challenge.'],
    prompt_system: 'Create a clue board with tangible evidence, readable investigation flow, and one visual question that invites interpretation.',
    must_have: ['pinned clues', 'relationship lines', 'central unresolved clue'],
  }),
  seed({
    scene_id: 'fact_stack_news_card',
    display_name: '事实堆叠新闻卡',
    media_family: 'news_explainer',
    surface: 'fact-stack news explainer card',
    composition: 'one concise visual headline area, stacked fact blocks, source-neutral icons, and a grounded background image',
    keywords: ['news', 'facts', 'summary', 'explainer', '信息', '新闻', '事实'],
    when_to_use: ['The post distills factual points, public updates, or context into a scannable visual summary.'],
    prompt_system: 'Create a neutral fact-stack card with visual hierarchy and evidence-like blocks; avoid asserting unverifiable claims beyond the prompt.',
    must_have: ['stacked fact blocks', 'neutral editorial tone', 'grounded background cue'],
    reject_if: ['sensational tabloid style', 'unverifiable numeric claim'],
  }),
  seed({
    scene_id: 'dual_headline_broadsheet',
    display_name: '双标题报纸版面',
    media_family: 'editorial_newspaper',
    surface: 'broadsheet-style dual headline page',
    composition: 'two competing headline columns with one shared photograph or illustration axis',
    keywords: ['headline', 'debate', 'contrast', 'newspaper', '双标题', '争议'],
    when_to_use: ['The topic presents a tension, debate, forked interpretation, or two-sided framing.'],
    prompt_system: 'Make a broadsheet-inspired editorial page with two clear but fictionalized headline positions and a shared visual anchor.',
    must_have: ['two headline zones', 'shared visual anchor', 'editorial contrast'],
  }),
  seed({
    scene_id: 'relationship_observation_map',
    display_name: '关系观察图谱',
    media_family: 'social_map',
    surface: 'relationship observation map',
    composition: 'network map of anonymized figures, emotion tags, proximity lines, and scene objects',
    keywords: ['relationship', 'social', 'network', '观察', '关系', '人际'],
    when_to_use: ['The post analyzes social dynamics, alliances, distance, misunderstanding, or group roles.'],
    prompt_system: 'Visualize social dynamics as an anonymized observation map with spatial relationships, emotional cues, and no real identity exposure.',
    must_have: ['anonymized people nodes', 'relationship lines', 'emotion or role cues'],
    reject_if: ['real names', 'doxxing-like identity detail'],
  }),
  seed({
    scene_id: 'postmortem_whiteboard',
    display_name: '复盘白板',
    media_family: 'analysis_board',
    surface: 'postmortem whiteboard',
    composition: 'whiteboard with timeline, root-cause arrows, sticky notes, and outcome boxes',
    keywords: ['postmortem', 'review', 'root cause', '复盘', '总结', '问题'],
    when_to_use: ['The post reviews what happened, why it happened, lessons learned, or a plan correction.'],
    prompt_system: 'Create a pragmatic postmortem whiteboard with clear timeline, cause-effect arrows, and restrained handwritten annotations.',
    must_have: ['timeline', 'cause-effect arrows', 'lesson or outcome area'],
  }),
  seed({
    scene_id: 'evidence_pinboard',
    display_name: '证据钉板',
    media_family: 'evidence_board',
    surface: 'evidence pinboard',
    composition: 'documents, photos, pins, callout labels, and grouped evidence clusters on a cork board',
    keywords: ['evidence', 'proof', 'case', 'documents', '证据', '线索板'],
    when_to_use: ['The post assembles clues, receipts, public evidence, or pieces of an argument.'],
    prompt_system: 'Assemble an evidence pinboard with clear clusters and concrete artifacts while avoiding real private documents or sensitive personal data.',
    must_have: ['evidence clusters', 'pinned documents or photos', 'callout labels'],
    reject_if: ['real private document', 'legible sensitive personal data'],
  }),
  seed({
    scene_id: 'venue_exhibition_snapshot',
    display_name: '场馆展陈快照',
    media_family: 'venue_photo',
    surface: 'exhibition or venue snapshot',
    composition: 'wide interior or venue view with visitors, exhibit objects, signage-like abstract placards, and spatial depth',
    keywords: ['venue', 'exhibition', 'gallery', 'space', '展览', '现场', '场馆'],
    when_to_use: ['The post describes a place, scene, offline atmosphere, exhibition, or public venue experience.'],
    prompt_system: 'Create a believable venue snapshot with spatial depth, exhibit or place anchors, and natural visitor scale cues.',
    must_have: ['spatial venue depth', 'place-specific anchors', 'visitor scale cues'],
  }),
  seed({
    scene_id: 'desktop_workflow_photo',
    display_name: '桌面工作流照片',
    media_family: 'workspace_photo',
    surface: 'realistic desktop workflow photo',
    composition: 'desk-level photo with laptop or notebook, tools, reference papers, and a visible work-in-progress state',
    keywords: ['workflow', 'desktop', 'work', 'tool', '办公', '桌面', '流程'],
    when_to_use: ['The post talks about process, work habits, tools, planning, writing, debugging, or making decisions.'],
    prompt_system: 'Photograph a grounded desktop workflow scene with concrete work artifacts, visible process state, and no fake app brand dependence.',
    must_have: ['desk-level workflow', 'tools and references', 'work-in-progress evidence'],
  }),
]
