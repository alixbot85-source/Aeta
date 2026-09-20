import { createPatch } from "diff";

export type PendingChangeKind = "create" | "edit" | "delete";

export type PendingChange = {
  id: string;
  workspaceId?: string;
  path: string;
  kind: PendingChangeKind;
  oldContent: string;
  newContent: string;
  diff: string;
  status: "pending" | "accepted" | "rejected";
  createdAt: string;
};

export function buildUnifiedDiff(filePath: string, oldContent: string, newContent: string): string {
  return createPatch(filePath, oldContent, newContent, "before", "after");
}
