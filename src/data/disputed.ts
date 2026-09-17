/**
 * Places whose location is not just low-confidence but actively argued over.
 * The atlas follows OpenBible's coordinate — it has to put the dot somewhere —
 * and these notes say what that choice is, and what the alternatives are, so a
 * reader is not left thinking the map knows more than it does.
 */
export const DISPUTED: Record<string, string> = {
  // Eden (the garden), Gen 2:8 — OpenBible score 178/1000.
  af3daeb:
    'Nobody knows where Eden was, or whether it is a place on a map at all. The atlas follows OpenBible in putting it in the Armenian highlands, near where the Tigris and Euphrates rise; other readings put it at the other end of those rivers, near the head of the Persian Gulf. Genesis 2 locates the garden by four rivers, two of which — the Pishon and the Gihon — nobody has identified with any confidence.',
  // Pishon, Gen 2:11 — score 145/1000.
  a19b076:
    'One of the two rivers of Eden nobody has identified. The atlas follows the guess that it is Wadi Baysh in Arabia; the Ganges, the Indus and a now-dry channel across northern Arabia have all been proposed.',
  // Gihon (the river of Eden, not the spring at Jerusalem), Gen 2:13 — score 193/1000.
  a71d79b:
    'The other unidentified river of Eden. The atlas follows the reading that makes it the Nile, which sits awkwardly with the Tigris and Euphrates in the same sentence; the Gihon spring at Jerusalem is a different place with the same name.',
}

export function disputedNote(id: string): string | undefined {
  return DISPUTED[id]
}
