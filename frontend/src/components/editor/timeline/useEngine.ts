import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  Scene,
  TimelineClip,
  TimelineData,
  TimelineTrack,
} from "../../../types";
import {
  GUTTER_W,
  MIN_DUR,
  PX_DEFAULT,
  PX_MAX,
  PX_MIN,
  RIGHT_PAD,
  RULER_H,
  TRACK_BY_ID,
  TRACK_ROWS,
  compatibleTracks,
} from "./constants";
import { applySnap, clamp, fadeGain, freshId, round2, silenceBounds, snapTargets } from "./utils";
import { decodePeaks } from "./peaks";
import { getCachedMediaDuration, resolveMediaDuration } from "./mediaMeta";

interface DragState {
  mode: "move" | "trim-l" | "trim-r";
  clipId: string;
  startX: number;
  orig: TimelineClip;
  targets: number[];
  moved: boolean;
}

interface RowState {
  muted: boolean;
  locked: boolean;
}

interface EngineActions {
  togglePlay: () => void;
  splitAtPlayhead: () => void;
  undo: () => void;
  redo: () => void;
  deleteSelected: (ripple: boolean) => void;
  duplicateSelected: () => void;
  step: (frames: number) => void;
  goHome: () => void;
  goEnd: () => void;
  toggleMarkerKey: () => void;
  zoomInCenter: () => void;
  zoomOutCenter: () => void;
  deselect: () => void;
}

const FRAME_SNAP_PX = 8;

