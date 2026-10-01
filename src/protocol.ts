import type {ChartAnalysis} from './analyze';

/** Main thread ⇄ scoring worker messages. */
export type ScoreRequest = {id: number; text: string};

export type ScoreSuccess = {
  id: number;
  ok: true;
  charts: ChartAnalysis[];
  errors: {difficulty: string; message: string}[];
  slots: {slot: number; name: string}[];
};

export type ScoreFailure = {id: number; ok: false; message: string};

export type ScoreResponse = ScoreSuccess | ScoreFailure;
