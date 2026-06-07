export interface HtfNarrativeBlock {
  heading?: string;
  paragraphs: string[];
}

export const HTF_NARRATIVE_INTRO: HtfNarrativeBlock = {
  heading: 'Context: Higher Timeframe Auction (Volume Profile + TPO)',
  paragraphs: [
    'Before you drop to execution timeframes, read the higher-timeframe auction. This is where you decide what kind of trades might make sense later — not the trade itself.',
    'Where has value been over the last several days or weeks? Are participants accepting new areas or defending old ones? The composite profile, multi-day VAH/VAL/POC, major HVNs and LVNs, and multi-day TPO migration all tell the same story from different angles.',
  ],
};

export const HTF_NARRATIVE_TOOLS: HtfNarrativeBlock = {
  heading: 'Tools to reference',
  paragraphs: [
    'Composite volume profile · Multi-day VAH / VAL / POC · Major HVNs and LVNs · Multi-day TPO · Migration of value areas · Series of day types · Unfinished business (poor highs/lows, single-print corridors).',
  ],
};

export const HTF_NARRATIVE_BRIDGE: HtfNarrativeBlock = {
  paragraphs: [
    'Once the higher-timeframe auction gives you your macro backdrop, narrow your focus to what truly matters next — the developing session in front of you.',
    'Context sets the stage, but today\'s intraday structure tells you how that larger narrative is actually unfolding right now. Stop thinking in weeks and days; start thinking in hours and rotations.',
    'Translate the broader auction into a practical trading posture: how is the current session behaving relative to prior value, how are participants responding to price, and is the market building acceptance or rejecting it? Now zoom in and read today\'s story.',
  ],
};
