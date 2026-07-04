export * from "./generated/api";
// ملاحظة: generated/types بيصدّر TS interfaces بنفس أسماء zod schemas في generated/api
// (تضارب تسميات من orval) — الباك إند والفرونت بيستخدموا generated/api كمصدر أساسي،
// فبنستبعد types هنا لتجنب "already exported" errors في tsc.
// لو احتجت الـ interfaces دي، استوردها مباشرة: import { X } from "@workspace/api-zod/generated/types/...";

