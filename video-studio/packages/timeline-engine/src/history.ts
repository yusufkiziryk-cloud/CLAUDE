import type { Sequence } from "@studio/domain";

/**
 * Snapshot tabanlı undo/redo geçmişi. Komutlar saf olduğundan her uygulanan
 * komutun sonucu yığına itilir; undo/redo yalnızca işaretçiyi oynatır.
 */
export class TimelineHistory {
  private readonly stack: Sequence[] = [];
  private cursor = -1;
  private readonly limit: number;

  constructor(initial: Sequence, limit = 100) {
    this.limit = limit;
    this.push(initial);
  }

  get current(): Sequence {
    const seq = this.stack[this.cursor];
    if (!seq) throw new Error("Geçmiş boş — bu bir hata.");
    return seq;
  }

  get canUndo(): boolean {
    return this.cursor > 0;
  }

  get canRedo(): boolean {
    return this.cursor < this.stack.length - 1;
  }

  /** Yeni durumu geçmişe ekler; redo kuyruğu temizlenir. */
  push(sequence: Sequence): Sequence {
    this.stack.splice(this.cursor + 1);
    this.stack.push(sequence);
    if (this.stack.length > this.limit) this.stack.shift();
    this.cursor = this.stack.length - 1;
    return sequence;
  }

  /** Komutu uygular ve sonucu geçmişe ekler; komut hata fırlatırsa durum değişmez. */
  apply(command: (current: Sequence) => Sequence): Sequence {
    return this.push(command(this.current));
  }

  undo(): Sequence {
    if (this.canUndo) this.cursor -= 1;
    return this.current;
  }

  redo(): Sequence {
    if (this.canRedo) this.cursor += 1;
    return this.current;
  }
}
