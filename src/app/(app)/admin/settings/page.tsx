import type { Metadata } from "next";
import { AdminHeader } from "@/features/admin/AdminHeader";
import {
  RuntimeSettingsForm,
  type RuntimeSettingValues,
} from "@/features/admin/RuntimeSettingsForm";
import type { RuntimeConfig } from "@/server/config/runtime";
import { requireAdminPage } from "@/server/auth/admin";
import { getAdminSettings } from "@/server/services/admin";

export const metadata: Metadata = { title: "Admin · Settings" };

function settingValues(config: RuntimeConfig): RuntimeSettingValues {
  return {
    ai_generation_enabled: config.aiGenerationEnabled,
    regen_daily_limit: config.regenDailyLimit,
    global_daily_ai_limit: config.globalDailyAiLimit,
    plan_day_of_month: config.planDayOfMonth,
    planning_horizon_months: config.planningHorizonMonths,
    ai_model: config.aiModel,
    ai_base_url: config.aiBaseUrl,
  };
}

export default async function AdminSettingsPage() {
  const admin = await requireAdminPage();
  const { overrides, defaults, effective } = await getAdminSettings(admin);
  return (
    <>
      <AdminHeader active="settings" />
      <div className="mb-6 space-y-2">
        <h2 className="font-display text-h3 font-semibold text-primary">
          Application settings
        </h2>
        <p className="text-sm text-secondary">
          These replace the server environment values without a redeploy. Use
          default returns a setting to its environment value.
          {overrides.updated_by
            ? ` Last changed by ${overrides.updated_by}.`
            : ""}
        </p>
      </div>
      <RuntimeSettingsForm
        key={overrides.updated_at}
        effective={settingValues(effective)}
        defaults={settingValues(defaults)}
        overridden={{
          ai_generation_enabled: overrides.ai_generation_enabled !== null,
          regen_daily_limit: overrides.regen_daily_limit !== null,
          global_daily_ai_limit: overrides.global_daily_ai_limit !== null,
          plan_day_of_month: overrides.plan_day_of_month !== null,
          planning_horizon_months: overrides.planning_horizon_months !== null,
          ai_model: overrides.ai_model !== null,
          ai_base_url: overrides.ai_base_url !== null,
        }}
      />
    </>
  );
}
