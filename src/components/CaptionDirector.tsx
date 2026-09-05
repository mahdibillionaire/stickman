import React from 'react';
import { AbsoluteFill, useVideoConfig, Sequence } from 'remotion';
import { GlassPillCaption } from './GlassPillCaption';
import { CinematicDocumentaryCaption } from './CinematicDocumentaryCaption';
import { HighlightReelCaption } from './HighlightReelCaption';
import { LiquidMirrorCaption } from './LiquidMirrorCaption';
import { PremiumLeftSpatial } from './PremiumLeftSpatial';
import { PremiumRightSpatial } from './PremiumRightSpatial';
import { KineticStack } from './KineticStack';

// ==========================================
// TIMING UTILITY
// ==========================================
export type WordTiming = {
    word: string;
    start: number;
    end: number;
    isHighlight?: boolean;
};

interface TimedChunk {
    words: any[];
    start_ms: number;
    end_ms: number;
}

function buildTimedChunks(words: any[]): TimedChunk[] {
    const chunks: TimedChunk[] = [];
    let cur: any[] = [];

    for (let i = 0; i < words.length; i++) {
        let w = words[i];

        // Merge WhisperX split contractions (e.g. "you", "'re")
        if (cur.length > 0 && /^[.,!?;:'']/.test(w.word)) {
            cur[cur.length - 1].word += w.word;
            cur[cur.length - 1].end_ms = w.end_ms;
        } else {
            cur.push({...w});
        }

        if (cur.length >= 6 || /[.!?]/.test(w.word) || i === words.length - 1) {
            chunks.push({
                words: cur,
                start_ms: cur[0].start_ms,
                end_ms: cur[cur.length - 1].end_ms
            });
            cur = [];
        }
    }
    return chunks;
}

// ==========================================
// LEGACY CAPTION DIRECTOR (kept for non-stickman scenes)
// ==========================================
export const CaptionDirector = ({ scene }: any) => {
    const { fps } = useVideoConfig();

    if (!scene) return null;

    const preset = scene.caption_preset || scene.visual?.caption_preset || 'GlassPillCaption';
    if (preset === 'none') return null;

    const words = scene.words || [];
    if (words.length === 0) return null;

    const sceneStartMs = scene.timing?.start_ms || 0;
    const durationFrames = Math.max(1, Math.round(((scene.timing?.duration_ms || 3000) / 1000) * fps));

    // HeroKineticPunch preset
    if (preset === 'HeroKineticCaption') {
        const hookWords = words.slice(0, 3).map((w: any) => w.word);
        return (
            <AbsoluteFill style={{ pointerEvents: 'none', zIndex: 100 }}>
                <KineticStack
                    words={hookWords}
                    side="left"
                    layoutType="A"
                    durationFrames={durationFrames}
                />
            </AbsoluteFill>
        );
    }

    const chunks = buildTimedChunks(words);

    return (
        <AbsoluteFill style={{ pointerEvents: 'none', zIndex: 100 }}>
            {chunks.map((chunk, i) => {
                const chunkStartFrame = Math.max(0, Math.round(((chunk.start_ms - sceneStartMs) / 1000) * fps));

                let chunkDurationFrames = Math.max(1, Math.round(((chunk.end_ms - chunk.start_ms) / 1000) * fps));

                if (i < chunks.length - 1) {
                    const nextStartFrame = Math.max(0, Math.round(((chunks[i+1].start_ms - sceneStartMs) / 1000) * fps));
                    chunkDurationFrames = Math.max(1, nextStartFrame - chunkStartFrame);
                } else {
                    chunkDurationFrames += 15;
                }

                const script: WordTiming[] = chunk.words.map((w) => {
                    const absStart = Math.max(0, Math.round(((w.start_ms - sceneStartMs) / 1000) * fps));
                    const absEnd   = Math.max(0, Math.round(((w.end_ms   - sceneStartMs) / 1000) * fps));
                    return {
                        word: w.word,
                        start: Math.max(0, absStart - chunkStartFrame),
                        end:   Math.max(0, absEnd   - chunkStartFrame),
                        isHighlight: w.isHighlight
                    };
                });

                let CaptionComponent = <GlassPillCaption script={script} />;
                if (preset === 'HighlightReelCaption')             CaptionComponent = <HighlightReelCaption script={script} />;
                else if (preset === 'PremiumLeftSpatial')           CaptionComponent = <PremiumLeftSpatial script={script} chunkIndex={i} />;
                else if (preset === 'PremiumRightSpatial')          CaptionComponent = <PremiumRightSpatial script={script} chunkIndex={i} />;
                else if (preset === 'LiquidMirrorCaption' || preset === 'LiquidMirror') CaptionComponent = <LiquidMirrorCaption script={script} />;
                else if (preset === 'CinematicDocumentaryCaption')  CaptionComponent = <CinematicDocumentaryCaption script={script} />;

                return (
                    <Sequence key={i} from={chunkStartFrame} durationInFrames={chunkDurationFrames}>
                        {CaptionComponent}
                    </Sequence>
                );
            })}
        </AbsoluteFill>
    );
};

