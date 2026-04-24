import type {
  Context,
  Intent,
  Metadata,
  Opportunity,
} from "./recommendation-runtime-protocol.ts";
import type { RetrievalResult } from "./recommendation-runtime-services.ts";

export type CandidateMaterialSet = {
  state?: RetrievalResult;
  memory?: RetrievalResult;
  supply?: RetrievalResult;
  constraints?: RetrievalResult;
};

export type ConstructCandidatesInput = {
  context: Context;
  intent: Intent;
  materials: CandidateMaterialSet;
  limit?: number;
  metadata?: Metadata;
};

export interface CandidateConstructionService {
  construct(input: ConstructCandidatesInput): Promise<Opportunity[]>;
}
