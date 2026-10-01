/** Scoring worker: the engine is CPU-bound (path sampling, sliding windows), so
 *  it runs off the main thread to keep the interface responsive. */
import {analyzeMaidata, listDifficulties} from './analyze';
import type {ScoreRequest, ScoreResponse} from './protocol';

self.onmessage = (event: MessageEvent<ScoreRequest>) => {
  const {id, text} = event.data;
  let response: ScoreResponse;
  try {
    const slots = listDifficulties(text);
    const {charts, errors} = analyzeMaidata(text);
    response = {id, ok: true, charts, errors, slots};
  } catch (error) {
    response = {id, ok: false, message: error instanceof Error ? error.message : String(error)};
  }
  (self as unknown as Worker).postMessage(response);
};
