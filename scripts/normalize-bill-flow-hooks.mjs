import { readFileSync, writeFileSync } from "node:fs";

/**
 * Maintenance guard for RockPayBillFlow.
 *
 * React hooks must execute in the same order on every render. The bill flow has
 * legitimate early-return screens for unavailable services, so pending-status
 * polling and success-confetti hooks must live BEFORE those returns.
 *
 * This script is intentionally idempotent: if the hooks are already above the
 * route/service early returns, it makes no change. Keeping the rule here gives
 * future developers (and automated audits) an explicit explanation of why the
 * hook order matters.
 */

const path = "src/components/app/rockpay-bill-flow.tsx";
const source = readFileSync(path, "utf8");

const pollStart =
  '  useEffect(() => {\n    if (step !== "result" || outcome !== "pending" || !txId) return;';
const pollEnd = "  }, [step, outcome, txId, isAirtime, checkAirtime, checkBill, refresh]);";
const confettiStart =
  '  useEffect(() => {\n    if (step === "result" && outcome === "successful") {';
const confettiEnd = "  }, [step, outcome]);";
const earlyReturn = '  if (slug === "education") return <ExamPinsFlow entryTitle="Education" />;';

const pollStartIndex = source.indexOf(pollStart);
const pollEndIndex = source.indexOf(pollEnd, pollStartIndex);
const confettiStartIndex = source.indexOf(confettiStart);
const confettiEndIndex = source.indexOf(confettiEnd, confettiStartIndex);
const earlyReturnIndex = source.indexOf(earlyReturn);

if (
  pollStartIndex === -1 ||
  pollEndIndex === -1 ||
  confettiStartIndex === -1 ||
  confettiEndIndex === -1 ||
  earlyReturnIndex === -1
) {
  throw new Error("Could not locate the bill-flow hook/early-return markers safely.");
}

const pollBlock = source.slice(pollStartIndex, pollEndIndex + pollEnd.length);
const confettiBlock = source.slice(confettiStartIndex, confettiEndIndex + confettiEnd.length);

// Already normalized: both hooks are before the first early return.
if (pollStartIndex < earlyReturnIndex && confettiStartIndex < earlyReturnIndex) {
  console.log("[normalize-bill-flow-hooks] already normalized");
  process.exit(0);
}

let next = source;
const blocks = [pollBlock, confettiBlock];
for (const block of blocks) {
  next = next.replace(`\n${block}\n`, "\n");
}

const insert = `\n\n  // Keep these hooks above all conditional route/service returns.\n${pollBlock}\n\n${confettiBlock}`;
const target = next.indexOf(earlyReturn);
if (target === -1) throw new Error("Early-return marker disappeared during normalization.");

next = next.slice(0, target) + insert + next.slice(target);
writeFileSync(path, next);
console.log(
  "[normalize-bill-flow-hooks] moved pending polling and success hooks above early returns",
);
