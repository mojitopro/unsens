export interface DiffLine {
  type: "add" | "remove" | "context";
  content: string;
  lineNum?: number;
}

export function computeDiff(before: string, after: string): DiffLine[] {
  const bLines = before.split("\n");
  const aLines = after.split("\n");
  const result: DiffLine[] = [];

  // Simple LCS-based diff
  const lcs = buildLCS(bLines, aLines);
  let bi = 0, ai = 0, li = 0;

  while (bi < bLines.length || ai < aLines.length) {
    if (li < lcs.length && bi < bLines.length && bLines[bi] === lcs[li] && ai < aLines.length && aLines[ai] === lcs[li]) {
      result.push({ type: "context", content: bLines[bi], lineNum: ai + 1 });
      bi++; ai++; li++;
    } else if (ai < aLines.length && (li >= lcs.length || aLines[ai] !== lcs[li])) {
      result.push({ type: "add", content: aLines[ai], lineNum: ai + 1 });
      ai++;
    } else if (bi < bLines.length) {
      result.push({ type: "remove", content: bLines[bi] });
      bi++;
    }
  }
  return result;
}

function buildLCS(a: string[], b: string[]): string[] {
  const m = Math.min(a.length, 200);
  const n = Math.min(b.length, 200);
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  const result: string[] = [];
  let i = m, j = n;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) { result.unshift(a[i - 1]); i--; j--; }
    else if (dp[i - 1][j] > dp[i][j - 1]) i--;
    else j--;
  }
  return result;
}
