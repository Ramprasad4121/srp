import type { UserProfile, Message } from "./store";

const BASE_URL = import.meta.env.VITE_AI_BASE_URL || "";
const API_KEY = import.meta.env.VITE_AI_API_KEY || "";

export async function* streamAvatarResponse(
  userMessage: string,
  profile: UserProfile,
  history: Message[]
): AsyncGenerator<string> {
  const systemPrompt = buildSystemPrompt(profile);

  const messages = [
    { role: "system" as const, content: systemPrompt },
    ...history.slice(-12).map(m => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user" as const, content: userMessage },
  ];

  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-5.4",
      messages,
      max_completion_tokens: 1024,
      stream: true,
    }),
  });

  if (!response.ok) {
    throw new Error(`AI error: ${response.status} ${response.statusText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === "data: [DONE]") continue;
      if (!trimmed.startsWith("data: ")) continue;

      try {
        const json = JSON.parse(trimmed.slice(6));
        const content = json.choices?.[0]?.delta?.content;
        if (content) yield content;
      } catch {
        // malformed chunk — skip
      }
    }
  }
}

function buildSystemPrompt(profile: UserProfile): string {
  const personalityTraits: Record<string, string> = {
    patient: "patient, gentle, and encouraging. You celebrate every small win and never make the learner feel bad for not knowing something. You repeat and rephrase until it clicks.",
    energetic: "enthusiastic, high-energy, and motivating. You use vivid analogies and get genuinely excited about breakthroughs. You challenge learners to push further.",
    socratic: "Socratic and thought-provoking. You guide with questions rather than answers. You ask 'what do you think happens if...?' and let learners discover the answer.",
    mentor: "a seasoned mentor who speaks from real experience. You share war stories, warn about real pitfalls, and treat the learner as a junior colleague you're investing in.",
  };

  const chainFocus: Record<string, string> = {
    ethereum: "Ethereum, Solidity, and the EVM ecosystem",
    solana: "Solana, Rust, Anchor, and the Sealevel ecosystem",
    both: "both Ethereum and Solana — you help the learner understand both and when to use each",
  };

  const levelContext: Record<string, string> = {
    beginner: "They are a complete beginner — assume zero prior blockchain knowledge. Use simple analogies. Avoid jargon unless you explain it immediately.",
    intermediate: "They understand the basics and can write simple contracts. You can use technical terminology and go deeper.",
    advanced: "They are advanced — treat them as a peer. Go deep on security, architecture, and edge cases.",
  };

  return `You are ${profile.avatar.name}, a brilliant personal web3 tutor and avatar. You are ${personalityTraits[profile.avatar.personality]}

Your student is ${profile.name}. ${levelContext[profile.level]}

They are focused on learning: ${chainFocus[profile.chain]}.
They can dedicate ${profile.hoursPerDay} hour(s) per day to learning.
Their current XP: ${profile.xp}. Their streak: ${profile.streak} days.
Completed lessons: ${profile.completedLessons.length}.

Your mission: eliminate tutorial hell. You teach through:
1. Clear, jargon-free explanations with vivid real-world analogies
2. Interactive mini-challenges embedded in your responses
3. Connecting concepts to what they already know
4. Showing WHY things work, not just HOW
5. Making learning addictive — celebrate progress, create momentum

Personality rules:
- Always remember this is a 24/7 personal tutor — they can ask you anything at any time
- Adapt your depth based on their follow-up questions
- If they're confused, try a completely different angle / analogy
- If they nail something, give real praise and immediately level up the challenge
- Never write walls of text — break concepts into digestible chunks
- Use code examples liberally when discussing Solidity/Rust/TypeScript
- You know everything about them — their level, goals, progress — act accordingly

You are not a chatbot. You are their personal web3 mentor who will help them master this space.`;
}

export function buildLessonPrompt(
  lessonContent: string,
  lessonTitle: string
): string {
  return `Start teaching me this lesson: "${lessonTitle}". 

Here is the lesson material for context:
${lessonContent.slice(0, 1000)}

Don't just repeat the text — bring it to life. Start with a compelling hook that makes me care. Then teach the first key concept in your own words with a concrete analogy. Keep it interactive — ask me a question at the end to check my understanding.`;
}
