// Lightweight LCS-based line diff for two text blobs.
export type DiffLine = { type: "added" | "removed" | "unchanged"; text: string };

export function diffLines(a: string, b: string): DiffLine[] {
  const aLines = a.split("\n");
  const bLines = b.split("\n");
  const m = aLines.length;
  const n = bLines.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] = aLines[i] === bLines[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out: DiffLine[] = [];
  let i = 0, j = 0;
  while (i < m && j < n) {
    if (aLines[i] === bLines[j]) {
      out.push({ type: "unchanged", text: aLines[i] });
      i++; j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ type: "removed", text: aLines[i++] });
    } else {
      out.push({ type: "added", text: bLines[j++] });
    }
  }
  while (i < m) out.push({ type: "removed", text: aLines[i++] });
  while (j < n) out.push({ type: "added", text: bLines[j++] });
  return out;
}