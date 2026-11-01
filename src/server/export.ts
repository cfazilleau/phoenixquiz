import ExcelJS from 'exceljs';
import type { Question } from '@/lib/types';
import { User } from './models/User';
import { loadResults } from './results';

const HEADER_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF6B2C' } };

function addSheet(wb: ExcelJS.Workbook, name: string, columns: Partial<ExcelJS.Column>[]) {
  const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = columns;
  const header = ws.getRow(1);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = HEADER_FILL;
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
  return ws;
}

function answerText(q: Question | undefined, value: unknown): string {
  if (Array.isArray(value)) return value.map((id) => q?.options.find((o) => o.id === id)?.text ?? String(id)).join(', ');
  return String(value ?? '');
}

/** Builds the results workbook (opens in Excel, imports into Google Sheets). */
export async function buildResultsWorkbook(sessionId: string): Promise<{ buffer: Buffer; filename: string } | null> {
  const data = await loadResults(sessionId);
  if (!data) return null;
  const { session, questions, answers, ranked, allPlayers } = data;
  const playerName = new Map(allPlayers.map((p) => [p.userId, p.displayName]));
  const qIndex = new Map(questions.map((q, i) => [q.id, i]));

  const wb = new ExcelJS.Workbook();
  wb.creator = 'PhoenixQuiz';
  wb.created = new Date();

  const lb = addSheet(wb, 'Leaderboard', [
    { header: 'Rank', key: 'rank', width: 8 },
    { header: 'Display name', key: 'displayName', width: 28 },
    { header: 'Discord username', key: 'username', width: 24 },
    { header: 'Discord ID', key: 'discordId', width: 22 },
    { header: 'Score', key: 'score', width: 10 },
  ]);
  for (const p of ranked) lb.addRow(p);

  const ans = addSheet(wb, 'Answers', [
    { header: 'Player', key: 'player', width: 28 },
    { header: 'Question #', key: 'n', width: 11 },
    { header: 'Question', key: 'prompt', width: 50 },
    { header: 'Type', key: 'type', width: 11 },
    { header: 'Answer', key: 'answer', width: 36 },
    { header: 'Correct', key: 'correct', width: 9 },
    { header: 'Points', key: 'points', width: 9 },
    { header: 'Submitted at', key: 'submittedAt', width: 22 },
    { header: 'Overridden', key: 'overridden', width: 11 },
  ]);
  const sortedAnswers = [...answers].sort(
    (a, b) =>
      (qIndex.get(a.questionId) ?? 0) - (qIndex.get(b.questionId) ?? 0) ||
      new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime(),
  );
  for (const a of sortedAnswers) {
    const i = qIndex.get(a.questionId);
    const q = i === undefined ? undefined : questions[i];
    ans.addRow({
      player: playerName.get(a.userId) ?? a.userId,
      n: i === undefined ? '' : i + 1,
      prompt: q?.prompt ?? '',
      type: q?.type ?? '',
      answer: answerText(q, a.value),
      correct: a.correct === null || a.correct === undefined ? '' : a.correct ? 'yes' : 'no',
      points: a.pointsAwarded ?? 0,
      submittedAt: new Date(a.submittedAt),
      overridden: a.overriddenBy ? 'yes' : '',
    });
  }
  ans.getColumn('submittedAt').numFmt = 'yyyy-mm-dd hh:mm:ss';

  const qs = addSheet(wb, 'Questions', [
    { header: '#', key: 'n', width: 6 },
    { header: 'Question', key: 'prompt', width: 50 },
    { header: 'Type', key: 'type', width: 11 },
    { header: 'Points', key: 'points', width: 9 },
    { header: 'Answers', key: 'count', width: 10 },
    { header: '% correct', key: 'pct', width: 11 },
  ]);
  questions.forEach((q, i) => {
    const list = answers.filter((a) => a.questionId === q.id);
    const correct = list.filter((a) => a.correct).length;
    qs.addRow({
      n: i + 1,
      prompt: q.prompt,
      type: q.type,
      points: q.points,
      count: list.length,
      pct: list.length ? correct / list.length : null,
    });
  });
  qs.getColumn('pct').numFmt = '0%';

  const adj = addSheet(wb, 'Adjustments', [
    { header: 'Player', key: 'player', width: 28 },
    { header: 'Delta', key: 'delta', width: 9 },
    { header: 'Reason', key: 'reason', width: 40 },
    { header: 'By', key: 'by', width: 24 },
    { header: 'At', key: 'at', width: 22 },
  ]);
  const adminIds = [...new Set((session.scoreAdjustments ?? []).map((a) => a.by).filter(Boolean))];
  const admins = new Map(
    (await User.find({ _id: { $in: adminIds } }, { displayName: 1 }).lean()).map((u) => [u._id.toString(), u.displayName]),
  );
  for (const a of session.scoreAdjustments ?? []) {
    adj.addRow({
      player: playerName.get(a.userId ?? '') ?? a.userId,
      delta: a.delta,
      reason: a.reason,
      by: admins.get(a.by ?? '') ?? a.by,
      at: a.at ? new Date(a.at) : null,
    });
  }
  adj.getColumn('at').numFmt = 'yyyy-mm-dd hh:mm:ss';

  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  const safeTitle = session.title.replace(/[^\p{L}\p{N} _-]+/gu, '').trim().slice(0, 60) || 'quiz';
  const date = new Date(session.createdAt).toISOString().slice(0, 10);
  return { buffer, filename: `${safeTitle} - ${date} - ${session.joinCode}.xlsx` };
}