// ==========================================
// GLOBAL CAPTION DIRECTOR
// ==========================================
// Renders ALL captions for ALL scenes in one single flat root-level track.
// This eliminates accumulated rounding drift from nested Sequences.
//
// OLD broken path (CaptionDirector inside per-scene Sequences):
//   frame = Math.round(scene.start_ms / fps)                      <- rounding #1
//         + Math.round((chunk.start_ms - scene.start_ms) / fps)   <- rounding #2
//         + Math.round((word.start_ms  - chunk.start_ms) / fps)   <- rounding #3
//   Over 200 scenes / 500 seconds these cascade into visible drift.
//
// NEW correct path — ONE Sequence per display chunk at absolute video frame:
//   chunkStartFrame = Math.round(chunk.start_ms / 1000 * fps)   <- rounding #1 ONLY
//   word.start      = Math.round(word.start_ms  / 1000 * fps) - chunkStartFrame
//   No nesting. No accumulation. Zero drift across the entire video.
// ==========================================
export const GlobalCaptionDirector = ({ scenes }: { scenes: any[] }) => {
    const { fps } = useVideoConfig();

    const allChunks: Array<TimedChunk & { preset: string }> = [];

    for (const scene of scenes) {
        const words = scene.words || [];
        if (words.length === 0) continue;
        if (scene.editorialVariants?.captionEnabled === false) continue;
        const preset = scene.caption_preset || scene.visual?.caption_preset || 'LiquidMirror';
        if (preset === 'none' || preset === 'HeroKineticCaption') continue;
        const blocked = ['topic_reveal', 'monolith', 'magnates_2.5d', 'two_part_whip'];
        if (blocked.includes(scene.scene_type)) continue;
        if (scene.diorama_payload  && Object.keys(scene.diorama_payload).length  > 0) continue;
        if (scene.monolith_payload && Object.keys(scene.monolith_payload).length > 0) continue;

        for (const chunk of buildTimedChunks(words)) {
            allChunks.push({ ...chunk, preset });
        }
    }

    return (
        <AbsoluteFill style={{ pointerEvents: 'none', zIndex: 100 }}>
            {allChunks.map((chunk, i) => {
                // ── Single rounding from absolute video milliseconds ──────────────────
                const chunkStartFrame = Math.max(0, Math.round((chunk.start_ms / 1000) * fps));

                // Hold chunk open until the next one starts — no flicker gaps between cuts
                const nextMs = i < allChunks.length - 1
                    ? allChunks[i + 1].start_ms
                    : chunk.end_ms + 500;
                const chunkDurFrames = Math.max(1, Math.round(((nextMs - chunk.start_ms) / 1000) * fps));

                // Word timings: absolute ms → absolute frame → offset from chunkStartFrame
                // ONE rounding per word. No cascaded error.
                const script: WordTiming[] = chunk.words.map((w) => {
                    const wStart = Math.round((w.start_ms / 1000) * fps);
                    const wEnd   = Math.round((w.end_ms   / 1000) * fps);
                    return {
                        word: w.word,
                        start: Math.max(0, wStart - chunkStartFrame),
                        end:   Math.max(1, wEnd   - chunkStartFrame),
                        isHighlight: w.isHighlight,
                    };
                });

                const p = chunk.preset;
                let CaptionComponent = <GlassPillCaption script={script} />;
                if (p === 'HighlightReelCaption')                     CaptionComponent = <HighlightReelCaption script={script} />;
                else if (p === 'PremiumLeftSpatial')                  CaptionComponent = <PremiumLeftSpatial script={script} chunkIndex={i} />;
                else if (p === 'PremiumRightSpatial')                 CaptionComponent = <PremiumRightSpatial script={script} chunkIndex={i} />;
                else if (p === 'LiquidMirrorCaption' || p === 'LiquidMirror') CaptionComponent = <LiquidMirrorCaption script={script} />;
                else if (p === 'CinematicDocumentaryCaption')         CaptionComponent = <CinematicDocumentaryCaption script={script} />;

                return (
                    <Sequence key={i} from={chunkStartFrame} durationInFrames={chunkDurFrames}>
                        {CaptionComponent}
                    </Sequence>
                );
            })}
        </AbsoluteFill>
    );
};
