export type ManagementSaveState =
  | "saved"
  | "dirty"
  | "saving"
  | "error"
  | "conflict";

export interface ManagementEditorStatus {
  state: ManagementSaveState;
  dirty: boolean;
  busy: boolean;
  message?: string;
}

export const SAVED_MANAGEMENT_STATUS: ManagementEditorStatus = {
  state: "saved",
  dirty: false,
  busy: false,
};
