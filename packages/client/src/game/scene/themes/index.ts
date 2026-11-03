// 방 테마 등록부. 테마마다 파일 하나(ThemeBuilder)를 둔다.
import type { ThemeId } from '@alkkagi/shared';
import type { ThemeBuilder } from '../stage-kit.ts';
import { buildBarTheme } from './bar.ts';
import { buildBeachTheme } from './beach.ts';
import { buildClassroomTheme } from './classroom.ts';
import { buildRooftopTheme } from './rooftop.ts';

export const THEMES: Record<ThemeId, ThemeBuilder> = {
  bar: buildBarTheme,
  rooftop: buildRooftopTheme,
  classroom: buildClassroomTheme,
  beach: buildBeachTheme,
};
