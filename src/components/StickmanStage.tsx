import React from 'react';
import { 
  AbsoluteFill, 
  OffthreadVideo, 
  staticFile as remotionStaticFile,
  interpolate,
  useCurrentFrame,
  Easing
} from 'remotion';
import { noise2D } from '@remotion/noise';
import { SafeImage as Img } from './SafeImage';
import { PaperTextureWrapper } from './PaperTextureWrapper';

const TRANSPARENT_PIXEL = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

const resolveMedia = (path: string) => {
  if (!path || typeof path !== 'string') return TRANSPARENT_PIXEL;
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
    return path;
  }
  const cleanPath = path.replace(/^\/?public\//, '').replace(/^\//, '');
  if (cleanPath.trim() === '' || cleanPath.endsWith('/')) return TRANSPARENT_PIXEL;
  return remotionStaticFile(cleanPath);
};

export interface StickmanStageProps {
  scene: any;
  durationInFrames: number;
  index?: number;
}

/**
 * StickmanStage — Premium 2K Hand-Drawn Whiteboard Cinematic Stage
 * - Pure #FFFFFF Whiteboard Canvas (zero dark mode inversion)
 * - Dynamic Ken Burns Camera: alternating smooth push-in (1.0 -> 1.07) and pull-out (1.06 -> 1.0)
 * - Living Paper Micro-Drift: subtle organic pan & tilt bringing hand-drawn sketches to life
 * - Tactile PaperTextureWrapper with procedural grain & warm editorial vignette
 */
export const StickmanStage: React.FC<StickmanStageProps> = ({ scene, durationInFrames, index = 0 }) => {
  const frame = useCurrentFrame();
  const safeDuration = Math.max(1, durationInFrames);

  // 1. Resolve media source with robust fallbacks
  const sId = scene.scene_id || (index + 1);
  const fallbackAsset = `assets/scene_${String(sId).padStart(3, '0')}.webp`;
  const rawSrc = scene.image_url || scene.media_path || scene.media_paths?.[0] || scene.visual_asset || fallbackAsset;
  const mediaSrc = resolveMedia(rawSrc);
  const isVideo = typeof rawSrc === 'string' && (rawSrc.endsWith('.mp4') || rawSrc.endsWith('.webm') || rawSrc.endsWith('.mov'));

  // 2. Dynamic Cinematic Camera Engine
  const isEven = index % 2 === 0;
  const cameraScale = isEven
    ? interpolate(frame, [0, safeDuration], [1.0, 1.07], {
        easing: Easing.bezier(0.25, 0.1, 0.25, 1.0),
        extrapolateRight: 'clamp',
      })
    : interpolate(frame, [0, safeDuration], [1.06, 1.0], {
        easing: Easing.bezier(0.25, 0.1, 0.25, 1.0),
        extrapolateRight: 'clamp',
      });

  // Organic micro-drift (living paper effect)
  const panX = noise2D('stick_px', frame * 0.015, index * 11.3) * 4;
  const panY = noise2D('stick_py', frame * 0.015, index * 11.3) * 3;
  const rot = noise2D('stick_rot', frame * 0.012, index * 11.3) * 0.3;

  return (
    <PaperTextureWrapper>
      <AbsoluteFill style={{ backgroundColor: '#FFFFFF', overflow: 'hidden' }}>
        {/* 2K Main Stage Viewport with Dynamic Camera Motion */}
        <AbsoluteFill
          style={{
            transformOrigin: 'center center',
            transform: `scale(${cameraScale}) translate3d(${panX}px, ${panY}px, 0px) rotate(${rot}deg)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {isVideo ? (
            <OffthreadVideo
              src={mediaSrc}
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              muted
            />
          ) : (
            <Img
              src={mediaSrc}
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          )}
        </AbsoluteFill>
      </AbsoluteFill>
    </PaperTextureWrapper>
  );
};
