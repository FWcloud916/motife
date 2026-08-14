// The eval set — the same three concepts Phase 0 anchored on, but as
// PROMPTS, not documents. The checked-in eval docs (src/dsl/docs/) are the
// few-shot examples and the regression baseline; these prompts are what
// the fully-automatic pipeline is judged on (motife-plan.md §3 Phase 3:
// 對 eval set 3 個概念全自動跑一輪，人工評分).
export interface EvalConcept {
  /** Directory-safe name under out/eval/<date>/. */
  slug: string;
  title: string;
  prompt: string;
}

export const EVAL_CONCEPTS: readonly EvalConcept[] = [
  {
    slug: "jwt-auth",
    title: "JWT 驗證流程",
    prompt:
      "解釋 JWT 驗證流程：client 登入取得 token，token 的 header/payload/signature 結構," +
      "以及 API server 收到請求後如何驗證簽章、檢查 claims（exp、iss、aud）並授權。",
  },
  {
    slug: "mq-backpressure",
    title: "Message Queue 背壓",
    prompt:
      "解釋 message queue 的背壓（backpressure）：producer 速度超過 consumer 時佇列如何堆積," +
      "以及常見的因應策略（限流、丟棄、緩衝上限、擴充 consumer）各自的取捨。",
  },
  {
    slug: "db-index",
    title: "資料庫索引原理",
    prompt:
      "解釋資料庫索引的原理：沒有索引時的全表掃描,B-tree 索引如何加速查詢," +
      "以及索引帶來的寫入成本與何時不該建索引。",
  },
];
