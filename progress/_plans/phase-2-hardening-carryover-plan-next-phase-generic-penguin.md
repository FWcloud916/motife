# Phase 2 前置 — Phase 1 硬化收尾(四項未決項目)

## Context

Phase 1(解說元件庫)已全部合併進 `main`(PR #2–#6)。收尾時記錄了四個未決項目(見 `docs/component-library.md` "Open items for Phase 2" 與 Phase 1 PROGRESS.md Follow-ups),使用者決定在進入 Phase 2(DSL + Compiler)前先全部解決:

1. **CJK 標籤溢出** — Diagram 節點固定尺寸(md 268×228),長中文標籤直接溢出卡片。→ 使用者決定:**量測 + CSS 防護**。
2. **CameraTarget 量測風險** — 一次性 ref 讀 offset,與 Diagram 舊 fit bug 同類(已在 renderStill 實證過會踩)。→ 使用者決定:**保留並修**。
3. **轉場時長數學** — fade 會讓相鄰場景重疊、縮短總長,`buildTimeline()` 未建模。
4. **ESLint barrel 強制** — Phase 1 跳過的 `no-restricted-imports`;經查證實際只需一條 `**/components/**` 黑名單 pattern(gitignore 語法),先前的「深度脆弱」顧慮不成立。

**Branch**: `phase-2/hardening-carryover` → 單一 PR into `main`。目前 worktree detached 在 `origin/main`(`49ba40f`),從這裡開分支。

## 共用前置:`fontsReady()` (`src/components/tokens/fonts.ts`)

Item 1、2 的正確性核心。`loadFonts()` 內部的 delayRender 只擋「截圖」,React mount/effect 在字型檔到達**之前**就會跑——此時 measureText/offsetWidth 量到的是 fallback 字型。修法:`loadFonts()` 保留各 `loadFont()` 回傳的 handle,新增 `fontsReady(): Promise<void>` = `Promise.all(handles.map(h => h.waitUntilDone()))`(冪等、自帶 loadFonts 呼叫)。從 `tokens/index.ts` 匯出 → 自動進 barrel。不用 `validateFontIsLoaded`(DiagramNode 用 fontWeight 750,非任何已載入 face,check 會誤判;fontsReady 更強)。

## Item 1 — CJK 量測 + CSS 防護

- **`computeLayout` 第二參數(預算好的尺寸表,非 callback)**:`computeLayout(graph, nodeSizes?: Record<string, NodeSize>)`,缺 key fallback 到現有 `NODE_SIZE` token 表(需將 `NODE_SIZE` 改為 export)。`GraphSpec` 不動——DSL/LLM 永不帶尺寸(硬性約束)。現有 9 個測試不改即過。
- **純公式 `src/components/layout/nodeSizing.ts`**(node 可測):`width = clamp(tokenWidth, ceil(contentWidth) + 2×32, 560)`;height 維持 token(md 卡最壞兩行換行仍 <228,cap 560 = 三節點+兩個 NODE_SEP 仍容於 1920)。
- **瀏覽器量測 `src/components/layout/measureNodes.ts`**:`measureText`(@remotion/layout-utils)量 label(sans/26/750)與 detail(sans/20/400)——參數必須與 DiagramNode 渲染完全一致;`contentWidth = max(label, detail)`。
- **Diagram.tsx 接線**:`useState` 存 measuredSizes;`useEffect` 內 `delayRender("Diagram: measure node labels")` → `fontsReady().then(量測 → setState → continueRender)`,cleanup 釋放 handle;`useMemo(() => computeLayout(graph, measuredSizes ?? undefined), [graph, measuredSizes])`。首次 commit 用 token 尺寸,但 delayRender 保證截圖前已換成量測結果(Studio 可能閃一幀,註解說明可接受)。既有 camera-registry effect deps `[cameraRegistry, layout]` 自動重新註冊。
- **DiagramNode CSS 防護**:容器加 `padding: 0 16px`、`boxSizing: border-box`、`overflow: hidden`;label/detail 加 `maxWidth: 100%`、`textAlign: center`、`overflowWrap: "anywhere"`、`lineHeight: 1.25`。
- **測試**:computeLayout 加 3 條(override 生效變寬、無 override 維持 268×228、同 override 兩次呼叫確定性);新 `nodeSizing.test.ts`(min clamp / pad 數學 / 560 cap / height passthrough)。
- **安裝**:`pnpm-workspace.yaml` 加 `- '@remotion/layout-utils@4.0.508'`;`npx remotion add @remotion/layout-utils`(不可 pnpm add)。
- **常駐 CJK 驗證**:gallery `DEMO_GRAPH` worker 節點加 CJK detail(如 `"非同步工作處理器示範"`),讓煙霧測試永久覆蓋量測路徑。

## Item 2 — CameraTarget 修復(保留)

- **機制**:mount 時 eagerly `delayRender(\`<CameraTarget id="...">initial measurement\`)`(有標籤,timeout 30s 時可辨識);**無 dep array 的 useEffect** 每次 commit 都 `fontsReady().then(量 offset* → registry.register → 首次 continueRender)`——registry 既有 dedupe 使穩態成為 no-op;unmount effect 釋放 handle 防早卸載掛死渲染。
- 不採 ResizeObserver(字型換入可能只移位置不變尺寸,RO 不觸發);offsetLeft/offsetTop 保留(pre-transform 座標,Camera scale 下正確)。
- **`{target}` 與 `{node}` 共用 registry 不改碼**,只在文件加註:同一 Camera 內 CameraTarget id 不得與 Diagram node id 重複。
- **煙霧可驗證**:gallery `CameraDemo` 在 Diagram 之後加 `<CameraTarget id="camera-note"><Callout variant="banner" .../></CameraTarget>`(直接子元素、無定位包裝),並重排 shots 讓**最後一鏡** focus `{target: "camera-note"}`——smoke 取樣最後一幀,量測回歸會直接顯形為取景錯誤。
- 更新 Camera.tsx 內已解決的 "Open item" 註解。

## Item 3 — 轉場時長數學

- **新共用純模組 `src/remotion/compositions/timeline.ts`**(gallery 已跨 composition 借 FPS,借此止住耦合加深):
  - `SceneTransition = "cut" | "fade"`;`TRANSITION_FRAMES = 15`(字面量 + `// tokens.duration.fast` 註解——沿用 computeLayout 的 NODE_SEP 先例,storyboard 檔頭宣告「無 React import」且 barrel 會拖進元件模組,不從 barrel 引 tokens)。
  - `buildTimeline(scenes, fps, transitionFrames)`:每項算 `transitionToNext`(最後一項強制 "cut")與 `overlapWithNext`;`cursor += duration − overlap`;fade ≥ 任一鄰接場景時長時 throw(TransitionSeries 渲染時會炸,提早在資料層報錯)。
  - `totalFrames(timeline)` = `max(1, last.from + last.duration)` ≡ Σ − overlaps(空清單 → 1,保留原行為)。
- **storyboard.ts**:`SceneSpec` 加 `transitionToNext?`;刪本地閉包版 buildTimeline 改用共用版;SCENES 不動(全 cut)→ `TIMELINE`/`TOTAL_FRAMES`(1200)值完全不變。
- **JwtAuthFlow.tsx**:`flatMap` 產出平面陣列(非 fragment——TransitionSeries 走直接 children),`transitionToNext === "fade"` 時插入 `<TransitionSeries.Transition presentation={fade()} timing={linearTiming({durationInFrames: overlapWithNext})} />`;`fade` 從子路徑 `@remotion/transitions/fade` import。全 cut 下輸出零 Transition → 位元級不變。
- **gallery 轉換**:改用同 pattern + `GALLERY_SCENES`(diagram→code 設一個 fade),`GALLERY_TOTAL_FRAMES` 由 `totalFrames()` 算出(630 → 615)——每次 smoke 都渲染一次真 fade。Root.tsx 不需改。
- **測試 `timeline.test.ts`**:全 cut 等於累加、單 fade `next.from = prev.from + dur − 15` 且 total = Σ−15、雙 fade Σ−30、末項 fade 正規化為 cut、單場景/空清單、guard throw。另 `storyboard.test.ts` 一行 pin:`TOTAL_FRAMES === 1200`(JWT 回歸鎖)。

## Item 4 — ESLint barrel 強制

- **eslint.config.mjs 追加**:`files: ["src/remotion/**/*.{ts,tsx}"]`,`no-restricted-imports: ["error", { patterns: [{ group: ["**/components/**"], message: "Import from the components barrel..." }] }]`。已逐一驗證(gitignore 語法,`ignore` 套件):深層 import 全攔、各深度的 bare barrel 全放行、`react`/`remotion`/`@remotion/transitions/fade`/`./storyboard`/`../jwt-auth/storyboard`/`../timeline` 全放行;`src/components/**` 在 glob 外,內部互相深 import 不受限。
- **Root.tsx 正規化**:`"../components/tokens"` → `"../components"`(`loadFonts` 已在 barrel,現狀是全 repo 唯一違規)。
- **規則驗證**:實作時暫時把一個 import 改成深層路徑,`pnpm lint` 確認恰好報錯,還原;不留常駐 config 測試(`pnpm verify` 內的 lint 即長期保證),PR 描述註明。

## Commit 切分(順序有意義)

1. `lint:` ESLint 規則 + Root.tsx 正規化(先立規,後續 commit 都在規則下寫)
2. `feat(timeline):` timeline.ts + 測試 + storyboard 重構 + JwtAuthFlow flatMap + gallery 轉換
3. `feat(layout):` allowlist + layout-utils 安裝 + fontsReady + nodeSizing/measureNodes + computeLayout 第二參數 + Diagram 接線 + DiagramNode CSS + gallery CJK detail + 測試
4. `fix(camera):` CameraTarget 重寫 + gallery target 展示 + shots 重排
5. `docs+progress:` 見下

## 進度與文件

- progress-tracker skill 開新項目:slug `phase-2-hardening-carryover`,scope `motife:phase-2/hardening-carryover`;Phase 1 項目 Outcome 的 Follow-ups 補指向。
- `docs/component-library.md`(bump Last updated):刪 "Open items" 三條(註明已由本 PR 關閉);Diagram 節說明量測尺寸(token Size = 最小足印、560 cap、wrap 防護、GraphSpec 仍無尺寸);Camera 節說明新量測機制 + id 命名空間衝突註記;新增 Scene transitions 小節(`transitionToNext`、overlap 下的 `from` 語意、TRANSITION_FRAMES);Import surface 節註明已 lint 強制。
- 更新 JwtAuthFlow.tsx 檔頭過時註解("isn't threaded through buildTimeline() yet")。

## 驗證

1. `pnpm verify`(tsc + eslint + vitest + smoke;gallery 煙霧自動覆蓋:CJK 量測寬度、真 fade、CameraTarget 最終鏡)。
2. 定點 still 目視:`ComponentGallery` frame ≈142(fade 中段交叉)、≈610(target 聚焦鏡)、≈100(CJK 卡片變寬且不溢出)。
3. JWT 回歸:`TOTAL_FRAMES === 1200` 測試 pin + 對照分支前後 `out/smoke/JwtAuthFlow/frame-*.png`(預期不變;若 Diagram 卡因量測變寬屬合理差異,逐張目檢後接受)。

## 風險

- measureText 跨機確定性:字型經 google-fonts 4.0.508 位元固定 + 渲染走 Remotion 自帶 headless Chrome → 渲染面穩定;Studio 預覽可能差次像素,僅影響預覽。
- TransitionSeries 時長脫鉤:單一真相源(buildTimeline → totalFrames → Composition.durationInFrames)+ 單元測試守住;過長只會出現尾端空白幀,smoke 不會抓,故靠測試。
- ESLint 誤傷:假想的含 `components` 段的 npm 深路徑會被攔——現無此例,錯誤訊息自我說明。
