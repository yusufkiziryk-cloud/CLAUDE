"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, ErrorNote, Field, TextInput } from "@studio/ui";
import { api, ApiError, setAuthToken } from "@/lib/api";

/** Parola korumalı modda (AUTH_PASSWORD) oturum açma sayfası. */
export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { token } = await api.login(password);
      setAuthToken(token);
      router.push("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.body.userMessage : String(err));
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm space-y-4 pt-16">
      <h1 className="text-xl font-bold">Giriş</h1>
      <Card>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Parola" hint="Sunucudaki AUTH_PASSWORD değeri">
            <TextInput
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              required
            />
          </Field>
          {error ? <ErrorNote message={error} /> : null}
          <Button type="submit" disabled={busy || password === ""} className="w-full">
            {busy ? "Giriş yapılıyor…" : "Giriş Yap"}
          </Button>
        </form>
      </Card>
      <p className="text-xs text-zinc-400">
        Parola koruması kapalıysa (geliştirme modu) bu sayfaya gerek yoktur;{" "}
        <a href="/" className="text-indigo-400 hover:underline">
          ana sayfaya dönün
        </a>
        .
      </p>
    </div>
  );
}
