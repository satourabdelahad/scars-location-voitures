/** Vues des photos d'une voiture : la principale est obligatoire, les autres facultatives. */
export const CAR_VIEWS = ["main", "front", "back", "left", "right", "top", "interior", "dashboard", "trunk", "other"] as const;
export type CarView = (typeof CAR_VIEWS)[number];
