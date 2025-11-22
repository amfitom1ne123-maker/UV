// src/AuthScreen.tsx
import { useState } from "react";
import { authApi } from "./api/auth";

type Props = { onDone: (u:any)=>void };

export default function AuthScreen({ onDone }: Props) {
  const [mode, setMode] = useState<"login"|"register">("login");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState<string|null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true); setErr(null);
    try {
      const u = mode === "login"
        ? await authApi.login(email, pass)
        : await authApi.register(email, pass);
      onDone(u);
    } catch (e:any) {
      setErr(e?.message ?? "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ padding: 16, display: "grid", gap: 8 }}>
      <h3>{mode === "login" ? "Sign in" : "Create account"}</h3>
      <input placeholder="email" value={email} onChange={e=>setEmail(e.target.value)} />
      <input placeholder="password" type="password" value={pass} onChange={e=>setPass(e.target.value)} />
      {err && <div style={{color:"crimson"}}>{err}</div>}
      <button disabled={busy} onClick={submit}>
        {busy ? "Please wait..." : (mode === "login" ? "Sign in" : "Register")}
      </button>
      <button onClick={() => setMode(m => m==="login" ? "register" : "login")} style={{opacity:0.7}}>
        {mode === "login" ? "No account? Register" : "Have account? Sign in"}
      </button>
    </div>
  );
}
