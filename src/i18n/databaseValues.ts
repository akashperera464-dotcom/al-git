const normalize = (value: string) => value.trim().toLowerCase().replace(/[\s-]+/g, "_");

export const statusKey = (value: string) => `status.${normalize(value)}`;
export const gradeKey = (value: string) => `grade.${normalize(value)}`;
export const activityKey = (value: string) => `activity.${normalize(value)}`;
export const moveTypeKey = (value: string) => `moveType.${normalize(value)}`;
export const landTypeKey = (value: string) => `landType.${normalize(value)}`;
export const plotStateKey = (value: string) => `plotState.${normalize(value)}`;
export const roleKey = (value: string) => `role.${normalize(value)}`;
