import { ProfileEditForm } from "@/components/user/profile-edit-form";
import { SettingsTitle } from "@/components/user/settings-shell";

export default function PrivacyPage() {
  return <><SettingsTitle>隐私设置</SettingsTitle><ProfileEditForm section="privacy" /></>;
}
