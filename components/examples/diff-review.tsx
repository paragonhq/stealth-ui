"use client";
import { DiffReview, parsePatch } from "@/components/ui/diff-review";

// What an agent hands back after "fix the session refresh race": two edits to the
// session helper, one to the button that triggered it, and a new test.
const patch = `diff --git a/src/lib/session.ts b/src/lib/session.ts
--- a/src/lib/session.ts
+++ b/src/lib/session.ts
@@ -14,7 +14,10 @@ export async function refreshSession(token: string) {
   const res = await fetch("/api/session/refresh", {
     method: "POST",
     headers: { authorization: \`Bearer \${token}\` },
   });
-  if (!res.ok) return null;
+  if (res.status === 401) return null;
+  if (!res.ok) {
+    throw new SessionError("Couldn't refresh the session", res.status);
+  }
   return (await res.json()) as Session;
 }
@@ -41,4 +44,8 @@ export function useSession() {
   const [session, setSession] = useState<Session | null>(null);
+  // One refresh in flight at a time; later callers wait for the same promise.
+  const pending = useRef<Promise<Session | null> | null>(null);
+
   useEffect(() => {
-    refreshSession(token).then(setSession);
+    pending.current ??= refreshSession(token).finally(() => (pending.current = null));
+    pending.current.then(setSession);
   }, [token]);
diff --git a/src/components/sign-in-button.tsx b/src/components/sign-in-button.tsx
--- a/src/components/sign-in-button.tsx
+++ b/src/components/sign-in-button.tsx
@@ -8,4 +8,4 @@ export function SignInButton() {
   const { session, status } = useSession();
-  if (status === "loading") return <Spinner />;
+  if (status === "loading") return <Button busy>Sign in</Button>;
   if (session) return <UserMenu user={session.user} />;
   return <Button onClick={signIn}>Sign in</Button>;
diff --git a/src/lib/session.test.ts b/src/lib/session.test.ts
new file mode 100644
--- /dev/null
+++ b/src/lib/session.test.ts
@@ -0,0 +1,6 @@
+test("concurrent callers share one refresh", async () => {
+  const spy = vi.spyOn(globalThis, "fetch");
+  await Promise.all([refreshSession("t"), refreshSession("t")]);
+  expect(spy).toHaveBeenCalledTimes(1);
+});
+`;

const files = parsePatch(patch);

export default function Demo() {
  return <DiffReview files={files} title="Fix the session refresh race" className="h-[500px] w-full max-w-[540px]" />;
}