export function useTimelineEngine(
  timeline: TimelineData,
  scenes: Scene[],
  mediaUrl: (p: string | null | undefined) => string,
  onChange: (tl: TimelineData) => void,
) {
  const [px, setPx] = useState(PX_DEFAULT);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [time, setTimeState] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [snapOn, setSnapOn] = useState(true);
  const [rippleOn, setRippleOn] = useState(false);
  const [fps, setFps] = useState(30);
  const [markers, setMarkers] = useState<number[]>([]);
  const [collapsed, setCollapsed] = useState<
    Partial<Record<TimelineTrack, boolean>>
  >({});
  const [rowStates, setRowStates] = useState<
    Partial<Record<TimelineTrack, RowState>>
  >({});
  const rowStatesHydrated = useRef<string>("");
  const [draft, setDraft] = useState<{ clips: TimelineClip[] } | null>(null);
  const [snapLine, setSnapLine] = useState<number | null>(null);
  const [hoverRow, setHoverRow] = useState<TimelineTrack | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [viewW, setViewW] = useState(900);
  const [, bumpHistory] = useState(0);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const ticksRef = useRef<HTMLDivElement | null>(null);
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);
  const fittedRef = useRef(false);
  const pendingZoom = useRef<{ t: number; vx: number } | null>(null);
  const historyRef = useRef<{ past: TimelineData[]; future: TimelineData[] }>({
    past: [],
    future: [],
  });
  const lastMerge = useRef({ key: "", t: 0 });
  const dragRef = useRef<DragState | null>(null);
  const draftMirror = useRef<TimelineClip[] | null>(null);
  const audioPool = useRef<Map<string, HTMLAudioElement>>(new Map());

  const pxRef = useRef(px);
  pxRef.current = px;

  useEffect(() => {
    const sig = JSON.stringify(timeline.track_states ?? {});
    if (sig === rowStatesHydrated.current) return;
    rowStatesHydrated.current = sig;
    setRowStates(
      (timeline.track_states ?? {}) as Partial<
        Record<TimelineTrack, RowState>
      >,
    );
  }, [timeline.track_states]);

  const timeRef = useRef(time);
  timeRef.current = time;
  const playingRef = useRef(playing);
  playingRef.current = playing;

  const clips = draft ? draft.clips : timeline.clips;
  const clipsRef = useRef(clips);
  clipsRef.current = clips;

  const totalDuration = useMemo(() => {
    let anyEnd = -1;
    for (const c of clips) {
      const e = c.start + c.duration;
      anyEnd = Math.max(anyEnd, e);
    }
    return Math.max(anyEnd, 0);
  }, [clips]);
  const totalRef = useRef(totalDuration);
  totalRef.current = totalDuration;

  const sceneById = useMemo(
    () => new Map(scenes.map((s) => [s.id, s])),
    [scenes],
  );
  const clipMap = useMemo(() => new Map(clips.map((c) => [c.id, c])), [clips]);
  const selected = selectedId ? clipMap.get(selectedId) ?? null : null;

  const rowStateOf = useCallback(
    (id: TimelineTrack): RowState =>
      rowStates[id] ?? { muted: false, locked: false },
    [rowStates],
  );
  const rowHeight = useCallback(
    (id: TimelineTrack) => {
      const def = TRACK_BY_ID[id];
      return collapsed[id] ? def.collapsedHeight : def.height;
    },
    [collapsed],
  );

  const contentW = Math.max(
    Math.round(totalDuration * px + RIGHT_PAD),
    Math.max(320, viewW - GUTTER_W - 2),
  );

  const commit = useCallback(
    (next: TimelineData, mergeKey?: string) => {
      const now = Date.now();
      const merge =
        !!mergeKey &&
        lastMerge.current.key === mergeKey &&
        now - lastMerge.current.t < 900;
      if (!merge) {
        const past = historyRef.current.past;
        past.push(timeline);
        if (past.length > 100) past.shift();
        historyRef.current.future = [];
      }
      lastMerge.current = { key: mergeKey ?? "", t: merge ? now : 0 };
      bumpHistory((v) => v + 1);
      onChange(next);
    },
    [timeline, onChange],
  );

  const buildNext = useCallback(
    (nextClips: TimelineClip[]): TimelineData => {
      let d = timeline.duration;
      for (const c of nextClips) d = Math.max(d, c.start + c.duration);
      return { ...timeline, clips: nextClips, duration: round2(d) };
    },
    [timeline],
  );

  const srcCapOf = useCallback(
    (c: TimelineClip): number => {
      const url = c.audio_path ?? c.video_path;
      if (!url) return Infinity;
      const kind = c.audio_path ? "audio" : "video";
      const d = getCachedMediaDuration(mediaUrl(url), kind);
      if (d == null || !(d > 0)) return Infinity;
      const speed = c.speed || 1.0;
      const rawMax = d - (c.audio_path ? c.audio_in ?? 0 : 0);
      return Math.max(MIN_DUR, rawMax / speed);
    },
    [mediaUrl],
  );

  const undo = useCallback(() => {
    const h = historyRef.current;
    if (h.past.length === 0) return;
    const prev = h.past.pop()!;
    h.future.push(timeline);
    lastMerge.current = { key: "", t: 0 };
    bumpHistory((v) => v + 1);
    onChange(prev);
  }, [timeline, onChange]);

  const redo = useCallback(() => {
    const h = historyRef.current;
    if (h.future.length === 0) return;
    const next = h.future.pop()!;
    h.past.push(timeline);
    lastMerge.current = { key: "", t: 0 };
    bumpHistory((v) => v + 1);
    onChange(next);
  }, [timeline, onChange]);

  const canUndo = historyRef.current.past.length > 0;
  const canRedo = historyRef.current.future.length > 0;

  const patchClip = useCallback(
    (id: string, patch: Partial<TimelineClip>, mergeKey?: string) => {
      const nextPatch = { ...patch };
      const target = clipsRef.current.find((c) => c.id === id);
      if (target) {
        if (
          typeof nextPatch.speed === "number" &&
          isFinite(nextPatch.speed) &&
          nextPatch.speed > 0
        ) {
          const oldSpeed = target.speed || 1.0;
          const newSpeed = nextPatch.speed;
          if (
            newSpeed !== oldSpeed &&
            typeof nextPatch.duration !== "number"
          ) {
            const baseMediaLength = target.duration * oldSpeed;
            const newDuration = Math.max(
              MIN_DUR,
              round2(baseMediaLength / newSpeed),
            );
            nextPatch.duration = newDuration;
          }
        }
        if (typeof nextPatch.duration === "number") {
          const updatedClip = { ...target, ...nextPatch };
          nextPatch.duration = round2(
            Math.min(nextPatch.duration, srcCapOf(updatedClip)),
          );
          if (nextPatch.duration < MIN_DUR) nextPatch.duration = MIN_DUR;
        }
      }
      commit(
        buildNext(
          clipsRef.current.map((c) =>
            c.id === id ? { ...c, ...nextPatch } : c,
          ),
        ),
        mergeKey,
      );
    },
    [buildNext, commit, srcCapOf],
  );

  const splitClipAt = useCallback(
    (clip: TimelineClip, t: number): boolean => {
      if (
        t <= clip.start + MIN_DUR ||
        t >= clip.start + clip.duration - MIN_DUR
      )
        return false;
      const offset = round2(t - clip.start);
      const right: TimelineClip = {
        ...clip,
        id: freshId("c"),
        start: t,
        duration: round2(clip.duration - offset),
      };
      if (right.audio_path) {
        right.audio_in = Math.max(0, round2((clip.audio_in ?? 0) + offset));
        right.fade_in = 0;
      }
      const left: TimelineClip = { ...clip, duration: offset, fade_out: 0 };
      commit(
        buildNext(
          clipsRef.current.flatMap((c) =>
            c.id === clip.id ? [left, right] : [c],
          ),
        ),
      );
      setSelectedId(right.id);
      return true;
    },
    [buildNext, commit],
  );

  const splitAtPlayhead = useCallback(() => {
    const t = timeRef.current;
    const sel = selectedId ? clipMap.get(selectedId) : null;
    if (sel && !sel.locked && !rowStateOf(sel.track).locked) {
      if (splitClipAt(sel, t)) return;
    }
    const under = clipsRef.current.find(
      (c) =>
        t > c.start + MIN_DUR &&
        t < c.start + c.duration - MIN_DUR &&
        !c.locked &&
        !rowStateOf(c.track).locked,
    );
    if (under) splitClipAt(under, t);
  }, [selectedId, clipMap, splitClipAt, rowStateOf]);

  const duplicateClip = useCallback(
    (clip: TimelineClip) => {
      const copy: TimelineClip = {
        ...clip,
        id: freshId("d"),
        start: round2(clip.start + clip.duration),
      };
      commit(buildNext([...clipsRef.current, copy]));
      setSelectedId(copy.id);
    },
    [buildNext, commit],
  );

  const deleteClipOp = useCallback(
    (clip: TimelineClip, ripple: boolean) => {
      let rest = clipsRef.current.filter((c) => c.id !== clip.id);
      if (ripple) {
        rest = rest.map((c) =>
          c.track === clip.track && c.start >= clip.start - 1e-6
            ? { ...c, start: round2(Math.max(0, c.start - clip.duration)) }
            : c,
        );
      }
      commit(buildNext(rest));
      setSelectedId((s) => (s === clip.id ? null : s));
    },
    [buildNext, commit],
  );

  const addClip = useCallback(
    (clip: TimelineClip) => {
      commit(buildNext([...clipsRef.current, clip]));
      setSelectedId(clip.id);
    },
    [buildNext, commit],
  );

  const removeSilentEdges = useCallback(
    async (clipId: string) => {
      const clip = clipsRef.current.find((c) => c.id === clipId);
      if (!clip?.audio_path) return;
      try {
        const data = await decodePeaks(mediaUrl(clip.audio_path));
        if (!data.real) return;
        const bounds = silenceBounds(data.peaks, data.duration);
        if (!bounds) return;
        const maxTrim = Math.max(0, clip.duration - MIN_DUR);
        const lead = Math.min(bounds.lead, maxTrim);
        const tail = Math.min(bounds.tail, Math.max(0, maxTrim - lead));
        if (lead < 0.05 && tail < 0.05) return;
        commit(
          buildNext(
            clipsRef.current.map((c) =>
              c.id === clipId
                ? {
                    ...c,
                    start: round2(c.start + lead),
                    duration: round2(c.duration - lead - tail),
                    audio_in: Math.max(
                      0,
                      round2((c.audio_in ?? 0) + lead),
                    ),
                  }
                : c,
            ),
          ),
          "silence:" + clipId,
        );
      } catch {
        return;
      }
    },
    [buildNext, commit, mediaUrl],
  );

  const extendToSource = useCallback(
    async (clipId: string) => {
      const clip = clipsRef.current.find((c) => c.id === clipId);
      if (!clip) return;
      const url = clip.audio_path ?? clip.video_path;
      if (!url) return;
      const kind = clip.audio_path ? "audio" : "video";
      const resolved = mediaUrl(url);
      let d = getCachedMediaDuration(resolved, kind);
      if (d == null) {
        try {
          d = await resolveMediaDuration(resolved, kind);
        } catch {
          return;
        }
      }
      if (d == null || !(d > 0)) return;
      const cap = Math.max(
        MIN_DUR,
        d - (clip.audio_path ? clip.audio_in ?? 0 : 0),
      );
      const nd = round2(cap);
      if (nd <= clip.duration + 0.05) return;
      commit(
        buildNext(
          clipsRef.current.map((c) =>
            c.id === clipId ? { ...c, duration: nd } : c,
          ),
        ),
        "ext:" + clipId,
      );
    },
    [buildNext, commit, mediaUrl],
  );

  const closeGaps = useCallback(
    (track?: TimelineTrack) => {
      const tracks = track
        ? [track]
        : Array.from(new Set(clipsRef.current.map((c) => c.track)));
      let changed = false;
      let nextClips = clipsRef.current;
      for (const t of tracks) {
        const ordered = nextClips
          .filter((c) => c.track === t)
          .sort((a, b) => a.start - b.start);
        let cursor = 0;
        for (const c of ordered) {
          if (c.start > cursor + 1e-6) {
            const delta = c.start - cursor;
            nextClips = nextClips.map((x) =>
              x.id === c.id ? { ...x, start: round2(x.start - delta) } : x,
            );
            changed = true;
          }
          cursor =
            Math.max(cursor, c.start) +
            nextClips.find((x) => x.id === c.id)!.duration;
        }
      }
      if (changed) commit(buildNext(nextClips), "gaps");
    },
    [buildNext, commit],
  );

  const adjacentRow = useCallback((track: TimelineTrack, dir: -1 | 1) => {    const compat = compatibleTracks(track);
    const ordered = TRACK_ROWS.map((r) => r.id).filter((id) =>
      compat.includes(id),
    );
    return ordered[ordered.indexOf(track) + dir];
  }, []);

  const moveClipRow = useCallback(
    (clip: TimelineClip, dir: -1 | 1) => {
      const target = adjacentRow(clip.track, dir);
      if (target) patchClip(clip.id, { track: target });
    },
    [adjacentRow, patchClip],
  );

  const addTextClip = useCallback(
    (at?: number) => {
      const start = round2(Math.max(0, at ?? timeRef.current));
      const clip: TimelineClip = {
        id: freshId("t"),
        scene_id: -1,
        track: "text",
        start,
        duration: 3,
        image_path: null,
        video_path: null,
        audio_path: null,
        audio_in: 0,
        audio_out: null,
        volume: 1,
        text: "New caption",
      };
      commit(buildNext([...clipsRef.current, clip]));
      setSelectedId(clip.id);
      window.setTimeout(() => textAreaRef.current?.select(), 80);
    },
    [buildNext, commit],
  );

  const trimSelectedEdge = useCallback(
    (edge: "start" | "end") => {
      const clip = selected;
      if (!clip || clip.locked || rowStateOf(clip.track).locked) return;
      const t = timeRef.current;
      if (edge === "start") {
        if (t <= clip.start + MIN_DUR) return;
        const delta = round2(t - clip.start);
        commit(
          buildNext(
            clipsRef.current.map((c) =>
              c.id === clip.id
                ? {
                    ...c,
                    start: t,
                    duration: round2(c.duration - delta),
                    audio_in: c.audio_path
                      ? Math.max(0, round2((c.audio_in ?? 0) + delta))
                      : c.audio_in,
                  }
                : c,
            ),
          ),
        );
      } else {
        if (t >= clip.start + clip.duration - MIN_DUR) return;
        commit(
          buildNext(
            clipsRef.current.map((c) =>
              c.id === clip.id ? { ...c, duration: round2(t - c.start) } : c,
            ),
          ),
        );
      }
    },
    [selected, buildNext, commit, rowStateOf],
  );

  const syncAudio = useCallback(
    (t: number) => {
      const pool = audioPool.current;
      const want = new Map<
        string,
        { src: string; vol: number; offset: number }
      >();
      for (const c of clipsRef.current) {
        if (!c.audio_path || c.track === "video" || c.track === "text")
          continue;
        if (!(t >= c.start && t < c.start + c.duration)) continue;
        const rs = rowStateOf(c.track);
        if (rs.muted || c.muted) continue;
        want.set(c.id, {
          src: mediaUrl(c.audio_path),
          vol: clamp(c.volume * fadeGain(c, t - c.start), 0, 1),
          offset: Math.max(0, (c.audio_in ?? 0) + (t - c.start)),
          speed: c.speed || 1.0,
        });
      }
      if (want.size === 0) {
        for (const c of clipsRef.current) {
          if (c.track !== "video") continue;
          const srcFile = c.audio_path ?? c.video_path;
          if (!srcFile) continue;
          if (!(t >= c.start && t < c.start + c.duration)) continue;
          if (c.muted || rowStateOf("video").muted) continue;
          want.set(c.id, {
            src: mediaUrl(srcFile),
            vol: clamp(c.volume * fadeGain(c, t - c.start), 0, 1),
            offset: Math.max(0, (c.audio_in ?? 0) + (t - c.start)),
            speed: c.speed || 1.0,
          });
          break;
        }
      }
      for (const [id, el] of pool) {
        if (!want.has(id)) {
          el.pause();
          pool.delete(id);
        }
      }
      for (const [id, cfg] of want) {
        let el = pool.get(id);
        if (!el) {
          el = new Audio();
          el.preload = "auto";
          pool.set(id, el);
        }
        if (el.getAttribute("src") !== cfg.src) {
          el.setAttribute("src", cfg.src);
          try {
            el.currentTime = cfg.offset;
          } catch {
            /* not seekable yet */
          }
        }
        el.volume = cfg.vol;
        el.playbackRate = (cfg as any).speed || 1.0;
        if (playingRef.current) {
          if (Math.abs(el.currentTime - cfg.offset) > 0.35) {
            try {
              el.currentTime = cfg.offset;
            } catch {
              /* not seekable yet */
            }
          }
          void el.play().catch(() => {});
        } else if (!el.paused) {
          el.pause();
        }
      }
    },
    [mediaUrl, rowStateOf],
  );

  const syncAudioRef = useRef(syncAudio);
  syncAudioRef.current = syncAudio;

  const setTime = useCallback(
    (t: number) => {
      const nt = clamp(round2(t), 0, totalRef.current);
      timeRef.current = nt;
      setTimeState(nt);
      syncAudioRef.current(nt);
    },
    [],
  );

  const clientXToTime = useCallback((clientX: number) => {
    const r = ticksRef.current?.getBoundingClientRect();
    if (!r) return timeRef.current;
    return (clientX - r.left) / pxRef.current;
  }, []);

  const pausePlayback = useCallback(() => {
    if (playingRef.current) {
      playingRef.current = false;
      setPlaying(false);
    }
  }, []);

  const handleScrub = useCallback(
    (clientX: number) => {
      pausePlayback();
      setTime(clientXToTime(clientX));
    },
    [clientXToTime, pausePlayback, setTime],
  );

  const togglePlay = useCallback(() => {
    if (playingRef.current) {
      playingRef.current = false;
      setPlaying(false);
      syncAudioRef.current(timeRef.current);
      return;
    }
    if (clipsRef.current.length === 0) return;
    if (timeRef.current >= totalRef.current - 0.01) setTime(0);
    playingRef.current = true;
    setPlaying(true);
  }, [setTime]);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const nt = timeRef.current + dt;
      if (nt >= totalRef.current) {
        timeRef.current = totalRef.current;
        setTimeState(totalRef.current);
        playingRef.current = false;
        setPlaying(false);
        syncAudioRef.current(totalRef.current);
        return;
      }
      timeRef.current = nt;
      setTimeState(nt);
      syncAudioRef.current(nt);
      const el = scrollRef.current;
      if (el) {
        const x = nt * pxRef.current;
        const vw = el.clientWidth - GUTTER_W;
        if (x > el.scrollLeft + vw - 24) {
          el.scrollLeft = Math.max(0, x - vw * 0.25);
        } else if (x < el.scrollLeft) {
          el.scrollLeft = Math.max(0, x - 40);
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  useEffect(() => {
    const pool = audioPool.current;
    return () => {
      for (const el of pool.values()) el.pause();
      pool.clear();
    };
  }, []);

  const beginDrag = useCallback(
    (clientX: number, clip: TimelineClip, mode: DragState["mode"]) => {
      if (clip.locked || rowStateOf(clip.track).locked) return false;
      pausePlayback();
      setSelectedId(clip.id);
      dragRef.current = {
        mode,
        clipId: clip.id,
        startX: clientX,
        orig: { ...clip },
        targets: snapTargets({
          clips: clipsRef.current,
          excludeId: clip.id,
          playhead: timeRef.current,
          markers,
        }),
        moved: false,
      };
      setDraggingId(clip.id);
      return true;
    },
    [markers, pausePlayback, rowStateOf],
  );

  const runDragMove = useCallback(
    (ev: PointerEvent) => {
      const st = dragRef.current;
      if (!st) return;
      const dx = ev.clientX - st.startX;
      if (!st.moved && st.mode === "move" && Math.abs(dx) < 3) return;
      st.moved = true;
      const secDx = dx / pxRef.current;
      const o = st.orig;
      const patch: Partial<TimelineClip> = {};
      let line: number | null = null;

      if (st.mode === "move") {
        const raw = Math.max(0, o.start + secDx);
        const snapA = applySnap(raw, st.targets, pxRef.current, snapOn);
        const snapEnd = applySnap(
          raw + o.duration,
          st.targets,
          pxRef.current,
          snapOn,
        );
        let start = raw;
        const dA = snapA.snapped ? Math.abs(snapA.time - raw) : Infinity;
        const dB = snapEnd.snapped
          ? Math.abs(snapEnd.time - o.duration - raw)
          : Infinity;
        if (dA <= dB && snapA.snapped) {
          start = snapA.time;
          line = snapA.time;
        } else if (snapEnd.snapped) {
          start = snapEnd.time - o.duration;
          line = snapEnd.time;
        }
        patch.start = round2(Math.max(0, start));

        const rect = contentRef.current?.getBoundingClientRect();
        if (rect) {
          let top = rect.top + RULER_H;
          let hovered: TimelineTrack | null = null;
          for (const r of TRACK_ROWS) {
            const h = rowHeight(r.id);
            if (ev.clientY >= top && ev.clientY < top + h) {
              hovered = r.id;
              break;
            }
            top += h;
          }
          const compat = compatibleTracks(o.track);
          if (hovered && compat.includes(hovered) && hovered !== o.track) {
            patch.track = hovered;
            setHoverRow(hovered);
          } else {
            setHoverRow(null);
          }
        }
        const sc = scrollRef.current;
        if (sc) {
          const r = sc.getBoundingClientRect();
          if (ev.clientX > r.right - 28) sc.scrollLeft += 12;
          else if (ev.clientX < r.left + GUTTER_W + 28) sc.scrollLeft -= 12;
        }
      } else if (st.mode === "trim-l") {
        const capD = srcCapOf(o);
        const maxExtendLeft = isFinite(capD)
          ? Math.max(0, capD - o.duration)
          : Infinity;
        const minStart = o.audio_path
          ? Math.max(0, o.start - Math.min(o.audio_in ?? 0, maxExtendLeft))
          : Math.max(0, o.start - maxExtendLeft);
        const s = applySnap(o.start + secDx, st.targets, pxRef.current, snapOn);
        const start = clamp(
          s.time,
          minStart,
          o.start + o.duration - MIN_DUR,
        );
        line = s.snapped ? s.time : null;
        patch.start = round2(start);
        patch.duration = round2(o.start + o.duration - start);
        if (o.audio_path) {
          patch.audio_in = Math.max(
            0,
            round2((o.audio_in ?? 0) + (start - o.start)),
          );
        }
      } else {
        const capD = srcCapOf(o);
        const s = applySnap(
          o.start + o.duration + secDx,
          st.targets,
          pxRef.current,
          snapOn,
        );
        const end = clamp(
          Math.max(o.start + MIN_DUR, s.time),
          o.start + MIN_DUR,
          isFinite(capD) ? o.start + capD : Infinity,
        );
        line = s.snapped && end === s.time ? s.time : null;
        patch.duration = round2(end - o.start);
      }

      setSnapLine(line);
      const nextClips = clipsRef.current.map((c) =>
        c.id === st.clipId ? { ...c, ...patch } : c,
      );
      draftMirror.current = nextClips;
      setDraft({ clips: nextClips });
    },
    [rowHeight, snapOn, srcCapOf],
  );

  const finishDrag = useCallback(() => {
    const st = dragRef.current;
    dragRef.current = null;
    setDraggingId(null);
    setSnapLine(null);
    setHoverRow(null);
    if (st && st.moved && draftMirror.current) {
      let finalClips = draftMirror.current;
      if (rippleOn && st.mode === "trim-r") {
        const o = st.orig;
        const trimmed = finalClips.find((c) => c.id === st.clipId);
        if (trimmed && Math.abs(trimmed.start - o.start) < 1e-6) {
          const delta = o.duration - trimmed.duration;
          if (delta > 0.01) {
            const oldEnd = o.start + o.duration;
            finalClips = finalClips.map((c) =>
              c.id !== st.clipId && c.start >= oldEnd - 0.02
                ? { ...c, start: round2(Math.max(0, c.start - delta)) }
                : c,
            );
          }
        }
      }
      commit(buildNext(finalClips));
    }
    draftMirror.current = null;
    setDraft(null);
  }, [buildNext, commit, rippleOn]);

  const onClipPointerDown = useCallback(
    (e: React.PointerEvent, clip: TimelineClip) => {
      if (e.button !== 0) return;
      const target = e.target as HTMLElement;
      let mode: DragState["mode"] = "move";
      if (target.classList.contains("vtl-hl")) mode = "trim-l";
      else if (target.classList.contains("vtl-hr")) mode = "trim-r";
      if (!beginDrag(e.clientX, clip, mode)) return;
      e.preventDefault();
      const move = (ev: PointerEvent) => runDragMove(ev);
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        finishDrag();
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    },
    [beginDrag, finishDrag, runDragMove],
  );

  const setPxZoom = useCallback((v: number) => {
    setPx(clamp(Math.round(v), PX_MIN, PX_MAX));
  }, []);

  const zoomAt = useCallback((factor: number, clientX?: number) => {
    const el = scrollRef.current;
    if (!el) return;
    const elRect = el.getBoundingClientRect();
    const vx =
      clientX != null
        ? clientX - elRect.left
        : GUTTER_W + (el.clientWidth - GUTTER_W) / 2;
    const t = Math.max(
      0,
      (el.scrollLeft + vx - GUTTER_W) / pxRef.current,
    );
    pendingZoom.current = { t, vx };
    setPx(pxRef.current * factor);
  }, []);

  useLayoutEffect(() => {
    if (!pendingZoom.current) return;
    const { t, vx } = pendingZoom.current;
    pendingZoom.current = null;
    const el = scrollRef.current;
    if (el)
      el.scrollLeft = Math.max(0, t * px + GUTTER_W - vx);
  }, [px]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      zoomAt(Math.exp(-e.deltaY * 0.0016), e.clientX);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  const fitTimeline = useCallback(() => {
    const el = scrollRef.current;
    if (!el || totalDuration <= 0) return;
    const w = el.clientWidth - GUTTER_W - 40;
    setPx(w / totalDuration);
    el.scrollLeft = 0;
  }, [totalDuration]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setViewW(el.clientWidth));
    ro.observe(el);
    setViewW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (fittedRef.current || viewW <= 0) return;
    fittedRef.current = true;
    if (totalDuration > 45) {
      const w = viewW - GUTTER_W - 40;
      setPx(clamp(w / totalDuration, PX_MIN, PX_MAX));
    }
  }, [viewW, totalDuration]);

  const toggleMarker = useCallback((at?: number) => {
    const t = round2(at ?? timeRef.current);
    setMarkers((ms) => {
      const thresh = FRAME_SNAP_PX / pxRef.current;
      const hit = ms.find((m) => Math.abs(m - t) < thresh);
      if (hit != null) return ms.filter((m) => m !== hit);
      return [...ms, t].sort((a, b) => a - b);
    });
  }, []);

  const actionsRef = useRef<EngineActions | null>(null);
  actionsRef.current = {
    togglePlay,
    splitAtPlayhead,
    undo,
    redo,
    deleteSelected: (ripple: boolean) => {
      const c = selectedId ? clipMap.get(selectedId) : null;
      if (c) deleteClipOp(c, ripple);
    },
    duplicateSelected: () => {
      const c = selectedId ? clipMap.get(selectedId) : null;
      if (c) duplicateClip(c);
    },
    step: (frames: number) => {
      pausePlayback();
      setTime(timeRef.current + frames / fps);
    },
    goHome: () => {
      pausePlayback();
      setTime(0);
    },
    goEnd: () => {
      pausePlayback();
      setTime(totalRef.current);
    },
    toggleMarkerKey: () => toggleMarker(),
    zoomInCenter: () => zoomAt(1.25),
    zoomOutCenter: () => zoomAt(0.8),
    deselect: () => setSelectedId(null),
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tgt = e.target as HTMLElement | null;
      const tag = tgt?.tagName.toLowerCase() ?? "";
      if (
        tag === "input" ||
        tag === "textarea" ||
        tag === "select" ||
        tgt?.isContentEditable
      )
        return;
      const A = actionsRef.current;
      if (!A) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) A.redo();
        else A.undo();
      } else if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        A.redo();
      } else if (mod && e.key.toLowerCase() === "d") {
        e.preventDefault();
        A.duplicateSelected();
      } else if (e.code === "Space") {
        e.preventDefault();
        A.togglePlay();
      } else if (e.key === "s" || e.key === "S") {
        e.preventDefault();
        A.splitAtPlayhead();
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        A.deleteSelected(e.shiftKey);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        A.step(e.shiftKey ? -10 : -1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        A.step(e.shiftKey ? 10 : 1);
      } else if (e.key === "Home") {
        e.preventDefault();
        A.goHome();
      } else if (e.key === "End") {
        e.preventDefault();
        A.goEnd();
      } else if (e.key === "+" || e.key === "=") {
        A.zoomInCenter();
      } else if (e.key === "-" || e.key === "_") {
        A.zoomOutCenter();
      } else if (e.key === "m" || e.key === "M") {
        A.toggleMarkerKey();
      } else if (e.key === "Escape") {
        A.deselect();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const toggleRowFlag = useCallback(
    (id: TimelineTrack, flag: keyof RowState) => {
      const cur = rowStates[id] ?? { muted: false, locked: false };
      const nextAll = {
        ...rowStates,
        [id]: { ...cur, [flag]: !cur[flag] },
      } as Partial<Record<TimelineTrack, RowState>>;
      setRowStates(nextAll);
      rowStatesHydrated.current = JSON.stringify(nextAll);
      const past = historyRef.current.past;
      past.push(timeline);
      if (past.length > 100) past.shift();
      historyRef.current.future = [];
      lastMerge.current = { key: "", t: 0 };
      bumpHistory((v) => v + 1);
      onChange({
        ...timeline,
        clips: clipsRef.current,
        duration: totalRef.current,
        track_states: nextAll,
      });
    },
    [rowStates, timeline, onChange],
  );

  const muteAllVideoClips = useCallback(
    (mute: boolean) => {
      const nextClips = clipsRef.current.map((c) =>
        c.track === "video" ? { ...c, muted: mute } : c
      );
      clipsRef.current = nextClips;
      const past = historyRef.current.past;
      past.push(timeline);
      if (past.length > 100) past.shift();
      historyRef.current.future = [];
      lastMerge.current = { key: "", t: 0 };
      bumpHistory((v) => v + 1);

      const cur = rowStates.video ?? { muted: false, locked: false };
      const nextAll = {
        ...rowStates,
        video: { ...cur, muted: mute },
      } as Partial<Record<TimelineTrack, RowState>>;
      setRowStates(nextAll);
      rowStatesHydrated.current = JSON.stringify(nextAll);
      onChange({
        ...timeline,
        clips: nextClips,
        duration: totalRef.current,
        track_states: nextAll,
      });
    },
    [rowStates, timeline, onChange],
  );

  const clearMarkers = useCallback(() => setMarkers([]), []);

  const toggleCollapsed = useCallback((id: TimelineTrack) => {
    setCollapsed((c) => ({ ...c, [id]: !c[id] }));
  }, []);

  return {
    px,
    setPx: setPxZoom,
    time,
    playing,
    snapOn,
    setSnapOn,
    rippleOn,
    setRippleOn,
    fps,
    setFps,
    markers,
    toggleMarker,
    clearMarkers,
    zoomAt,
    clips,
    totalDuration,
    selectedId,
    setSelectedId,
    selected,
    sceneById,
    clipMap,
    canUndo,
    canRedo,
    undo,
    redo,
    commit,
    buildNext,
    patchClip,
    splitClipAt,
    splitAtPlayhead,
    duplicateClip,
    deleteClipOp,
    removeSilentEdges,
    extendToSource,
    addClip,
    closeGaps,
    moveClipRow,
    adjacentRow,
    addTextClip,
    trimSelectedEdge,
    setTime,
    clientXToTime,
    handleScrub,
    togglePlay,
    pausePlayback,
    onClipPointerDown,
    draggingId,
    snapLine,
    hoverRow,
    rowStateOf,
    rowHeight,
    toggleRowFlag,
    muteAllVideoClips,
    toggleCollapsed,
    collapsed,
    contentW,
    viewW,
    fitTimeline,
    scrollRef,
    contentRef,
    ticksRef,
    textAreaRef,
  };
}
