// The stress set (Phase 4 PR 5) — 12 concepts deliberately OUTSIDE the eval
// set (evalConcepts.ts) and outside the three checked-in DSL docs the
// system prompt embeds as few-shot examples (prompt.ts inlines all of
// src/dsl/docs/*). Phase 4's acceptance criterion item 2 (motife-plan.md
// §3 Phase 4): ≥10 non-eval-set concepts, ≥8 producing a passing MP4
// (every human score ≥3, no 1s), remaining failure modes archived into the
// next deterministic-fix round (PR 6).
//
// Coverage axes the 3 baselines under-exercise:
//   tree/graph depth           — binary-heap, trie-autocomplete, consistent-hashing
//   code/terminal               — git-rebase-vs-merge, event-loop, sql-isolation-levels
//   meter/pacing                — token-bucket, lru-cache, cap-theorem
//   multi-step Diagram+Camera   — dns-resolution, tls-handshake, oauth-auth-code
//
// binary-heap and trie-autocomplete are here on purpose: they're the
// evidence the deferred TreeDiagram decision needs — db-index's B+Tree is
// currently two stacked Diagrams, and db-index is the one Phase 3 concept
// that never converged (progress/2026-08-17-phase-4-polish-and-publish/
// PROGRESS.md's "Known deferrals" section).
import type { EvalConcept } from "./evalConcepts";

export const STRESS_CONCEPTS: readonly EvalConcept[] = [
  {
    slug: "binary-heap",
    title: "二元堆積 Heap",
    prompt:
      "解釋二元堆積（binary heap）如何維護最大/最小值：完全二元樹的陣列表示," +
      "插入時的 sift-up 與取出頂端後的 sift-down 如何在 O(log n) 內恢復堆積性質。",
  },
  {
    slug: "trie-autocomplete",
    title: "Trie 前綴樹自動完成",
    prompt:
      "解釋 Trie 前綴樹如何加速自動完成：以字元為邊逐層下降定位前綴節點," +
      "再從該節點展開所有後續字串,以及與雜湊表/線性掃描相比的取捨。",
  },
  {
    slug: "consistent-hashing",
    title: "一致性雜湊",
    prompt:
      "解釋一致性雜湊（consistent hashing）如何讓節點增減時只搬動少量資料：" +
      "節點與資料如何映射到同一個雜湊環上,以及與傳統取模雜湊相比,擴縮容時的重新分配成本差異。",
  },
  {
    slug: "git-rebase-vs-merge",
    title: "Git rebase 與 merge",
    prompt:
      "解釋 Git 的 rebase 與 merge 的差異：merge 如何保留兩條分支的原始歷史並產生合併節點," +
      "rebase 如何重寫提交歷史成一條直線,以及各自對協作分支的取捨與風險。",
  },
  {
    slug: "event-loop",
    title: "JavaScript Event Loop",
    prompt:
      "解釋 JavaScript 的 event loop 與 microtask queue 執行順序：呼叫堆疊清空後" +
      "如何優先清空 microtask queue（如 Promise callback）,再處理下一個 macrotask（如 setTimeout）。",
  },
  {
    slug: "sql-isolation-levels",
    title: "SQL Transaction 隔離等級",
    prompt:
      "解釋 SQL Transaction 的隔離等級：Read Uncommitted、Read Committed、Repeatable Read、" +
      "Serializable 各自允許或防止髒讀、不可重複讀、幻讀的程度,以及等級越嚴格對併發效能的成本。",
  },
  {
    slug: "token-bucket",
    title: "Token Bucket 限流",
    prompt:
      "解釋 token bucket 演算法如何限制 API 呼叫速率：桶子以固定速率補充 token、" +
      "每次請求消耗一個 token、桶子容量如何允許短暫爆發流量,以及與固定視窗限流相比的差異。",
  },
  {
    slug: "lru-cache",
    title: "LRU 快取淘汰策略",
    prompt:
      "解釋 LRU（最近最少使用）快取淘汰策略如何運作：命中時如何把項目移到最新位置、" +
      "容量滿時如何淘汰最久未使用的項目,以及與 LFU、FIFO 相比適合的情境。",
  },
  {
    slug: "cap-theorem",
    title: "CAP 定理",
    prompt:
      "解釋 CAP 定理：一致性（Consistency）、可用性（Availability）、分區容忍性（Partition tolerance）" +
      "三者在網路分區發生時為何最多只能同時滿足兩項,以及 CP 與 AP 系統各自的取捨與例子。",
  },
  {
    slug: "dns-resolution",
    title: "DNS 解析流程",
    prompt:
      "解釋瀏覽器解析一個網域名稱經過哪些步驟：先查本機與作業系統快取,再依序詢問" +
      "recursive resolver、root、TLD、authoritative name server,以及每一層可能被快取縮短的原因。",
  },
  {
    slug: "tls-handshake",
    title: "TLS 交握",
    prompt:
      "解釋 TLS 交握如何在不安全的網路上建立加密連線：ClientHello/ServerHello 協商加密套件、" +
      "伺服器出示憑證讓客戶端驗證身分、雙方交換金鑰材料算出共用的 session key,之後才開始加密傳輸。",
  },
  {
    slug: "oauth-auth-code",
    title: "OAuth2 Authorization Code Flow",
    prompt:
      "解釋 OAuth2 的 Authorization Code Flow 如何讓第三方應用取得授權：使用者被導向授權伺服器登入同意、" +
      "授權伺服器回傳一次性 authorization code,應用再拿 code 加上 client secret 向後端換取 access token。",
  },
];
