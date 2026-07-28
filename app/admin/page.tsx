import { redirect } from "next/navigation";
import { getAdminUser } from "../admin-auth";
import { chatGPTSignInPath } from "../chatgpt-auth";
import { AdminConsole } from "./admin-console";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await getAdminUser();
  if (!user) redirect(chatGPTSignInPath("/admin"));

  return <AdminConsole adminName={user.displayName} />;
}
