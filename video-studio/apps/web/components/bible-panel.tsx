"use client";

import { useCallback, useEffect, useState } from "react";
import type { BibleCard } from "@studio/domain";
import { Badge, Button, Card, EmptyState, ErrorNote, Field, Select, TextInput } from "@studio/ui";
import { api, ApiError } from "@/lib/api";

const KIND_LABELS = { character: "karakter", location: "mekân", style: "stil" } as const;

/** Karakter / mekân / stil kartları — görsel tutarlılığın kaynağı. */
export function BiblePanel({ projectId, onChanged }: { projectId: string; onChanged: () => void }) {
  const [cards, setCards] = useState<BibleCard[]>([]);
  const [kind, setKind] = useState<"character" | "location" | "style">("character");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [fragment, setFragment] = useState("");
  const [isRealPerson, setIsRealPerson] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setCards((await api.listBibleCards(projectId)).cards);
    } catch {
      // geçici hata
    }
  }, [projectId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.createBibleCard(projectId, {
        kind,
        name,
        description,
        ...(fragment.trim() ? { promptFragment: fragment } : {}),
        isRealPerson,
        consentConfirmed: false,
      });
      setName("");
      setDescription("");
      setFragment("");
      setIsRealPerson(false);
      await refresh();
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.body.userMessage : String(err));
    }
  }

  async function toggleConsent(card: BibleCard) {
    await api.updateBibleCard(card.id, { consentConfirmed: !card.consentConfirmed });
    await refresh();
    onChanged();
  }

  async function remove(id: string) {
    await api.deleteBibleCard(id);
    await refresh();
    onChanged();
  }

  return (
    <Card title="Karakter / Mekân / Stil Kartları">
      <div className="space-y-3">
        <form onSubmit={add} className="space-y-2 rounded-md border border-zinc-800 p-3">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Tür">
              <Select value={kind} onChange={(e) => setKind(e.target.value as never)}>
                <option value="character">Karakter</option>
                <option value="location">Mekân</option>
                <option value="style">Stil</option>
              </Select>
            </Field>
            <Field label="Ad">
              <TextInput
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Barista"
              />
            </Field>
          </div>
          <Field label="Tanım">
            <TextInput
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              placeholder="Otuzlarında, güler yüzlü kahveci"
            />
          </Field>
          <Field label="Kilitli prompt parçası" hint="Bu kart geçen her sahnenin promptunda aranır">
            <TextInput
              value={fragment}
              onChange={(e) => setFragment(e.target.value)}
              placeholder="yeşil önlüklü barista"
            />
          </Field>
          <label className="flex items-center gap-2 text-xs text-zinc-300">
            <input
              type="checkbox"
              checked={isRealPerson}
              onChange={(e) => setIsRealPerson(e.target.checked)}
            />
            Gerçek bir kişiyi temsil ediyor (üretim için açık rıza onayı zorunlu olur)
          </label>
          {error ? <ErrorNote message={error} /> : null}
          <Button type="submit" disabled={name.trim() === "" || description.trim() === ""}>
            Kart Ekle
          </Button>
        </form>

        {cards.length === 0 ? (
          <EmptyState title="Henüz kart yok" description="Tutarlılık denetimi kartlara dayanır." />
        ) : (
          <ul className="space-y-2">
            {cards.map((card) => (
              <li key={card.id} className="rounded-md border border-zinc-700 p-2">
                <div className="flex items-center gap-2">
                  <Badge variant="info">{KIND_LABELS[card.kind]}</Badge>
                  <span className="text-sm font-medium text-zinc-200">{card.name}</span>
                  {card.isRealPerson ? (
                    <Badge variant={card.consentConfirmed ? "success" : "error"}>
                      {card.consentConfirmed ? "rıza onaylı" : "rıza GEREKLİ"}
                    </Badge>
                  ) : null}
                  <span className="ml-auto flex gap-1">
                    {card.isRealPerson ? (
                      <Button
                        variant="secondary"
                        className="px-2 py-0.5 text-xs"
                        onClick={() => void toggleConsent(card)}
                      >
                        {card.consentConfirmed ? "Rızayı kaldır" : "Rızayı onayla"}
                      </Button>
                    ) : null}
                    <Button
                      variant="danger"
                      className="px-2 py-0.5 text-xs"
                      onClick={() => void remove(card.id)}
                    >
                      Sil
                    </Button>
                  </span>
                </div>
                <p className="mt-1 text-xs text-zinc-400">{card.description}</p>
                {card.promptFragment ? (
                  <p className="mt-1 text-xs text-zinc-500">
                    Kilitli parça:{" "}
                    <span className="font-mono text-indigo-400">{card.promptFragment}</span>
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
