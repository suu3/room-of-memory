export interface RoomPalette {
  ink: string;
  paper: string;
  bone: string;
  memory: string;
  ember: string;
  slate: string;
  mist: string;
  deep: string;
  dusk: string;
  navy: string;
  olive: string;
}

const TOKEN_BY_KEY = {
  ink: "--color-ink",
  paper: "--color-paper",
  bone: "--color-bone",
  memory: "--color-memory",
  ember: "--color-ember",
  slate: "--color-scene-slate",
  mist: "--color-scene-mist",
  deep: "--color-scene-deep",
  dusk: "--color-scene-dusk",
  navy: "--color-scene-navy",
  olive: "--color-scene-olive",
} as const;

export function resolveRoomPalette(): RoomPalette {
  const styles = getComputedStyle(document.documentElement);
  const read = (token: (typeof TOKEN_BY_KEY)[keyof typeof TOKEN_BY_KEY]) =>
    styles.getPropertyValue(token).trim();

  return {
    ink: read(TOKEN_BY_KEY.ink),
    paper: read(TOKEN_BY_KEY.paper),
    bone: read(TOKEN_BY_KEY.bone),
    memory: read(TOKEN_BY_KEY.memory),
    ember: read(TOKEN_BY_KEY.ember),
    slate: read(TOKEN_BY_KEY.slate),
    mist: read(TOKEN_BY_KEY.mist),
    deep: read(TOKEN_BY_KEY.deep),
    dusk: read(TOKEN_BY_KEY.dusk),
    navy: read(TOKEN_BY_KEY.navy),
    olive: read(TOKEN_BY_KEY.olive),
  };
}
