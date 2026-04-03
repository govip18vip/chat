export const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    {
      urls: "turn:openrelay.metered.ca:80",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: "turn:openrelay.metered.ca:443?transport=tcp",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
  ],
  iceCandidatePoolSize: 10,
  iceTransportPolicy: "all",
  bundlePolicy: "max-bundle",
  rtcpMuxPolicy: "require",
};

export const MAX_FILE_SIZE = 15 * 1024 * 1024;
export const ICE_TIMEOUT = 15000;
export const ICE_MAX_RESTART = 3;
export const PBKDF2_ITERATIONS = 10000;
export const AI_API_URL = "https://text.pollinations.ai/openai";

export const VOICE_EFFECTS = {
  none: { icon: "Mic", name: "原声" },
  loli: { icon: "Flower2", name: "萝莉音" },
  uncle: { icon: "Guitar", name: "大叔音" },
  geek: { icon: "Bot", name: "极客音" },
  ghost: { icon: "Ghost", name: "幽灵音" },
  cave: { icon: "Mountain", name: "山洞音" },
} as const;

export type VoiceEffectKey = keyof typeof VOICE_EFFECTS;

export const AI_ACTIONS = {
  translate_zh: {
    label: "译为中文",
    icon: "Languages",
    prompt: "请将以下内容翻译成中文，只输出翻译结果：",
  },
  translate_en: {
    label: "译为英文",
    icon: "Globe",
    prompt:
      "Please translate the following to English, output only the translation: ",
  },
  summarize: {
    label: "总结内容",
    icon: "FileText",
    prompt: "请用2-3句话简洁总结以下内容：",
  },
  explain: {
    label: "详细解释",
    icon: "Lightbulb",
    prompt: "请详细解释以下内容，让人容易理解：",
  },
  reply: {
    label: "建议回复",
    icon: "PenLine",
    prompt: "请为以下消息提供3个不同风格的回复建议（简洁列出）：",
  },
  polish: {
    label: "润色文字",
    icon: "Sparkles",
    prompt: "请润色优化以下文字，使其更流畅自然，只输出优化后的内容：",
  },
  sentiment: {
    label: "情感分析",
    icon: "Heart",
    prompt: "请分析以下文字的情感倾向和情绪，给出简要分析：",
  },
  code: {
    label: "解释代码",
    icon: "Code",
    prompt: "请解释以下代码的功能和逻辑，使用简洁清晰的语言：",
  },
} as const;

export type AIActionKey = keyof typeof AI_ACTIONS;

export const EMOJI_CATEGORIES: Record<string, string[]> = {
  "😊": [
    "😀","😃","😄","😁","😆","🥹","😅","🤣","😊","😇","🙂","😉","😌","😍",
    "🥰","😘","😋","😛","😝","😜","🤪","🤗","🤭","🤫","🤔","😐","😏","😒",
    "🙄","😬","😔","😪","😴","😷","🤒","🥴","😵","🤯","🤠","🥳","😎","🤓",
    "😕","😟","😮","😲","😳","🥺","😨","😰","😢","😭","😱",
  ],
  "❤️": [
    "❤️","🧡","💛","💚","💙","💜","🖤","🤍","💔","❤️‍🔥","💕","💞","💓","💗",
    "💖","💘","💪","👍","👎","👊","✊","🤝","👏","🙌","🫶","🙏","✌️","👌","👋","🤟",
  ],
  "🐾": [
    "🐶","🐱","🐭","🐰","🦊","🐻","🐼","🐨","🐯","🦁","🐮","🐷","🐸","🐵",
    "🐔","🐧","🦆","🦅","🦉","🐴","🦄","🐝","🦋","🐌","🐞","🐢","🐙","🐬","🦈","🐳",
  ],
  "🍔": [
    "🍏","🍎","🍐","🍊","🍋","🍌","🍉","🍇","🍓","🍒","🍑","🥭","🥝","🍅",
    "🥑","🥦","🌽","🥕","🍔","🍟","🍕","🌭","🥪","🌮","🥗","🍿","🧁","🍰","🎂","🍫","☕","🍺","🥤",
  ],
};

export const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥"];

export const AUTO_DELETE_OPTIONS = [
  { label: "关闭", value: 0 },
  { label: "10s", value: 10 },
  { label: "30s", value: 30 },
  { label: "1min", value: 60 },
  { label: "5min", value: 300 },
];

export const SCHEDULE_OPTIONS = [
  { label: "1 分钟后", value: 1 },
  { label: "5 分钟后", value: 5 },
  { label: "10 分钟后", value: 10 },
  { label: "30 分钟后", value: 30 },
  { label: "1 小时后", value: 60 },
];
