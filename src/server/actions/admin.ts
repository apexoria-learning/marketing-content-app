"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import {
  AppSettingsUpdateSchema,
  GrantAccessInputSchema,
  ImportAllowlistInputSchema,
  SaveInstructionsInputSchema,
  UpdateAccessInputSchema,
  type AppSettingsUpdate,
  type GrantAccessInput,
  type SaveInstructionsInput,
  type UpdateAccessInput,
} from "../../lib/schemas/admin";
import {
  grantAccess,
  importEnvironmentAllowlist,
  movePlatform,
  saveInstructions,
  savePlatformEntry,
  updateAccess,
  updateSettings,
} from "../services/admin";
import {
  MovePlatformInputSchema,
  SavePlatformInputSchema,
  type MovePlatformInput,
  type SavePlatformInput,
} from "../../lib/schemas/platforms";
import { runAdminAction } from "./run-action";

function revalidateAdmin(): void {
  revalidatePath("/admin", "layout");
}

// Runtime settings and the platform catalogue change every screen.
function revalidateEverything(): void {
  revalidatePath("/", "layout");
}

export async function savePlatform(input: SavePlatformInput) {
  return runAdminAction(
    input,
    SavePlatformInputSchema,
    (value, admin) => savePlatformEntry(admin, value),
    revalidateEverything,
  );
}

export async function reorderPlatform(input: MovePlatformInput) {
  return runAdminAction(
    input,
    MovePlatformInputSchema,
    (value, admin) => movePlatform(admin, value),
    revalidateEverything,
  );
}

export async function grantUserAccess(input: GrantAccessInput) {
  return runAdminAction(
    input,
    GrantAccessInputSchema,
    (value, admin) => grantAccess(admin, value),
    revalidateAdmin,
  );
}

export async function updateUserAccess(input: UpdateAccessInput) {
  return runAdminAction(
    input,
    UpdateAccessInputSchema,
    (value, admin) => updateAccess(admin, value),
    revalidateAdmin,
  );
}

export async function importAllowlist(input: Record<string, never>) {
  return runAdminAction(
    input,
    ImportAllowlistInputSchema,
    (_value, admin) => importEnvironmentAllowlist(admin),
    revalidateAdmin,
  );
}

export async function updateAppSettings(input: AppSettingsUpdate) {
  return runAdminAction(
    input,
    AppSettingsUpdateSchema,
    (value, admin) => updateSettings(admin, value),
    revalidateEverything,
  );
}

export async function saveEditorialInstructions(input: SaveInstructionsInput) {
  return runAdminAction(
    input,
    SaveInstructionsInputSchema,
    (value, admin) => saveInstructions(admin, value),
    revalidateAdmin,
  );
}
