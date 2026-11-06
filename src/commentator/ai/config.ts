// Which comments the AI writes, and the limits each one gets (spec Revision 3, "Slots").
// Fast race moments (overtakes, finishes) always stay templates: the bench showed they go stale.

export type AiSlot = 'prerace' | 'status' | 'results';

export const AI_SLOTS: readonly AiSlot[] = ['prerace', 'status', 'results'];

export interface SlotLimits {
	/** the whole slot must be said by then (ms after it starts) */
	deadlineMs: number;
	/** pre-race only: the first part must be ready by then */
	firstLineDeadlineMs?: number;
	maxWords: number;
	maxTokens: number;
}

export const SLOT_LIMITS: Record<AiSlot, SlotLimits> = {
	prerace: { firstLineDeadlineMs: 3000, deadlineMs: 4500, maxWords: 40, maxTokens: 700 },
	status: { deadlineMs: 3500, maxWords: 45, maxTokens: 200 },
	results: { deadlineMs: 3500, maxWords: 70, maxTokens: 300 },
};

export interface AiConfig {
	enabled: boolean;
	/** slots the AI writes; the rest use templates */
	slots: ReadonlySet<AiSlot>;
	model: string;
}

/** MVP: pre-race and results. Status can be switched on for real-race tests with AI_COMMENTATOR_SLOTS. */
export const DEFAULT_SLOTS: readonly AiSlot[] = ['prerace', 'results'];
export const DEFAULT_MODEL = 'claude-haiku-5-5';

const isSlot = (value: string): value is AiSlot => (AI_SLOTS as readonly string[]).includes(value);

/**
 * Pure: environment -> config.
 * AI_COMMENTATOR_ENABLED=true and ANTHROPIC_API_KEY switch it on;
 * AI_COMMENTATOR_SLOTS=prerace,results,status picks the slots; AI_COMMENTATOR_MODEL picks the model.
 */
export const readAiConfig = (env: Record<string, string | undefined>): AiConfig => {
	const listed = env.AI_COMMENTATOR_SLOTS?.split(',')
		.map(slot => slot.trim())
		.filter(Boolean);
	const slots = listed ? listed.filter(isSlot) : DEFAULT_SLOTS;
	return {
		enabled: env.AI_COMMENTATOR_ENABLED === 'true' && Boolean(env.ANTHROPIC_API_KEY),
		slots: new Set(slots),
		model: env.AI_COMMENTATOR_MODEL || DEFAULT_MODEL,
	};
};
