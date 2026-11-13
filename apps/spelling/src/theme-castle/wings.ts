export interface WingInfo {
  superGroupId: string;
  number: number;
  name: string;
  rooms: Array<{ groupId: string; name: string }>;
}

const WING_DATA: Array<[string, [string, string, string, string]]> = [
  ['Gatehouse & Foundation', ['Gate', 'Drawbridge', 'Courtyard', 'Well']],
  ['Great Hall', ['Grand Arch', 'Hearth', 'Long Table', 'Banner Gallery']],
  ['Kitchen & Larder', ['Bakehouse', 'Pantry', 'Spice Rack', 'Cellar']],
  ['Library', ['Reading Nook', 'Scroll Shelf', 'Map Room', 'Scriptorium']],
  ['Chapel', ['Bell Porch', 'Choir Loft', 'Rose Window', 'Cloister']],
  ['Stables & Yard', ['Tack Room', 'Hayloft', 'Paddock', 'Smithy']],
  ['Watchtower', ['Spiral Stair', 'Lantern Room', 'Lookout', 'Battlement']],
  ['Armory', ['Shield Wall', 'Training Yard', 'Fletcher', 'Banner Store']],
  ['The Keep', ['Guardroom', 'Treasury', 'Council Chamber', 'Solar']],
  ['Crown Hall', ['Royal Stair', 'Tapestry Hall', 'Observatory', 'Crown Spire']],
];

export const CASTLE_WINGS: WingInfo[] = WING_DATA.map(([name, roomNames], wIdx) => {
  const wingNum = wIdx + 1;
  const superGroupId = `fry-wing-${String(wingNum).padStart(2, '0')}`;
  const rooms = roomNames.map((rName, rIdx) => {
    const setNum = wIdx * 4 + rIdx + 1;
    return {
      groupId: `fry-set-${String(setNum).padStart(3, '0')}`,
      name: rName,
    };
  });
  return { superGroupId, number: wingNum, name, rooms };
});

export function getWingInfo(superGroupId: string): WingInfo | undefined {
  return CASTLE_WINGS.find((w) => w.superGroupId === superGroupId);
}

export function getRoomName(groupId: string): string {
  if (groupId === 'family-words') return 'Family Words';
  for (const w of CASTLE_WINGS) {
    const r = w.rooms.find((rm) => rm.groupId === groupId);
    if (r) return `${w.name} — ${r.name}`;
  }
  return groupId;
}
