import { createContext } from "react";
import type { SafeArea } from "./safeArea";

/**
 * The enclosing <Scene>'s content box (see safeArea.ts), for components
 * that need a real pixel cap rather than trusting their CSS ancestry to
 * have a definite size — standalone <Diagram> in particular. Null outside
 * a Scene (or before Scene provides it): callers must degrade gracefully,
 * not throw, since a component like Diagram is also usable standalone in
 * tests/Studio without a wrapping Scene.
 */
export const SafeAreaContext = createContext<SafeArea | null>(null);
