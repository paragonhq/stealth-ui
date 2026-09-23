"use client";
import { useEffect, useRef } from "react";
import { type ToastOptions, useToast } from "@/components/ui/toast";

export { ToastProvider, Toaster } from "@/components/ui/toast";

type Message = string | Omit<ToastOptions, "id" | "tone" | "action" | "progress">;
type Resolver<A> = Message | ((arg: A) => Message);

export type PromiseToastMessages<T> = {
  loading: Message;
  success: Resolver<T>;
  error: Resolver<unknown>;
  /** Shown when the person cancels. */
  canceled?: Message;
};

export type PromiseTaskContext = {
  /** Report 0–1, optionally with a new description ("2.4 of 6.1 MB"). */
  progress: (value: number, description?: React.ReactNode) => void;
  /** Aborted when the person presses Cancel. Pass it to fetch. */
  signal: AbortSignal;
};

/** A promise, or a function that starts the work; only a function can report progress, be canceled or be retried. */
export type PromiseTask<T> = Promise<T> | ((ctx: PromiseTaskContext) => Promise<T>);

export type PromiseToastOptions<T> = {
  /** Reuse an id to run again in the same toast. */
  id?: string;
  /** Show a Cancel action while loading. A string sets its label. Needs a task function. */
  cancel?: boolean | string;
  /** Show a Try again action on failure that reruns the task in place. A string sets its label. Needs a task function. */
  retry?: boolean | string;
  /** The spinner stays at least this long, so a fast success still reads as loading then done. */
  minDuration?: number;
  onSuccess?: (value: T) => void;
  onError?: (error: unknown) => void;
};

// Each state replaces the copy of the one before it, so a loading description never lingers on the result.
const resolve = <A,>(r: Resolver<A>, arg: A): Exclude<Message, string> => {
  const m = typeof r === "function" ? r(arg) : r;
  return { title: undefined, description: undefined, icon: undefined, ...(typeof m === "string" ? { title: m } : m) };
};

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Binds a toast to a piece of async work. The toast opens with a spinner,
 * follows progress if the task reports it, and turns into a tick or a cross
 * in place when the work settles. Retry and Cancel keep the same toast.
 */
export function usePromiseToast() {
  const toast = useToast();
  // Keep the latest API for tasks that outlive the render that started them.
  const api = useRef(toast);
  useEffect(() => {
    api.current = toast;
  });
  const frames = useRef(new Set<number>());
  useEffect(() => {
    const pending = frames.current;
    return () => pending.forEach((f) => cancelAnimationFrame(f));
  }, []);

  function promise<T>(task: PromiseTask<T>, messages: PromiseToastMessages<T>, options: PromiseToastOptions<T> = {}): Promise<T> {
    const { cancel, retry, minDuration = 600, onSuccess, onError } = options;
    const rerunnable = typeof task === "function";
    const id = options.id ?? `promise-${Math.random().toString(36).slice(2)}`;
    let attempt = 0;

    const run = (first: boolean): Promise<T> => {
      const current = ++attempt;
      const controller = new AbortController();
      const started = performance.now();
      let canceled = false;
      let frame = 0;
      let latest: { value: number; description?: React.ReactNode } | null = null;

      const loading = resolve(messages.loading, undefined);
      const cancelAction =
        cancel && rerunnable
          ? {
              label: typeof cancel === "string" ? cancel : "Cancel",
              onClick: (e: React.MouseEvent) => {
                e.preventDefault();
                canceled = true;
                controller.abort();
                api.current.update(id, { ...resolve(messages.canceled ?? "Canceled", undefined), tone: "neutral", progress: undefined, action: undefined, timeout: 3000 });
              },
            }
          : undefined;

      const opening = { ...loading, tone: "loading" as const, progress: undefined, action: cancelAction, timeout: 0 };
      if (first) api.current.add({ ...opening, id });
      else api.current.update(id, opening);

      // Progress can fire hundreds of times a second; paint it once per frame.
      const progress = (value: number, description?: React.ReactNode) => {
        latest = { value, description };
        if (frame) return;
        frame = requestAnimationFrame(() => {
          frames.current.delete(frame);
          frame = 0;
          if (canceled || current !== attempt || !latest) return;
          api.current.update(id, { progress: latest.value, ...(latest.description !== undefined && { description: latest.description }) });
        });
        frames.current.add(frame);
      };

      const work = typeof task === "function" ? task({ progress, signal: controller.signal }) : task;

      const settle = async (apply: () => void) => {
        await wait(Math.max(0, minDuration - (performance.now() - started)));
        if (frame) cancelAnimationFrame(frame);
        if (canceled || current !== attempt) return;
        apply();
      };

      work.then(
        (value) =>
          settle(() => {
            api.current.update(id, { ...resolve(messages.success, value), tone: "success", action: undefined, ...(latest && { progress: 1 }) });
            onSuccess?.(value);
          }),
        (error) =>
          settle(() => {
            const retryAction =
              retry && rerunnable
                ? {
                    label: typeof retry === "string" ? retry : "Try again",
                    onClick: (e: React.MouseEvent) => {
                      e.preventDefault();
                      run(false).catch(() => {});
                    },
                  }
                : undefined;
            api.current.update(id, { ...resolve(messages.error, error), tone: "error", action: retryAction, ...(latest && { progress: latest.value }) });
            onError?.(error);
          }),
      );
      return work;
    };

    return run(true);
  }

  return { promise, close: toast.close };
}
