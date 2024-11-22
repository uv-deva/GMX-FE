import uniqueId from "lodash/uniqueId";

import { sleep } from "lib/sleep";

import { hashDataMap } from "./hashDataMap";
import { promiseWithResolvers } from "lib/utils";

export const hashDataWorker: Worker = new Worker(new URL("./hashData.worker", import.meta.url), { type: "module" });

const promises: Record<string, { resolve: (value: any) => void; reject: (error: any) => void }> = {};

hashDataWorker.onmessage = (event) => {
  const { id, result, error } = event.data;

  const promise = promises[id];

  if (!promise) {
    // eslint-disable-next-line no-console
    console.warn(`[hashDataWorker] Received message with unknown id: ${id}`);

    return;
  }

  if (error) {
    promise.reject(error);
  } else {
    promise.resolve(result);
  }

  delete promises[id];
};

/**
 * Hashes a map of data in a worker.
 * If the worker does not respond in time, it falls back to the main thread.
 */
export function hashDataMapAsync<
  R extends Record<string, [dataTypes: string[], dataValues: (string | number | bigint | boolean)[]] | undefined>,
>(
  map: R
): Promise<{
  [K in keyof R]: string;
}> {
  const id = uniqueId("hash-data-worker-");
  hashDataWorker.postMessage({
    id,
    map,
  });

  const { promise, resolve, reject } = promiseWithResolvers<{ [K in keyof R]: string }>();
  promises[id] = { resolve, reject };

  const escapePromise = sleep(2000).then(() => "timeout");
  const race = Promise.race([promise, escapePromise]);

  race.then((result) => {
    if (result === "timeout") {
      delete promises[id];
      // eslint-disable-next-line no-console
      console.error(`[hashDataMapAsync] Worker did not respond in time. Falling back to main thread. Job ID: ${id}`);
      const result = hashDataMap(map);

      resolve(result);
    }
  });

  return promise as Promise<{
    [K in keyof R]: string;
  }>;
}
