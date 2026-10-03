import { redirect } from "next/navigation";

export default function AccountSecurityPage() {
  return redirect("/me#security");
}
