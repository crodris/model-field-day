// The shape of a saved result file. This file imports only zod, so the site build can read it too.
import { z } from "zod";

const turnResultSchema = z.object({
  output: z.string(),
  finishReason: z.string().nullish(),
  latencyMs: z.number(),
  costUsd: z.number(),
});

// A case with an error keeps the turns it finished, but it is not scored.
const caseResultSchema = z.object({
  id: z.string(),
  turns: z.array(turnResultSchema),
  error: z.string().optional(),
  values: z.record(z.string(), z.number()),
});

const okSchema = z.object({
  status: z.literal("ok"),
  bench: z.string(),
  model: z.string(),
  ranAt: z.iso.datetime(),
  listedAt: z.iso.datetime(),
  settings: z.object({
    temperature: z.number().nullable(),
    maxTokens: z.number(),
    reasoning: z.literal("provider default"),
  }),
  costUsd: z.number(),
  summary: z.record(z.string(), z.number()),
  cases: z.array(caseResultSchema),
});

const unavailableSchema = z.object({
  status: z.literal("unavailable"),
  bench: z.string(),
  model: z.string(),
  ranAt: z.iso.datetime(),
  reason: z.string(),
});

export const resultFileSchema = z.discriminatedUnion("status", [okSchema, unavailableSchema]);

export type TurnResult = z.infer<typeof turnResultSchema>;
export type CaseResult = z.infer<typeof caseResultSchema>;
export type OkResult = z.infer<typeof okSchema>;
export type ResultFile = z.infer<typeof resultFileSchema>;
