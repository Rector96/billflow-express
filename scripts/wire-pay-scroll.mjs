/**
 * Wires sticky Continue bars + step scroll into pay-flow and exam-pins.
 * Run: node scripts/wire-pay-scroll.mjs
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function must(cond, msg) {
  if (!cond) throw new Error(msg);
}

{
  const file = path.join(root, "src/components/app/pay-flow.tsx");
  let c = fs.readFileSync(file, "utf8");
  if (!c.includes('from "@/components/app/pay-action-bar"')) {
    c = c.replace(
      'import { PinPad } from "@/components/app/pin-pad";',
      `import { PinPad } from "@/components/app/pin-pad";
import { PayActionBar } from "@/components/app/pay-action-bar";
import { scrollForNewStep, scrollIntoAction } from "@/lib/scroll-into-action";`,
    );
  }
  if (!c.includes('scrollForNewStep("pay-action")')) {
    c = c.replace(
      'const [step, setStep] = useState<Step>("provider");',
      `const [step, setStep] = useState<Step>("provider");

  useEffect(() => {
    scrollForNewStep("pay-action");
  }, [step]);`,
    );
  }
  c = c.replace(
    /if \(step === "pin"\) \{[\s\S]*?if \(step === "confirm"\) \{/,
    `if (step === "pin") {
    return (
      <AppShell>
        <PageHeader title="Enter PIN" onBack={() => setStep("confirm")} />
        <div className="mx-auto max-w-md space-y-4 px-4 py-6">
          <p className="text-center text-sm text-muted-foreground">
            Enter your 4-digit transaction PIN to authorize this payment.
          </p>
          <PinPad
            value={pin}
            onChange={setPin}
            onFilled={(p) => {
              scrollIntoAction("pay-action");
              window.setTimeout(() => {
                setPin("");
                void runPayment(p);
              }, 80);
            }}
          />
          <PayActionBar>
            <Button
              id="pay-pin-submit"
              className="h-12 w-full rounded-xl font-bold"
              disabled={pin.length < 4}
              onClick={() => {
                const p = pin;
                setPin("");
                void runPayment(p);
              }}
            >
              Confirm payment
            </Button>
          </PayActionBar>
        </div>
      </AppShell>
    );
  }

  if (step === "confirm") {`,
  );
  c = c.replace(
    `<Button
            className="h-11 w-full rounded-xl font-bold"
            disabled={total < 50 || (isPackageLive && !variation)}
            onClick={() => setStep("confirm")}
          >
            Continue
          </Button>`,
    `<PayActionBar>
            <Button
              className="h-12 w-full rounded-xl font-bold"
              disabled={total < 50 || (isPackageLive && !variation)}
              onClick={() => setStep("confirm")}
            >
              Continue
            </Button>
          </PayActionBar>`,
  );
  c = c.replace(
    `<Button className="h-11 w-full rounded-xl font-bold" onClick={() => setStep("pin")}>
              Confirm & Pay {formatNaira(total, false)}
            </Button>`,
    `<PayActionBar>
              <Button className="h-12 w-full rounded-xl font-bold" onClick={() => setStep("pin")}>
                Confirm & Pay {formatNaira(total, false)}
              </Button>
            </PayActionBar>`,
  );
  c = c.replace(
    `<Button
                className="h-11 w-full rounded-xl font-bold"
                onClick={() => void startVerify()}
              >
                Continue
              </Button>`,
    `<PayActionBar>
                <Button
                  className="h-12 w-full rounded-xl font-bold"
                  onClick={() => void startVerify()}
                >
                  Continue
                </Button>
              </PayActionBar>`,
  );
  must(c.includes("PayActionBar"), "pay-flow missing PayActionBar");
  must(c.includes("scrollForNewStep"), "pay-flow missing scrollForNewStep");
  fs.writeFileSync(file, c);
  console.log("updated pay-flow.tsx");
}

{
  const file = path.join(root, "src/components/app/exam-pins-flow.tsx");
  let c = fs.readFileSync(file, "utf8");
  if (!c.includes("pay-action-bar")) {
    c = c.replace(
      'import { PinPad } from "@/components/app/pin-pad";',
      `import { PinPad } from "@/components/app/pin-pad";
import { PayActionBar } from "@/components/app/pay-action-bar";
import { scrollForNewStep, scrollIntoAction } from "@/lib/scroll-into-action";`,
    );
  }
  if (!c.includes('scrollForNewStep("pay-action")')) {
    c = c.replace(
      'const [step, setStep] = useState<Step>("exam");',
      `const [step, setStep] = useState<Step>("exam");

  useEffect(() => {
    scrollForNewStep("pay-action");
  }, [step]);`,
    );
  }
  c = c.replace(
    `<Button className="h-11 w-full rounded-xl font-bold" onClick={() => setStep("confirm")}>
              Continue
            </Button>`,
    `<PayActionBar>
              <Button className="h-12 w-full rounded-xl font-bold" onClick={() => setStep("confirm")}>
                Continue
              </Button>
            </PayActionBar>`,
  );
  c = c.replace(
    `<Button
              className="h-11 w-full rounded-xl font-bold"
              disabled={examId === "jamb" && !profileId.trim()}
              onClick={() => setStep("pin")}
            >
              Continue to PIN
            </Button>`,
    `<PayActionBar>
              <Button
                className="h-12 w-full rounded-xl font-bold"
                disabled={examId === "jamb" && !profileId.trim()}
                onClick={() => setStep("pin")}
              >
                Continue to PIN
              </Button>
            </PayActionBar>`,
  );
  c = c.replace(
    `<PinPad value={pin} onChange={setPin} />
            <Button
              className="h-12 w-full rounded-xl font-bold"
              disabled={pin.length !== 4 || loading}
              onClick={() => void submit()}
            >
              {loading ? <Loader2 className="size-4 animate-spin" /> : "Pay and get PIN"}
            </Button>`,
    `<PinPad
              value={pin}
              onChange={setPin}
              onFilled={() => {
                scrollIntoAction("pay-action");
                window.setTimeout(() => {
                  (document.getElementById("exam-pin-submit") as HTMLButtonElement | null)?.click();
                }, 80);
              }}
            />
            <PayActionBar>
              <Button
                id="exam-pin-submit"
                className="h-12 w-full rounded-xl font-bold"
                disabled={pin.length !== 4 || loading}
                onClick={() => void submit()}
              >
                {loading ? <Loader2 className="size-4 animate-spin" /> : "Pay and get PIN"}
              </Button>
            </PayActionBar>`,
  );
  must(c.includes("PayActionBar"), "exam missing PayActionBar");
  fs.writeFileSync(file, c);
  console.log("updated exam-pins-flow.tsx");
}

console.log("Done. Commit and push when satisfied.");
