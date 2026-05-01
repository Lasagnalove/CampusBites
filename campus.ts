import { CampusBuilding, Coordinate, FoodDrop } from '../types';

export const CAMPUS_CENTER: Coordinate = {
  latitude: 37.6584,
  longitude: -122.0553,
};

export const CAMPUS_RECENTER: Coordinate = {
  latitude: 37.6566,
  longitude: -122.05468,
};

export const CAMPUS_BOUNDS = {
  southwest: {
    latitude: 37.65235,
    longitude: -122.0608,
  },
  northeast: {
    latitude: 37.6604,
    longitude: -122.052,
  },
};

export const CAMPUS_BUILDINGS: CampusBuilding[] = [
  {
    name: 'SF - Student & Faculty Support',
    shortName: 'SF',
    coordinate: { latitude: 37.6580851, longitude: -122.0545661 },
    description: 'Student & Faculty Support',
  },
  {
    name: 'CB - CORE Library',
    shortName: 'CB',
    coordinate: { latitude: 37.6551136, longitude: -122.0547856 },
    description: 'Main Student Hot Spot',
  },
  {
    name: 'UU-S - University Union South',
    shortName: 'UU-S',
    coordinate: { latitude: 37.6544754, longitude: -122.0555581 },
    description: 'Pioneers for HOPE Pantry',
  },
  {
    name: 'VBT - Valley Business & Tech',
    shortName: 'VBT',
    coordinate: { latitude: 37.6571069, longitude: -122.0550908 },
    description: 'CS and Business Hub',
  },
  {
    name: 'MI - Meiklejohn Hall',
    shortName: 'MI',
    coordinate: { latitude: 37.6536464, longitude: -122.0547853 },
    description: 'Meiklejohn Hall',
  },
  {
    name: 'DC - Dining Commons',
    shortName: 'DC',
    coordinate: { latitude: 37.6529519, longitude: -122.0536604 },
    description: 'Dining Commons',
  },
];

export const MAJORS = [
  'Computer Science',
  'Business',
  'Humanities',
  'Social Sciences',
  'Biology',
  'Engineering',
  'Psychology',
  'Undeclared',
];

export const CAMPUS_ROLES = [
  {
    value: 'student',
    label: 'Student',
    detail: 'Find and claim food drops',
  },
  {
    value: 'catering',
    label: 'Catering',
    detail: 'Pioneer Kitchen staff',
  },
] as const;

export const FOOD_TYPES = [
  'Pizza',
  'Sandwiches',
  'Veggie',
  'Pastries',
  'Burritos',
  'Salad',
  'Coffee',
  'Dessert',
];

export const CATERING_CLEAROUT_TYPE = 'Catering Clear-out';
export const DROP_DURATION_MS = 2 * 60 * 60 * 1000;
export const CATERING_CLEAROUT_DURATION_MS = 15 * 60 * 1000;
export const LOW_SERVING_THRESHOLD = 3;
export const WARMING_AGE_MS = 30 * 60 * 1000;
export const NOTIFICATION_RADIUS_MILES = 0.5;
export const CSUEB_EMAIL_DOMAIN = 'horizon.csueastbay.edu';

export const FOOD_PHOTOS: Record<string, string> = {
  Pizza:
    'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=900&q=80',
  Sandwiches:
    'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=900&q=80',
  Veggie:
    'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=900&q=80',
  Pastries:
    'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=900&q=80',
  Burritos:
    'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?auto=format&fit=crop&w=900&q=80',
  Salad:
    'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=900&q=80',
  Coffee:
    'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=900&q=80',
  Dessert:
    'https://images.unsplash.com/photo-1551024506-0bccd828d307?auto=format&fit=crop&w=900&q=80',
  [CATERING_CLEAROUT_TYPE]:
    'https://images.unsplash.com/photo-1555244162-803834f70033?auto=format&fit=crop&w=900&q=80',
};

const building = (name: string) =>
  CAMPUS_BUILDINGS.find((item) => item.name === name) ?? CAMPUS_BUILDINGS[0];

export function getBuildingCoordinate(buildingName: string): Coordinate {
  return building(buildingName).coordinate;
}

export function getBuildingShortName(buildingName: string): string {
  return building(buildingName).shortName;
}

export function buildSeedDrops(now = Date.now()): FoodDrop[] {
  const coreLibrary = building('CB - CORE Library');
  const unionSouth = building('UU-S - University Union South');
  const valleyBusiness = building('VBT - Valley Business & Tech');
  const diningCommons = building('DC - Dining Commons');

  return [
    {
      id: 'seed-core-pizza',
      buildingName: coreLibrary.name,
      roomNumber: 'CORE Hub',
      foodType: 'Pizza',
      dropType: 'standard',
      photoUri: FOOD_PHOTOS.Pizza,
      servingsLeft: 18,
      createdAt: now - 9 * 60 * 1000,
      expiresAt: now + 111 * 60 * 1000,
      status: 'active',
      latitude: coreLibrary.coordinate.latitude,
      longitude: coreLibrary.coordinate.longitude,
      ownerEmail: 'events@horizon.csueastbay.edu',
      postedByRole: 'student',
      claimedBy: [],
      reportsGone: [],
    },
    {
      id: 'seed-hope-sandwiches',
      buildingName: unionSouth.name,
      roomNumber: 'HOPE Pantry table',
      foodType: 'Sandwiches',
      dropType: 'standard',
      photoUri: FOOD_PHOTOS.Sandwiches,
      servingsLeft: 2,
      createdAt: now - 42 * 60 * 1000,
      expiresAt: now + 78 * 60 * 1000,
      status: 'active',
      latitude: unionSouth.coordinate.latitude,
      longitude: unionSouth.coordinate.longitude,
      ownerEmail: 'hope@horizon.csueastbay.edu',
      postedByRole: 'student',
      claimedBy: [
        'first@horizon.csueastbay.edu',
        'second@horizon.csueastbay.edu',
      ],
      reportsGone: [],
    },
    {
      id: 'seed-vb-veggie',
      buildingName: valleyBusiness.name,
      roomNumber: 'Open lab',
      foodType: 'Veggie',
      dropType: 'standard',
      photoUri: FOOD_PHOTOS.Veggie,
      servingsLeft: 0,
      createdAt: now - 51 * 60 * 1000,
      expiresAt: now + 69 * 60 * 1000,
      status: 'sold_out',
      latitude: valleyBusiness.coordinate.latitude,
      longitude: valleyBusiness.coordinate.longitude,
      ownerEmail: 'hacknight@horizon.csueastbay.edu',
      postedByRole: 'student',
      claimedBy: [],
      reportsGone: ['student@horizon.csueastbay.edu'],
    },
    {
      id: 'seed-dc-clearout',
      buildingName: diningCommons.name,
      roomNumber: 'Pioneer Kitchen pickup',
      foodType: CATERING_CLEAROUT_TYPE,
      dropType: 'catering_clearout',
      photoUri: FOOD_PHOTOS[CATERING_CLEAROUT_TYPE],
      servingsLeft: 24,
      createdAt: now - 3 * 60 * 1000,
      expiresAt: now + 12 * 60 * 1000,
      status: 'active',
      latitude: diningCommons.coordinate.latitude,
      longitude: diningCommons.coordinate.longitude,
      ownerEmail: 'pioneerkitchen@horizon.csueastbay.edu',
      postedByRole: 'catering',
      claimedBy: [],
      reportsGone: [],
    },
  ];
}
