export const ROLES = {
  ADMINISTRADOR: "ADMINISTRADOR",
  ADMINISTRATIVO: "ADMINISTRATIVO",
  OPERARIO: "OPERARIO"
} as const;

export type Role = typeof ROLES[keyof typeof ROLES];

export const ROLE_LABELS: Record<Role, string> = {
  [ROLES.ADMINISTRADOR]: "Administrador",
  [ROLES.ADMINISTRATIVO]: "Administrativo",
  [ROLES.OPERARIO]: "Operario"
};
