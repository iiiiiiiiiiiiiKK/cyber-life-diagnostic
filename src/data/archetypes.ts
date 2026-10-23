import type { ModuleKey } from './modules';

/**
 * 16 种诊断结果。
 *
 * 匹配规则：按数组顺序，第一个「全部条件满足」的类型胜出；
 * 最后一个类型的 `rules` 为空数组，等价于无条件兜底，所以一定会有结果。
 * 条件里的数值一律使用模块**对外显示的读数**（0–100），便于和报告页数字对应。
 */

export type Op = '>=' | '<=' | '>';

export interface Rule {
  module: ModuleKey;
  op: Op;
  value: number;
}

export interface Archetype {
  id: string;
  /** 结果名称 */
  name: string;
  /** 报告上的短代号 */
  code: string;
  /** 副标题：一句话概括 */
  subtitle: string;
  /** 系统状态：报告顶部那一行 */
  status: string;
  /** 2–3 句描述 */
  description: string;
  /** 最终结论：一句话 */
  verdict: string;
  /** 3 条轻松的行动建议 */
  advice: [string, string, string];
  /** 匹配条件（全部满足） */
  rules: Rule[];
  /** 结果自带的趣味标签 */
  tags: string[];
}

export const ARCHETYPES: Archetype[] = [
  {
    id: 'attention-outage',
    name: '内存不足型人生',
    code: 'ERR_ATTN_OOM',
    subtitle: '你同时开着 37 个想法，但没有一个能加载完成',
    status: '注意力分区严重不足，系统正在频繁回收上下文',
    description:
      '你的注意力被切成了很多小份，每一份都还留在昨天的某个标签页里。你并非不专注，只是「专注」这个线程总是被更高的优先级打断，而那个更高优先级通常叫「再看一眼」。',
    verdict: '你的人生不是没有内存，是后台开得太多。',
    advice: [
      '今天只留 3 个标签页，其余全部加入「稍后看」并假装已经看过了。',
      '给自己设一个 25 分钟的假截止时间，用来对抗「等会儿再开始」。',
      '把「我刚才想说什么」写在便签上，这比努力回忆更省电。',
    ],
    rules: [
      { module: 'attention', op: '<=', value: 38 },
      { module: 'delay', op: '>=', value: 55 },
    ],
    tags: ['多标签体质', '上下文丢失', '碎片化'],
  },
  {
    id: 'multithread-overload',
    name: '多线程过载型人格',
    code: 'ERR_THREAD_UM',
    subtitle: '三件事同时推进，三件事同时卡在 80%',
    status: '线程池已满，所有任务都在等待自己完成',
    description:
      '你拥有惊人的启动能力：新项目、新习惯、新计划，全都能在第一小时进入状态。问题是你的收尾线程常年缺勤，于是人生目录里躺着一排进度条停在 80% 的文件夹。',
    verdict: '你不缺执行力，你缺的是「把最后一个 20% 干完」的运气。',
    advice: [
      '挑一件已经 80% 的事，今天把它推到 100%，其他全部暂停。',
      '每开一个新任务前，先关掉一个旧任务（真的关掉）。',
      '给未完成的事起名字，命名会让它们显得更值得收尾。',
    ],
    rules: [
      { module: 'delay', op: '>=', value: 68 },
      { module: 'tomorrow', op: '>=', value: 60 },
    ],
    tags: ['多线程', '收尾困难', '启动很快'],
  },
  {
    id: 'tomorrow-queue',
    name: '明日计划堆积型系统',
    code: 'QUEUE_FULL',
    subtitle: '队列里全是明天，消费者线程今天请假',
    status: '计划队列已达上限，新计划正在覆盖旧计划',
    description:
      '你列的每一份计划都是认真的，认真到写完之后就有了「已经做过」的满足感。明天的你会比今天更自律——这个假设已经连续成立了 412 天，从未被验证。',
    verdict: '你的明天很忙，因为你把所有活都派给了它。',
    advice: [
      '把明天计划里最轻的一件，挪到今天剩下的十分钟里做完。',
      '给计划加上「几点、在哪、做多久」，模糊的计划不占内存也不占行动。',
      '允许自己删掉三条计划，删除不是失败，是清理缓存。',
    ],
    rules: [
      { module: 'tomorrow', op: '>=', value: 66 },
      { module: 'delay', op: '>=', value: 50 },
    ],
    tags: ['明日复明日', '计划收藏家', '队列积压'],
  },
  {
    id: 'social-unstable',
    name: '社交接口不稳定',
    code: 'NET_SOC_TMO',
    subtitle: '不是不想回，是握手总在最后一刻超时',
    status: '社交接口丢包率偏高，建议降低并发',
    description:
      '你在线，你也想回应，但每次打开对话框，脑子里会先跑一遍「这样说会不会奇怪」的预演。预演通常耗时两小时，最终你回了一个表情包，问题解决，关系维持，电量归零。',
    verdict: '你的社交不是断线，是延迟太高。',
    advice: [
      '先回一个「收到，晚点细说」，把超时变成排队。',
      '把长回复拆成两句话发出去，别等「最完美的版本」。',
      '每周主动发起一次不重要的对话，重要的是发起，不是内容。',
    ],
    rules: [
      { module: 'social', op: '<=', value: 42 },
      { module: 'doubt', op: '>=', value: 56 },
    ],
    tags: ['延迟已读', '措辞困难', '表情包外交'],
  },
  {
    id: 'emotion-consumption',
    name: '情绪进程占用过高',
    code: 'SELF_HIGH_CPU',
    subtitle: '后台一直在回放三年前的片段，画质还挺清晰',
    status: '自我怀疑进程占用过高，已影响前台响应',
    description:
      '你的内心有一个很敬业的审计员，负责复盘每一次对话的每一句话。它工作认真、从不请假，唯一的问题是它审的都是旧账，而你今天的电量被它悄悄用掉了大半。',
    verdict: '你不是想太多，是后台程序没关。',
    advice: [
      '给「我是不是说错了」设一个 30 秒上限，超时就允许自己翻篇。',
      '把担心的事写下来，写下来的事通常比想象中小一半。',
      '今晚给复盘程序放个假，换一部不需要动脑的剧。',
    ],
    rules: [
      { module: 'doubt', op: '>=', value: 66 },
      { module: 'sleep', op: '<=', value: 62 },
    ],
    tags: ['夜间复盘', '内心弹幕', '高占用'],
  },
  {
    id: 'slow-reality',
    name: '现实连接正常但响应缓慢',
    code: 'RLT_HIGH_PING',
    subtitle: '线下的世界还在，只是 ping 值有点高',
    status: '现实连接可用，往返时延偏高',
    description:
      '你并没有和现实断开，只是所有线下事件都需要一点缓冲：出门前要想一会儿，见面要热身十分钟，天气要靠别人的朋友圈才知道。连接是好的，就是加载有点慢。',
    verdict: '你和世界还连着，只是需要多一点加载时间。',
    advice: [
      '今天出门十分钟，不用有目的，走到路口再回来也算。',
      '开窗看一眼天气，这是最低成本的现实握手。',
      '约一个熟人做一件不需要准备的事，比如一起走一段路。',
    ],
    rules: [
      { module: 'reality', op: '<=', value: 46 },
      { module: 'reality', op: '>=', value: 28 },
      { module: 'attention', op: '>=', value: 62 },
    ],
    tags: ['高延迟', '需要缓冲', '线下待机'],
  },
  {
    id: 'wallet-low-battery',
    name: '钱包低电量模式',
    code: 'WAL_LOW_BAT',
    subtitle: '发工资那天电量 100%，第七天开始省电',
    status: '钱包电量进入低电量模式，后台应用已被限制',
    description:
      '你对钱的态度很健康——健康得像体检报告里的「建议复查」。凑单、深夜下单、给情绪买点小礼物，每一笔都有充分理由，加起来就是一个完整的月度故事。',
    verdict: '你不是月光，你是电量管理策略比较激进。',
    advice: [
      '给「凑单」设一条规则：省下的运费不能大于多花的钱。',
      '深夜购物车里的东西，第二天中午再看一次，一半会自己消失。',
      '留一笔「重启人生基金」，金额不重要，存在感很重要。',
    ],
    rules: [{ module: 'wallet', op: '<=', value: 34 }],
    tags: ['凑单选手', '深夜下单', '低电量'],
  },
  {
    id: 'sleep-offline',
    name: '睡眠服务离线',
    code: 'SLP_OFFLINE',
    subtitle: '凌晨一点，你的睡眠服务还在排队重启',
    status: '睡眠服务响应超时，已降级为「躺着刷手机」',
    description:
      '你的夜晚有很强的自主意识：明明很困，却总觉得还有一个更值得看的视频。第二天靠咖啡重启，晚上再靠手机充电，形成一个稳定而优美的循环。',
    verdict: '你不是夜猫子，你是睡眠服务的运维事故。',
    advice: [
      '把「再看一集」改成「再看十分钟」，十分钟是个可以骗过自己的数字。',
      '手机放到伸手够不到的地方，物理隔离比意志力便宜。',
      '如果长期睡不好，请找专业医生聊聊，这不是段子能解决的事。',
    ],
    rules: [
      { module: 'sleep', op: '<=', value: 40 },
      { module: 'attention', op: '<=', value: 62 },
    ],
    tags: ['夜间活跃', '闹钟克星', '服务降级'],
  },
  {
    id: 'balanced-human',
    name: '稳定运行型人生',
    code: 'ALL_OK',
    subtitle: '各项指标都在安全区，罕见地没有故事',
    status: '全部模块正常，系统已连续运行而无需抢救',
    description:
      '你的检测结果平静得有点可疑：没有溢出、没有告警、没有需要连夜处理的缓存。你大概是那种会提前做完、按时睡觉、并且真的会回复「在吗」的人。系统对你表示罕见的尊重。',
    verdict: '一切正常，这本身就是一种稀有的异常。',
    advice: [
      '保持就好，不必为了写报告而故意制造问题。',
      '给自己留一点无效率的时间，稳定运行也需要散热。',
      '把这套节奏记下来，它是你以后崩了能回滚的备份。',
    ],
    rules: [
      { module: 'attention', op: '>=', value: 66 },
      { module: 'delay', op: '<=', value: 44 },
      { module: 'sleep', op: '>=', value: 62 },
      { module: 'doubt', op: '<=', value: 50 },
    ],
    tags: ['稳定运行', '低告警', '稀有'],
  },
  {
    id: 'reality-roaming',
    name: '离线漫游型人格',
    code: 'RLT_ROAMING',
    subtitle: '现实网络已断开，正在使用虚拟漫游套餐',
    status: '现实连接丢失，系统已切换到本地缓存模式',
    description:
      '你的世界清晰、流畅、可搜索，唯一的缺点是它不在窗外。你已经很久没有为一件「不重要但真实」的事情分心了，比如楼下的树、路过的猫、或者朋友突然的一句闲话。',
    verdict: '你的信号满格，只是连的不是这个世界。',
    advice: [
      '今天做一件必须离开屏幕才能完成的小事。',
      '和一个人当面说三句话，内容不限，包括「今天好热」。',
      '出门时把手机留在口袋里，二十分钟不用拿出来。',
    ],
    rules: [{ module: 'reality', op: '<=', value: 34 }],
    tags: ['现实离线', '线上满格', '需要接地'],
  },
  {
    id: 'deadline-golem',
    name: '截止日期驱动型生命体',
    code: 'DDL_ENGINE',
    subtitle: '平时静止，deadline 前 6 小时开始发光',
    status: '检测到极强的截止日期响应，日常模式几乎休眠',
    description:
      '你是一台效率极高的机器，只是启动钥匙在别人手里。deadline 一到，你会展现出惊人的专注与创造力，代价是那一晚的睡眠和你对自己的一声叹气。',
    verdict: '你不是拖延，你是在等一个能把你点燃的日期。',
    advice: [
      '给任务人为设一个提前两天的假 deadline，骗自己一次。',
      '把大任务切一刀，先做能在一小时内结束的那块。',
      '熬完夜之后别急着复盘人生，先补觉，结论一般会变。',
    ],
    rules: [
      { module: 'delay', op: '>=', value: 62 },
      { module: 'sleep', op: '<=', value: 55 },
      { module: 'attention', op: '>=', value: 45 },
    ],
    tags: ['极限冲刺', '夜间工作者', '高压启动'],
  },
  {
    id: 'overthink-walrus',
    name: '过度编译型人格',
    code: 'COMPILE_SLOW',
    subtitle: '一句「好的」在脑子里编译了四十分钟',
    status: '语言输出前需多轮编译，输出延迟显著',
    description:
      '你说话前会考虑语气、场合、对方心情和可能的误解，于是最终发出一个「嗯嗯」。你的谨慎是优点，只是编译时间太长，很多本想说的话在缓存里过期了。',
    verdict: '你的话都在，只是大多没编译完就关机了。',
    advice: [
      '允许自己发出不完美的句子，语法错误不会导致关系崩溃。',
      '把想说的话先说给自己听一遍，比在脑子里空转快。',
      '重要的话写在备忘录里，写完直接发，不要二次编辑。',
    ],
    rules: [
      { module: 'social', op: '<=', value: 60 },
      { module: 'doubt', op: '>=', value: 50 },
      { module: 'attention', op: '>=', value: 45 },
    ],
    tags: ['编译缓慢', '措辞严谨', '输出延迟'],
  },
  {
    id: 'content-blackhole',
    name: '内容黑洞型系统',
    code: 'FEED_INFINITE',
    subtitle: '输入永远比输出多，收藏夹已经比人生长',
    status: '输入队列无限增长，输出通道处于休眠状态',
    description:
      '你收藏了 800 篇「以后一定看」的文章、43 个待学课程和一堆截图。你确实在学习，只是学的都是「如何学习」。信息摄入很饱，消化系统有点跟不上。',
    verdict: '你不是没在学习，你是把知识存成了只读文件。',
    advice: [
      '从收藏夹里挑一条，今天就用掉，一条就够。',
      '看完一个东西后写一句话总结，写不出来说明还没看懂。',
      '取关三个不再让你开心的账号，输入质量比数量重要。',
    ],
    rules: [
      { module: 'attention', op: '<=', value: 58 },
      { module: 'tomorrow', op: '>=', value: 48 },
      { module: 'reality', op: '>=', value: 40 },
    ],
    tags: ['收藏即学会', '输入过载', '待消化'],
  },
  {
    id: 'quiet-observer',
    name: '静音观察者',
    code: 'MUTE_OBSERVER',
    subtitle: '群里从不说话，但每条都看了，还记住了',
    status: '社交输出通道静音，输入通道满负荷',
    description:
      '你是那种在群里潜水三年、却能准确知道每个人近况的存在。你不爱发言，但你在场；你不主动联系，但被联系时从不敷衍。这是一种很低调但很稳的连接方式。',
    verdict: '你不吵，但你一直在。',
    advice: [
      '偶尔发一句话，让别人知道你在，一个字也行。',
      '把「我看到了」说出来，它比默默关心更有用。',
      '找一个能接受你低频节奏的朋友，这比强行社交更可持续。',
    ],
    rules: [
      { module: 'social', op: '<=', value: 50 },
      { module: 'doubt', op: '<=', value: 45 },
      { module: 'reality', op: '>=', value: 45 },
    ],
    tags: ['潜水员', '低频在线', '稳定在场'],
  },
  {
    id: 'system-restart',
    name: '频繁重启型人生',
    code: 'REBOOT_LOOP',
    subtitle: '每周立一次新计划，每周重启一次人生',
    status: '检测到周期性重启行为，配置未保存即丢失',
    description:
      '你很有热情，也很擅长开始：新的作息表、新的学习计划、新的自己。可惜每次重启都没来得及保存配置，于是下周你又会以更饱满的热情再重启一次。',
    verdict: '你的问题不是重启，是每次重启都没存档。',
    advice: [
      '这次只改一个小配置，比如固定起床时间，坚持两周再加下一个。',
      '把旧计划里唯一有效的那条留下来，别每次都从零写。',
      '允许计划中断，中断之后接着用，比推倒重来省事。',
    ],
    rules: [
      { module: 'tomorrow', op: '>=', value: 55 },
      { module: 'doubt', op: '>=', value: 42 },
      { module: 'wallet', op: '>=', value: 30 },
    ],
    tags: ['周期重启', '热情型', '未存档'],
  },
  {
    id: 'buffer-human',
    name: '缓冲中的人类',
    code: 'BUFFERING',
    subtitle: '所有模块都在加载，进度条卡在 63%',
    status: '系统处于过渡状态，建议不要在此期间做重大决定',
    description:
      '你最近的状态是「还行，但说不上好」。没有明显的故障，也没有明显的动力，一切都像在缓冲：想做的事情在缓冲，想休息也在缓冲。这不是故障，这是加载。',
    verdict: '你只是还没加载完，不是坏了。',
    advice: [
      '别在这时候逼自己下结论，缓冲期本来就没什么结论。',
      '做一件十分钟能做完的小事，进度条动一下，人就活一点。',
      '如果这种状态持续很久并影响生活，找专业的人聊聊，比硬撑有用。',
    ],
    rules: [],
    tags: ['加载中', '过渡状态', '待机'],
  },
];

export const ARCHETYPE_MAP: Record<string, Archetype> = ARCHETYPES.reduce(
  (acc, a) => {
    acc[a.id] = a;
    return acc;
  },
  {} as Record<string, Archetype>,
);
