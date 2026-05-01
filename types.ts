export type Coordinate = {
  latitude: number;
  longitude: number;
};

export type CampusBuilding = {
  name: string;
  shortName: string;
  coordinate: Coordinate;
  description: string;
};

export type DropStatus = 'active' | 'sold_out';
export type DropType = 'standard' | 'catering_clearout';
export type UserRole = 'student' | 'catering';

export type FoodDrop = {
  id: string;
  buildingName: string;
  roomNumber: string;
  foodType: string;
  dropType: DropType;
  photoUri?: string;
  servingsLeft: number;
  createdAt: number;
  expiresAt: number;
  status: DropStatus;
  latitude: number;
  longitude: number;
  ownerEmail: string;
  postedByRole: UserRole;
  claimedBy: string[];
  reportsGone: string[];
};

export type UserProfile = {
  email: string;
  verifiedAt: number;
  primaryBuilding: string;
  major: string;
  role: UserRole;
  notificationRadiusMiles: number;
};

export type DropTone = 'fresh' | 'warming' | 'gone';
